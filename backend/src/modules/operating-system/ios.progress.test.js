import test from "node:test";
import assert from "node:assert/strict";
import { keyResultProgress, metricTrend, objectiveProgress } from "./ios.progress.js";

test("calcula progresso crescente e limita entre 0 e 100", () => {
  assert.equal(keyResultProgress({ baseline: 0, target: 100, current: 40 }), 40);
  assert.equal(keyResultProgress({ baseline: 0, target: 100, current: -10 }), 0);
  assert.equal(keyResultProgress({ baseline: 0, target: 100, current: 150 }), 100);
});

test("calcula progresso de métricas cujo alvo é reduzir", () => {
  assert.equal(keyResultProgress({ baseline: 10, target: 5, current: 7.5 }), 50);
  assert.equal(keyResultProgress({ baseline: 10, target: 5, current: 4 }), 100);
});

test("não inventa progresso quando a observação atual não existe", () => {
  assert.equal(keyResultProgress({ baseline: 0, target: 100, current: null }), null);
});

test("interpreta tendência conforme a direção da métrica", () => {
  const observations = [{ value: "8" }, { value: "10" }];
  assert.equal(metricTrend(observations, "DECREASE"), "IMPROVING");
  assert.equal(metricTrend(observations, "INCREASE"), "WORSENING");
  assert.equal(metricTrend([{ value: 1 }], "INCREASE"), "NO_DATA");
});

test("progresso de objetivo é a média dos KRs com dados", () => {
  assert.equal(objectiveProgress([{ progress: 25 }, { progress: 75 }, { progress: null }]), 50);
  assert.equal(objectiveProgress([{ progress: null }]), null);
});
