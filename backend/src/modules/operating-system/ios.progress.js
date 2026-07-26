function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function keyResultProgress({ baseline, target, current }) {
  const from = asFiniteNumber(baseline);
  const to = asFiniteNumber(target);
  const now = asFiniteNumber(current);
  if (from === null || to === null || now === null) return null;
  if (from === to) return now === to ? 100 : 0;
  return Math.round(Math.max(0, Math.min(1, (now - from) / (to - from))) * 100);
}

export function metricTrend(observations, direction = "INCREASE") {
  if (!Array.isArray(observations) || observations.length < 2) return "NO_DATA";
  const current = asFiniteNumber(observations[0]?.value);
  const previous = asFiniteNumber(observations[1]?.value);
  if (current === null || previous === null || current === previous) return "STABLE";
  const improved = direction === "DECREASE" ? current < previous : current > previous;
  return improved ? "IMPROVING" : "WORSENING";
}

export function objectiveProgress(keyResults = []) {
  const progress = keyResults
    .map((keyResult) => keyResult.progress)
    .filter((value) => Number.isFinite(value));
  if (!progress.length) return null;
  return Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length);
}
