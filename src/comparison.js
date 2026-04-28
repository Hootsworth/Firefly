import { analyzeScenario, formatRate, formatSeconds } from "./model.js";

export function compareScenarios(beforeRaw, afterRaw, changeLabel = "System change") {
  if (!beforeRaw || !afterRaw) {
    return {
      ready: false,
      title: "Capture both states",
      detail: "Save a before and after scenario to compare a driver update, cable swap, BIOS change, or tuning pass."
    };
  }

  const before = analyzeScenario(beforeRaw);
  const after = analyzeScenario(afterRaw);
  const expectedChange = after.expectedSeconds - before.expectedSeconds;
  const observedChange = after.observedSeconds - before.observedSeconds;
  const rateChange = after.effectiveRateMBps - before.effectiveRateMBps;
  const expectedPct = percentChange(before.expectedSeconds, after.expectedSeconds, true);
  const observedPct = percentChange(before.observedSeconds, after.observedSeconds, true);
  const ratePct = percentChange(before.effectiveRateMBps, after.effectiveRateMBps, false);
  const status = classifyComparison(expectedPct, observedPct, before, after);

  return {
    ready: true,
    changeLabel,
    before,
    after,
    status,
    expectedChange,
    observedChange,
    rateChange,
    expectedPct,
    observedPct,
    ratePct,
    bottleneckChanged: before.bottleneck?.name !== after.bottleneck?.name,
    rows: [
      {
        label: "Expected t",
        before: formatSeconds(before.expectedSeconds),
        after: formatSeconds(after.expectedSeconds),
        delta: signedDuration(expectedChange),
        tone: expectedChange <= 0 ? "good" : "bad"
      },
      {
        label: "Observed t'",
        before: formatSeconds(before.observedSeconds),
        after: formatSeconds(after.observedSeconds),
        delta: signedDuration(observedChange),
        tone: observedChange <= 0 ? "good" : "bad"
      },
      {
        label: "Expected rate",
        before: formatRate(before.effectiveRateMBps),
        after: formatRate(after.effectiveRateMBps),
        delta: signedRate(rateChange),
        tone: rateChange >= 0 ? "good" : "bad"
      },
      {
        label: "Primary limit",
        before: before.bottleneck?.name || "unknown",
        after: after.bottleneck?.name || "unknown",
        delta: before.bottleneck?.name === after.bottleneck?.name ? "unchanged" : "moved",
        tone: before.bottleneck?.name === after.bottleneck?.name ? "neutral" : "watch"
      }
    ],
    insights: buildComparisonInsights({ before, after, expectedPct, observedPct, ratePct })
  };
}

function percentChange(before, after, lowerIsBetter) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || Math.abs(before) < 0.000001) return 0;
  const raw = ((after - before) / before) * 100;
  return lowerIsBetter ? -raw : raw;
}

function classifyComparison(expectedPct, observedPct, before, after) {
  const blended = expectedPct * 0.45 + observedPct * 0.55;
  if (after.verdict.status === "invalid" || before.verdict.status === "invalid") {
    return {
      tone: "bad",
      title: "Comparison needs valid inputs",
      detail: "One side has invalid capacities or timing, so the before/after result cannot be trusted."
    };
  }
  if (blended > 6) {
    return {
      tone: "good",
      title: "After state improved",
      detail: "The change reduced modeled or observed time enough to be visible beyond normal run-to-run noise."
    };
  }
  if (blended < -6) {
    return {
      tone: "bad",
      title: "After state regressed",
      detail: "The change increased expected or observed time; inspect new bottlenecks and negotiated link state."
    };
  }
  return {
    tone: "neutral",
    title: "Change is within noise",
    detail: "The before and after states are close enough that more runs are needed before calling it a win or regression."
  };
}

function buildComparisonInsights({ before, after, expectedPct, observedPct, ratePct }) {
  const insights = [];
  const beforeLimit = before.bottleneck?.name || "unknown";
  const afterLimit = after.bottleneck?.name || "unknown";

  if (beforeLimit !== afterLimit) {
    insights.push({
      title: "Bottleneck moved",
      detail: `${beforeLimit} was the old primary limit; ${afterLimit} is the new primary limit. The change helped one part of the path, but another stage is now setting the ceiling.`
    });
  } else {
    insights.push({
      title: "Same bottleneck",
      detail: `${afterLimit} is still the primary limit. If the after state improved, the change helped without moving the ceiling; if it regressed, inspect this stage first.`
    });
  }

  if (expectedPct > 6 && observedPct <= 2) {
    insights.push({
      title: "Model improved, observed did not",
      detail: "The hardware path should be faster, but the measured run did not follow. Look for cache state, OS work, antivirus/indexing, thermal state, or a measurement mismatch."
    });
  }

  if (expectedPct <= 2 && observedPct > 6) {
    insights.push({
      title: "Observed improved more than the model",
      detail: "The change may have reduced noise rather than changed a modeled ceiling. Repeat the run and check background load before calling it a permanent hardware win."
    });
  }

  if (ratePct < -6) {
    insights.push({
      title: "Expected rate fell",
      detail: "The after state has a lower modeled ceiling. Check negotiated link speed, PCIe lane state, topology, cable, dock, or firmware settings."
    });
  }

  const afterPrimary = after.stages[0];
  if (afterPrimary) {
    insights.push({
      title: "Next fix to try",
      detail: `Start with ${afterPrimary.name.toLowerCase()} because it is now the slowest modeled stage at ${formatRate(afterPrimary.effectiveRateMBps)}.`
    });
  }

  return insights.slice(0, 4);
}

function signedDuration(seconds) {
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${formatSeconds(seconds)}`;
}

function signedRate(rate) {
  const sign = rate > 0 ? "+" : "";
  return `${sign}${formatRate(rate)}`;
}
