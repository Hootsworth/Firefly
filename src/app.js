import { PRESETS, analyzeScenario, formatRate, formatSeconds } from "./model.js";
import { BENCHMARK_PLANS } from "./capabilities.js";
import { COMPONENTS, DEFAULT_BUILD, scoreBuild } from "./systemDesigner.js";
import { compareScenarios } from "./comparison.js";

const form = document.querySelector("#scenario-form");
const preset = document.querySelector("#preset");
const resetButton = document.querySelector("#reset-button");
const probeButton = document.querySelector("#probe-button");
const reportButton = document.querySelector("#report-button");
const designerApplyButton = document.querySelector("#designer-apply-button");
const comparisonLabel = document.querySelector("#comparison-label");
const captureBeforeButton = document.querySelector("#capture-before-button");
const captureAfterButton = document.querySelector("#capture-after-button");
const loadBeforeButton = document.querySelector("#load-before-button");
const loadAfterButton = document.querySelector("#load-after-button");
const swapComparisonButton = document.querySelector("#swap-comparison-button");
const clearComparisonButton = document.querySelector("#clear-comparison-button");
const cursor = document.querySelector("#cursor");
const fields = [...form.elements].filter((element) => element.name);

const output = {
  summaryVerdict: document.querySelector("#summary-verdict"),
  expectedTime: document.querySelector("#expected-time"),
  plainAnswer: document.querySelector("#plain-answer"),
  plainDetail: document.querySelector("#plain-detail"),
  plainActions: document.querySelector("#plain-actions"),
  observedTime: document.querySelector("#observed-time"),
  deltaTime: document.querySelector("#delta-time"),
  observedRate: document.querySelector("#observed-rate"),
  verdictTitle: document.querySelector("#verdict-title"),
  verdictDetail: document.querySelector("#verdict-detail"),
  confidenceBand: document.querySelector("#confidence-band"),
  effectiveRate: document.querySelector("#effective-rate"),
  warningList: document.querySelector("#warning-list"),
  stageList: document.querySelector("#stage-list"),
  recommendations: document.querySelector("#recommendations"),
  benchmarkList: document.querySelector("#benchmark-list"),
  probeOutput: document.querySelector("#probe-output"),
  confidenceLedger: document.querySelector("#confidence-ledger"),
  historyList: document.querySelector("#history-list"),
  designerControls: document.querySelector("#designer-controls"),
  designerMap: document.querySelector("#designer-map"),
  designerScores: document.querySelector("#designer-scores"),
  comparisonSummary: document.querySelector("#comparison-summary"),
  comparisonTable: document.querySelector("#comparison-table"),
  comparisonInsights: document.querySelector("#comparison-insights"),
  comparisonSnapshots: document.querySelector("#comparison-snapshots")
};

const lastBenchmarkResults = new Map();
let designerSelection = { ...DEFAULT_BUILD };
let comparisonState = {
  before: null,
  after: null
};

const initialValues = Object.fromEntries(fields.map((field) => [field.name, field.type === "checkbox" ? field.checked : field.value]));

fields.forEach((field) => {
  field.addEventListener("input", () => {
    if (field === preset) applyPreset();
    render();
  });
});

document.addEventListener("mousemove", (event) => {
  if (!cursor) return;
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
});

resetButton.addEventListener("click", () => {
  fields.forEach((field) => {
    if (field.type === "checkbox") {
      field.checked = initialValues[field.name];
    } else {
      field.value = initialValues[field.name];
    }
  });
  applyPreset();
  render();
});

probeButton?.addEventListener("click", async () => {
  await runProbe();
});

reportButton?.addEventListener("click", async () => {
  await exportReport();
});

designerApplyButton?.addEventListener("click", () => {
  applyDesignerToScenario();
});

comparisonLabel?.addEventListener("input", () => {
  renderComparison();
});

captureBeforeButton?.addEventListener("click", () => {
  comparisonState.before = snapshotScenario("Before");
  renderComparison();
});

captureAfterButton?.addEventListener("click", () => {
  comparisonState.after = snapshotScenario("After");
  renderComparison();
});

loadBeforeButton?.addEventListener("click", () => {
  loadSnapshotIntoForm(comparisonState.before);
});

