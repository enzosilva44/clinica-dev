// Converte o CSV da Fernanda (BaseDeClientes) -> JSON p/ import-pacientes-json.js
// Uso: node scripts/csv-to-pacientes-json.js <arquivo.csv> <saida.json>
// CSV: Nome;Telefone;Telefone 2;Email;Endereço;Observação / Referência;Data Nascimento;CPF  (sep ';', BOM, DD/MM/YYYY)
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const out = process.argv[3];
if (!file || !out) { console.error("uso: <arquivo.csv> <saida.json>"); process.exit(1); }

const raw = readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
lines.shift(); // header

const toIso = (d) => {
  const m = (d || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const clean = (s) => { const v = (s || "").trim(); return v === "" ? null : v; };

const rows = lines.map((line) => {
  const c = line.split(";");
  const [nome, tel, tel2, email, endereco, obs, nasc, cpf] = c.map((x) => (x || "").trim());
  const observations = [
    clean(obs),
    tel2 ? `Tel 2: ${tel2}` : null,
  ].filter(Boolean).join(" | ") || null;
  return {
    name: nome,
    phone: clean(tel) || "",
    email: clean(email),
    street: clean(endereco),
    observations,
    birthDate: toIso(nasc),
    cpf: clean(cpf),
  };
});

writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`${rows.length} pacientes -> ${out}`);
