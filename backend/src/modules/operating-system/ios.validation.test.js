import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDateRange,
  decimalValue,
  metricCode,
  requiredString,
  stringArray,
} from "./ios.validation.js";

test("normaliza código de métrica válido", () => {
  assert.equal(metricCode(" Growth.MRR "), "growth.mrr");
  assert.throws(() => metricCode("MRR"), /segmentos minúsculos separados por ponto/);
  assert.throws(() => metricCode("growth.MRR mensal"), /segmentos minúsculos separados por ponto/);
});

test("valida decimal sem converter para ponto flutuante", () => {
  assert.equal(decimalValue("1234,56", "value"), "1234.56");
  assert.equal(decimalValue("-0.125000", "value"), "-0.125000");
  assert.throws(() => decimalValue("12.1234567", "value"), /até 6 casas decimais/);
});

test("valida intervalos e limites de texto/lista", () => {
  const start = new Date("2026-07-01T00:00:00.000Z");
  const end = new Date("2026-09-30T23:59:59.000Z");
  assert.doesNotThrow(() => assertDateRange(start, end));
  assert.throws(() => assertDateRange(end, start), /posterior/);
  assert.equal(requiredString("  objetivo  ", "title"), "objetivo");
  assert.deepEqual(stringArray([" Clareza ", "Foco"], "values"), ["Clareza", "Foco"]);
});