loadAfterButton?.addEventListener("click", () => {
  loadSnapshotIntoForm(comparisonState.after);
});

swapComparisonButton?.addEventListener("click", () => {
  comparisonState = {
    before: comparisonState.after,
    after: comparisonState.before
  };
  renderComparison();
});

clearComparisonButton?.addEventListener("click", () => {
  comparisonState = { before: null, after: null };
  renderComparison();
});

function getScenario() {
  return Object.fromEntries(fields.map((field) => [field.name, field.type === "checkbox" ? field.checked : field.value]));
}

function applyPreset() {
  const selected = PRESETS[preset.value];
  if (!selected) return;
  form.elements.portMbps.value = selected.portMbps;
  form.elements.protocolEfficiency.value = selected.protocolEfficiency;
  form.elements.latencyMs.value = selected.latencyMs;
}

function render() {
  const result = analyzeScenario(getScenario());
  const signedDelta = result.deltaSeconds >= 0 ? "+" : "";
  document.body.dataset.verdict = result.verdict.status;

  output.summaryVerdict.textContent = result.verdict.title;
  output.expectedTime.textContent = formatSeconds(result.expectedSeconds);
  output.observedTime.textContent = formatSeconds(result.observedSeconds);
  output.deltaTime.textContent = `${signedDelta}${formatSeconds(result.deltaSeconds)} (${signedDelta}${result.deltaPct.toFixed(1)}%)`;
  output.observedRate.textContent = formatRate(result.observedRateMBps);
  output.verdictTitle.textContent = result.verdict.title;
  output.verdictDetail.textContent = result.verdict.detail;
  output.confidenceBand.textContent = `±${result.tolerancePct.toFixed(0)}% band`;
  output.effectiveRate.textContent = `${formatRate(result.effectiveRateMBps)} expected`;
  renderPlainDiagnosis(result);

  output.warningList.replaceChildren(
    ...result.warnings.map((warning) => {
      const item = document.createElement("p");
      item.textContent = warning;
      return item;
    })
  );

  const annotationNodes = result.annotations.map((annotation) => {
    const item = document.createElement("p");
    item.className = "annotation";
    item.textContent = annotation;
    return item;
  });
  output.warningList.append(...annotationNodes);

  output.stageList.replaceChildren(
    ...result.stages.map((stage) => {
      const row = document.createElement("article");
      row.className = "stage";
      row.innerHTML = `
        <div class="stage-top">
          <strong>${stage.name}</strong>
          <span>${stage.headline}</span>
        </div>
        <div class="bar" aria-hidden="true"><i style="width: ${Math.max(3, stage.pressure * 100)}%"></i></div>
        <div class="stage-bottom">
          <span>${formatRate(stage.effectiveRateMBps)}</span>
          <span>${stage.explanation}</span>
        </div>
      `;
      return row;
    })
  );

  output.recommendations.replaceChildren(
    ...result.recommendations.map((recommendation) => {
      const item = document.createElement("li");
      item.textContent = recommendation;
      return item;
    })
  );

  renderConfidence(result.confidence);
}

function renderStaticReference() {
  renderDesignerControls();
  renderDesigner();
  renderComparison();
  output.benchmarkList.replaceChildren(
    ...BENCHMARK_PLANS.map((plan) => {
      const item = document.createElement("article");
      item.className = "benchmark";
      item.innerHTML = `
        <div>
          <strong>${plan.name}</strong>
          <button type="button" class="mini-button" data-benchmark="${plan.id}">
            ${plan.id === "dmi-bottleneck" ? "Guide" : "Run"}
          </button>
          <button type="button" class="mini-button ghost" data-apply-benchmark="${plan.id}" disabled>
            Use
          </button>
        </div>
        <div>
          <p>${plan.process}</p>
          <small>${plan.target}. ${plan.expected}</small>
          <pre class="benchmark-result" id="benchmark-result-${plan.id}">Not run yet.</pre>
        </div>
      `;
      return item;
    })
  );

  output.benchmarkList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-benchmark]");
    const applyButton = event.target.closest("[data-apply-benchmark]");
    if (button) await runBenchmark(button.dataset.benchmark, button);
    if (applyButton) applyBenchmark(applyButton.dataset.applyBenchmark);
  });

  loadHistory();
}

