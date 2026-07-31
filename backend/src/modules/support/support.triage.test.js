import test from "node:test";
import assert from "node:assert/strict";
import {
  DEPARTMENTS,
  interpretMenuChoice,
  isWithinBusinessHours,
  menuText,
} from "./support.triage.js";

test("menu lista as 4 opções de departamento mais a de atendente", () => {
  const txt = menuText();
  assert.match(txt, /1 — Quero conhecer a IASO/);
  assert.match(txt, /2 — Preciso de suporte/);
  assert.match(txt, /3 — Financeiro e pagamentos/);
  assert.match(txt, /4 — Implantação e treinamento/);
  assert.match(txt, /5 — Falar com um atendente/);
});

test("número puro escolhe o departamento na ordem do menu", () => {
  assert.deepEqual(interpretMenuChoice("1"), { type: "department", key: "comercial" });
  assert.deepEqual(interpretMenuChoice("2"), { type: "department", key: "suporte" });
  assert.deepEqual(interpretMenuChoice("3"), { type: "department", key: "financeiro" });
  assert.deepEqual(interpretMenuChoice("4"), { type: "department", key: "implantacao" });
});

test("opção 5 pede atendente humano, não departamento", () => {
  assert.deepEqual(interpretMenuChoice("5"), { type: "human" });
});

test("aceita o número com pontuação, como as pessoas realmente respondem", () => {
  for (const entrada of ["2)", "2.", " 2 ", "opção 2"]) {
    assert.deepEqual(interpretMenuChoice(entrada), { type: "department", key: "suporte" }, entrada);
  }
});

test("entende texto livre além do número", () => {
  assert.deepEqual(interpretMenuChoice("financeiro"), { type: "department", key: "financeiro" });
  assert.deepEqual(interpretMenuChoice("estou com um erro no sistema"), { type: "department", key: "suporte" });
  assert.deepEqual(interpretMenuChoice("quero saber o preço"), { type: "department", key: "comercial" });
  assert.deepEqual(interpretMenuChoice("quero falar com um atendente"), { type: "human" });
});

test("resposta fora do esperado é inválida (não escolhe departamento por engano)", () => {
  for (const entrada of ["", "   ", "0", "9", "asdfgh", null, undefined]) {
    assert.equal(interpretMenuChoice(entrada).type, "invalid", String(entrada));
  }
});

test("horário comercial: seg–sex 9h–18h no fuso de São Paulo", () => {
  // 2026-07-29 é uma quarta-feira. UTC-3 em julho (sem horário de verão).
  assert.equal(isWithinBusinessHours(new Date("2026-07-29T13:00:00Z")), true,  "10h SP, quarta");
  assert.equal(isWithinBusinessHours(new Date("2026-07-29T20:59:00Z")), true,  "17h59 SP, quarta");
  assert.equal(isWithinBusinessHours(new Date("2026-07-29T21:00:00Z")), false, "18h SP = fechado");
  assert.equal(isWithinBusinessHours(new Date("2026-07-29T11:59:00Z")), false, "8h59 SP = fechado");
  assert.equal(isWithinBusinessHours(new Date("2026-08-01T15:00:00Z")), false, "sábado");
  assert.equal(isWithinBusinessHours(new Date("2026-08-02T15:00:00Z")), false, "domingo");
});

test("todo departamento do menu tem chave única", () => {
  const keys = DEPARTMENTS.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
});
