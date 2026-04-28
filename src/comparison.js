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
    ]
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

function signedDuration(seconds) {
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${formatSeconds(seconds)}`;
}

function signedRate(rate) {
  const sign = rate > 0 ? "+" : "";
  return `${sign}${formatRate(rate)}`;
}