function renderPlainDiagnosis(result) {
  if (!output.plainAnswer || !output.plainDetail || !output.plainActions) return;
  const primary = result.stages[0];
  const near = result.stages.filter((stage) => stage.headline === "near constraint").slice(0, 2);
  const statusLead = {
    slower: "This run is slower than the model expects.",
    faster: "This run is faster than the model expects.",
    expected: "This run is behaving like the model expects.",
    invalid: "Firefly needs cleaner inputs before it can diagnose this."
  }[result.verdict.status] || result.verdict.title;

  output.plainAnswer.textContent = primary
    ? `${statusLead} Likely limit: ${primary.name}.`
    : statusLead;
  output.plainDetail.textContent = primary
    ? `${primary.name} is the lowest ceiling at ${formatRate(primary.effectiveRateMBps)}. ${near.length ? `Also watch ${near.map((stage) => stage.name.toLowerCase()).join(" and ")}.` : "The other modeled stages currently have more headroom."}`
    : result.verdict.detail;

  const actions = [
    result.verdict.status === "slower" ? "Run a bounded benchmark for the suspected stage." : "Capture two more runs and compare the median.",
    primary?.name.includes("Port") ? "Check cable, negotiated link speed, switch counters, and packet loss." : null,
    primary?.name.includes("Destination") ? "Run burst and sustained writes; watch SLC cache exhaustion and thermals." : null,
    primary?.name.includes("DMI") ? "Move one device off the chipset path or reduce competing PCH traffic." : null,
    primary?.name.includes("Memory") ? "Check XMP/EXPO, flex-mode RAM, and background memory pressure." : null
  ].filter(Boolean).slice(0, 3);

  output.plainActions.replaceChildren(
    ...actions.map((action) => {
      const item = document.createElement("span");
      item.textContent = action;
      return item;
    })
  );
}

function renderDesignerControls() {
  output.designerControls.replaceChildren(
    ...Object.entries(COMPONENTS).map(([group, options]) => {
      const label = document.createElement("label");
      label.innerHTML = `
        ${group}
        <select data-design-group="${group}">
          ${options.map((option) => `<option value="${option.id}" ${option.id === designerSelection[group] ? "selected" : ""}>${option.label}</option>`).join("")}
        </select>
      `;
      return label;
    })
  );

  output.designerControls.addEventListener("input", (event) => {
    const select = event.target.closest("[data-design-group]");
    if (!select) return;
    designerSelection = { ...designerSelection, [select.dataset.designGroup]: select.value };
    renderDesigner();
  });
}

function renderDesigner() {
  const build = scoreBuild(designerSelection);
  const nodes = [
    ["CPU", build.parts.cpu.label, build.specs.cpu],
    ["RAM", build.parts.memory.label, build.specs.memory],
    ["GPU", build.parts.gpu.label, build.specs.gpu],
    ["Storage", build.parts.storage.label, build.specs.storage],
    ["Network", build.parts.network.label, build.specs.network],
    ["Topology", build.parts.topology.label, build.specs.topology]
  ];

  output.designerMap.replaceChildren(
    ...nodes.map(([label, value, specs], index) => {
      const node = document.createElement("article");
      node.className = `design-node n${index}`;
      node.innerHTML = `
        <span>${label}</span>
        <strong>${value}</strong>
        <ul class="component-specs">${specs.map((spec) => `<li>${spec}</li>`).join("")}</ul>
      `;
      return node;
    })
  );

  output.designerScores.replaceChildren(
    ...Object.entries(build.scores).map(([label, value]) => {
      const item = document.createElement("article");
      item.className = "score-card";
      item.innerHTML = `
        <span>${label}</span>
        <strong>${value}</strong>
        <div class="bar"><i style="width:${value}%"></i></div>
      `;
      return item;
    }),
    summaryCard(build)
  );
}

function snapshotScenario(label) {
  return {
    label,
    recordedAt: new Date().toISOString(),
    scenario: getScenario()
  };
}

