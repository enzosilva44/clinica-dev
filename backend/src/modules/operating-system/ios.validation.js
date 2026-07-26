import { IosError } from "./ios.errors.js";

function validationError(field, message) {
  return new IosError(400, "IOS_VALIDATION_ERROR", message, { field });
}

export function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

export function requiredString(value, field, { max = 500, min = 1 } = {}) {
  if (typeof value !== "string") throw validationError(field, `${field} é obrigatório.`);
  const normalized = value.trim();
  if (normalized.length < min) throw validationError(field, `${field} é obrigatório.`);
  if (normalized.length > max) {
    throw validationError(field, `${field} deve ter no máximo ${max} caracteres.`);
  }
  return normalized;
}

export function optionalString(value, field, { max = 500 } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw validationError(field, `${field} deve ser um texto.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) {
    throw validationError(field, `${field} deve ter no máximo ${max} caracteres.`);
  }
  return normalized;
}

export function enumValue(value, field, allowed, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (!allowed.includes(value)) {
    throw validationError(field, `${field} deve ser um de: ${allowed.join(", ")}.`);
  }
  return value;
}

export function booleanValue(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "boolean") throw validationError(field, `${field} deve ser booleano.`);
  return value;
}

export function integerValue(value, field, { optional = false, min = 0, max = 100000 } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw validationError(field, `${field} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return value;
}

export function dateValue(value, field, { optional = false, nullable = false } = {}) {
  if (value === undefined && optional) return undefined;
  if ((value === null || value === "") && nullable) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw validationError(field, `${field} deve ser uma data ISO válida.`);
  }
  return date;
}

export function decimalValue(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (value === null || value === "" || typeof value === "boolean") {
    throw validationError(field, `${field} deve ser um número decimal.`);
  }
  const text = String(value).trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,6})?$/.test(text) || !Number.isFinite(Number(text))) {
    throw validationError(field, `${field} deve ser um número com até 6 casas decimais.`);
  }
  if (Math.abs(Number(text)) > 99999999999999) {
    throw validationError(field, `${field} excede o limite permitido.`);
  }
  return text;
}

export function stringArray(value, field, { optional = false, maxItems = 20, itemMax = 120 } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value)) throw validationError(field, `${field} deve ser uma lista.`);
  if (value.length > maxItems) {
    throw validationError(field, `${field} deve ter no máximo ${maxItems} itens.`);
  }
  return value.map((item, index) => requiredString(item, `${field}[${index}]`, { max: itemMax }));
}

export function jsonArray(value, field, { optional = false, maxItems = 30, maxBytes = 20000 } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value)) throw validationError(field, `${field} deve ser uma lista.`);
  if (value.length > maxItems) {
    throw validationError(field, `${field} deve ter no máximo ${maxItems} itens.`);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes) {
    throw validationError(field, `${field} excede o tamanho permitido.`);
  }
  return value;
}

export function metricCode(value) {
  const code = requiredString(value, "code", { max: 100 }).toLowerCase();
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(code)) {
    throw validationError(
      "code",
      "code deve usar segmentos minúsculos separados por ponto, por exemplo growth.mrr."
    );
  }
  return code;
}

export function assertDateRange(startDate, endDate, { maxDays = 731 } = {}) {
  if (startDate >= endDate) {
    throw validationError("endDate", "A data final deve ser posterior à data inicial.");
  }
  const days = (endDate.getTime() - startDate.getTime()) / 86400000;
  if (days > maxDays) {
    throw validationError("endDate", `O período deve ter no máximo ${maxDays} dias.`);
  }
}

export function definedData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
