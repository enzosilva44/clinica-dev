// Roteamento por número: o que decide se um evento vira ticket de suporte da
// IASO ou conversa no inbox de uma clínica. Errar aqui mistura os dois módulos.
import test from "node:test";
import assert from "node:assert/strict";
import { isSupportNumber } from "./support.service.js";

const ORIGINAL = process.env.SUPPORT_PHONE_NUMBER_ID;

test.afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SUPPORT_PHONE_NUMBER_ID;
  else process.env.SUPPORT_PHONE_NUMBER_ID = ORIGINAL;
});

test("reconhece o número da central", () => {
  process.env.SUPPORT_PHONE_NUMBER_ID = "111222333";
  assert.equal(isSupportNumber("111222333"), true);
});

test("número da plataforma NÃO é tratado como suporte", () => {
  process.env.SUPPORT_PHONE_NUMBER_ID = "111222333";
  assert.equal(isSupportNumber("1158855287319096"), false, "número das clínicas segue no inbox delas");
});

test("compara como string, aceitando number vindo do payload", () => {
  process.env.SUPPORT_PHONE_NUMBER_ID = "111222333";
  assert.equal(isSupportNumber(111222333), true);
});

test("sem a variável configurada, NADA é suporte (lado seguro)", () => {
  delete process.env.SUPPORT_PHONE_NUMBER_ID;
  assert.equal(isSupportNumber("111222333"), false);
  assert.equal(isSupportNumber(undefined), false);
});

test("variável vazia não captura eventos sem phone_number_id", () => {
  process.env.SUPPORT_PHONE_NUMBER_ID = "";
  assert.equal(isSupportNumber(undefined), false);
  assert.equal(isSupportNumber(""), false);
});