function renderComparison() {
  if (!output.comparisonSummary || !output.comparisonTable || !output.comparisonSnapshots) return;
  const changeLabel = comparisonLabel?.value || "System change";
  const comparison = compareScenarios(comparisonState.before?.scenario, comparisonState.after?.scenario, changeLabel);

  output.comparisonSummary.replaceChildren(renderComparisonSummary(comparison));
  output.comparisonTable.replaceChildren(
    ...(comparison.ready ? comparison.rows.map(renderComparisonRow) : [emptyComparisonRow()])
  );
  output.comparisonInsights?.replaceChildren(
    ...(comparison.ready ? comparison.insights.map(renderComparisonInsight) : [emptyComparisonInsight()])
  );
  output.comparisonSnapshots.replaceChildren(
    renderSnapshotCard("Before", comparisonState.before),
    renderSnapshotCard("After", comparisonState.after)
  );
  if (loadBeforeButton) loadBeforeButton.disabled = !comparisonState.before;
  if (loadAfterButton) loadAfterButton.disabled = !comparisonState.after;
}

function renderComparisonSummary(comparison) {
  const card = document.createElement("article");
  card.className = `comparison-verdict ${comparison.ready ? comparison.status.tone : "neutral"}`;
  card.innerHTML = comparison.ready
    ? `
        <span>${comparison.changeLabel}</span>
        <strong>${comparison.status.title}</strong>
        <p>${comparison.status.detail}</p>
        <small>Expected ${signedPercent(comparison.expectedPct)} / observed ${signedPercent(comparison.observedPct)} / rate ${signedPercent(comparison.ratePct)}</small>
      `
    : `
        <span>Comparison mode</span>
        <strong>${comparison.title}</strong>
        <p>${comparison.detail}</p>
        <small>Capture before, make the hardware or software change, then capture after.</small>
      `;
  return card;
}

function renderComparisonRow(row) {
  const item = document.createElement("article");
  item.className = `comparison-row ${row.tone}`;
  item.innerHTML = `
    <span>${row.label}</span>
    <strong>${row.before}</strong>
    <strong>${row.after}</strong>
    <b>${row.delta}</b>
  `;
  return item;
}

function renderComparisonInsight(insight) {
  const item = document.createElement("article");
  item.className = "comparison-insight";
  item.innerHTML = `
    <strong>${insight.title}</strong>
    <p>${insight.detail}</p>
  `;
  return item;
}

function emptyComparisonInsight() {
  const item = document.createElement("article");
  item.className = "comparison-insight empty";
  item.innerHTML = `
    <strong>What Firefly will explain</strong>
    <p>Once both states are captured, this panel separates real path movement from measurement noise and names the next fix to try.</p>
  `;
  return item;
}

function emptyComparisonRow() {
  const item = document.createElement("article");
  item.className = "comparison-row neutral";
  item.innerHTML = `
    <span>Metric</span>
    <strong>Before</strong>
    <strong>After</strong>
    <b>Delta</b>
  `;
  return item;
}

function renderSnapshotCard(label, snapshot) {
  const item = document.createElement("article");
  item.className = `snapshot-card ${snapshot ? "filled" : ""}`;
  if (!snapshot) {
    item.innerHTML = `
      <span>${label}</span>
      <strong>Not captured</strong>
      <p>Use the current scenario form to save this side.</p>
    `;
    return item;
  }

  const analysis = analyzeScenario(snapshot.scenario);
  item.innerHTML = `
    <span>${label}</span>
    <strong>${formatSeconds(analysis.expectedSeconds)}</strong>
    <p>${analysis.bottleneck?.name || "Unknown bottleneck"} / ${formatRate(analysis.effectiveRateMBps)} expected</p>
    <small>${new Date(snapshot.recordedAt).toLocaleString()}</small>
  `;
  return item;
}

function loadSnapshotIntoForm(snapshot) {
  if (!snapshot?.scenario) return;
  Object.entries(snapshot.scenario).forEach(([name, value]) => {
    const field = form.elements[name];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = value === true || value === "on";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      setField(name, value);
    }
  });
  render();
}

function signedPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function summaryCard(build) {
  const item = document.createElement("article");
  item.className = "score-card summary";
  item.innerHTML = `
    <span>Expected path</span>
    <strong>${build.summary[0]}</strong>
    <p>${build.summary.slice(1).join(" / ")}</p>
  `;
  return item;
}

function applyDesignerToScenario() {
  const build = scoreBuild(designerSelection);
  const scenario = build.scenario;
  const mapping = {
    portMbps: scenario.portMbps,
    protocolEfficiency: scenario.protocolEfficiency,
    latencyMs: scenario.latencyMs,
    sourceReadMBps: scenario.sourceReadMBps,
    destinationWriteMBps: scenario.destinationWriteMBps,
    busMBps: Math.round(scenario.busMBps),
    memoryCopyMBps: scenario.memoryCopyMBps,
    cpuTransformMBps: scenario.cpuTransformMBps,
    gpuTransformMBps: scenario.gpuTransformMBps,
    topology: scenario.topology,
    dmiMBps: scenario.dmiMBps,
    pchCompetingTrafficMBps: scenario.pchCompetingTrafficMBps,
    slcCacheGB: scenario.slcCacheGB,
    postCacheWriteMBps: scenario.postCacheWriteMBps,
    queueDepth: scenario.queueDepth
  };
  Object.entries(mapping).forEach(([name, value]) => setField(name, value));
  if (form.elements.preset) form.elements.preset.value = "custom";
  render();
}

async function runProbe() {
  probeButton.disabled = true;
  probeButton.textContent = "Probing...";
  output.probeOutput.innerHTML = "<p>Reading OS hardware APIs and redacting stable identifiers...</p>";

  try {
    const response = await fetch("/api/probe");
    const data = await response.json();
    output.probeOutput.replaceChildren(renderProbe(data));
  } catch (error) {
    output.probeOutput.innerHTML = `<p>Probe failed: ${error.message}</p>`;
  } finally {
    probeButton.disabled = false;
    probeButton.textContent = "Probe this machine";
  }
}

async function runBenchmark(id, button) {
  const target = document.querySelector(`#benchmark-result-${CSS.escape(id)}`);
  button.disabled = true;
  target.textContent = "Running...";

  try {
    const response = await fetch(`/api/benchmarks/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const data = await response.json();
    if (data.status === "complete") {
      lastBenchmarkResults.set(id, data);
      document.querySelector(`[data-apply-benchmark="${CSS.escape(id)}"]`)?.removeAttribute("disabled");
      await loadHistory();
    }
    target.textContent = formatBenchmark(data);
  } catch (error) {
    target.textContent = `Benchmark failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function applyBenchmark(id) {
  const data = lastBenchmarkResults.get(id);
  if (!data || data.status !== "complete") return;
  const rounded = Math.max(1, Math.round(data.MBps));
  if (id === "pure-ram") setField("memoryCopyMBps", rounded);
  if (id === "burst-io" || id === "sustained-write") setField("destinationWriteMBps", rounded);
  if (id === "read-io") setField("sourceReadMBps", rounded);
  if (id === "sustained-queue") {
    setField("queueDepth", Math.max(4, Math.min(64, Math.round((data.iops || 400) / 100))));
  }
  render();
}

function setField(name, value) {
  const field = form.elements[name];
  if (!field) return;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderProbe(data) {
  const wrapper = document.createElement("div");
  wrapper.className = "probe-card";
  const warnings = data.warnings?.length ? data.warnings.map((warning) => `<li>${warning}</li>`).join("") : "<li>No warnings reported.</li>";
  const devices = data.devices?.length ? data.devices.slice(0, 10).map((device) => `<li>${device}</li>`).join("") : "<li>No device list exposed by this OS probe.</li>";
  const hardware = data.raw?.hardware ? data.raw.hardware.trim().split("\n").slice(0, 14).join("\n") : "No hardware summary exposed.";
  const facts = data.facts
    ? [
        `CPU: ${data.facts.cpu?.model || "unknown"}`,
        `Cores: P${data.facts.cpu?.performanceCores ?? "?"} / E${data.facts.cpu?.efficiencyCores ?? "?"}`,
        `Memory: ${data.facts.memory?.GB || "unknown"} GB`,
        `Network: ${(data.facts.network?.interfaces || []).slice(0, 4).map((item) => `${item.name} ${item.link || "unknown"}`).join(", ") || "unknown"}`,
        `Load: ${data.facts.load?.summary || "unknown"}`,
        `Probe quality: ${data.facts.probeQuality || data.confidence}`
      ].join("\n")
    : "No structured facts exposed.";
  const suggestions = data.autofill && Object.keys(data.autofill).length
    ? Object.entries(data.autofill)
        .map(([field, suggestion]) => `<li><button type="button" class="mini-button" data-probe-field="${field}" data-probe-value="${suggestion.value}">Apply</button> <b>${field}</b>: ${suggestion.value} (${suggestion.confidence}) ${suggestion.reason}</li>`)
        .join("")
    : "<li>No safe autofill suggestions available.</li>";

  wrapper.innerHTML = `
    <div class="stage-top">
      <strong>${data.os} probe</strong>
      <span>${data.confidence}</span>
    </div>
    <p>Started at ${data.startedAt}</p>
    <h3>Structured facts</h3>
    <pre>${facts}</pre>
    <h3>Autofill suggestions</h3>
    <ul>${suggestions}</ul>
    <h3>Warnings</h3>
    <ul>${warnings}</ul>
    <h3>Detected devices</h3>
    <ul>${devices}</ul>
    <h3>Hardware summary</h3>
    <pre>${hardware}</pre>
  `;
  wrapper.addEventListener("click", (event) => {
    const button = event.target.closest("[data-probe-field]");
    if (!button) return;
    setField(button.dataset.probeField, button.dataset.probeValue);
    if (button.dataset.probeField === "preset") applyPreset();
  });
  return wrapper;
}

function formatBenchmark(data) {
  if (data.status === "manual-required") {
    return `${data.title}\n${data.notes.join("\n")}`;
  }
  const lines = [
    `${data.title}`,
    `${data.metric}: ${formatRate(data.MBps)}`,
    `Elapsed: ${formatSeconds(data.seconds)}`,
    `Bytes: ${Math.round(data.bytes / 1024 / 1024)} MB`
  ];
  if (data.iops) lines.push(`IOPS: ${data.iops.toFixed(0)}`);
  if (data.notes?.length) lines.push(...data.notes);
  return lines.join("\n");
}

function renderConfidence(confidence) {
  if (!output.confidenceLedger) return;
  const groups = [
    ["Measured", confidence.measured],
    ["Derived", confidence.derived],
    ["Assumed", confidence.assumed],
    ["Blocked", confidence.blocked]
  ];
  output.confidenceLedger.replaceChildren(
    ...groups.map(([label, items]) => {
      const card = document.createElement("article");
      card.className = "confidence-card";
      card.innerHTML = `
        <strong>${label}</strong>
        <ul>${(items?.length ? items : ["No entries for this run."]).map((item) => `<li>${item}</li>`).join("")}</ul>
      `;
      return card;
    })
  );
}

async function loadHistory() {
  if (!output.historyList) return;
  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    const runs = data.runs || [];
    output.historyList.replaceChildren(
      ...(runs.length ? runs.slice(0, 8).map(renderHistoryRun) : [emptyHistory()])
    );
  } catch {
    output.historyList.replaceChildren(emptyHistory("History unavailable."));
  }
}

function renderHistoryRun(run) {
  const item = document.createElement("article");
  item.className = "history-card";
  item.innerHTML = `
    <strong>${run.title}</strong>
    <p>${formatRate(run.MBps)} / ${formatSeconds(run.seconds)}</p>
    <small>${run.recordedAt || "just now"}</small>
  `;
  return item;
}

function emptyHistory(text = "No benchmark runs recorded yet.") {
  const item = document.createElement("p");
  item.textContent = text;
  return item;
}

async function exportReport() {
  reportButton.disabled = true;
  reportButton.textContent = "Exporting...";
  const response = await fetch("/api/report.pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: getScenario() })
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `firefly-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  reportButton.disabled = false;
  reportButton.textContent = "Export PDF";
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.07 }
  );

  document.querySelectorAll(".fade-in").forEach((element) => observer.observe(element));
}

applyPreset();
renderStaticReference();
render();
initReveal();
