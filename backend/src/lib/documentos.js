// Validação de CPF/CNPJ (espelha frontend/src/lib/documentos.js).
//
// O documento é obrigatório para contratar: o Asaas não emite cobrança sem ele.
// Validar no backend é o que garante a regra — a checagem do formulário é só
// conveniência e pode ser contornada.

export function onlyDigits(v) {
  return (v || "").replace(/\D/g, "");
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [length, factor] of [[9, 10], [10, 11]]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (factor - i);
    const rest = (sum * 10) % 11 % 10;
    if (rest !== Number(cpf[length])) return false;
  }
  return true;
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const check = (length) => {
    let sum = 0;
    let factor = length - 7;
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj[i]) * factor--;
      if (factor < 2) factor = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

// Documento do usuário no formato que o Asaas espera (só dígitos), validado.
// Retorna null quando não há documento utilizável.
export function documentoAsaas(user) {
  const cnpj = onlyDigits(user?.cnpj);
  if (cnpj && isValidCnpj(cnpj)) return cnpj;
  const cpf = onlyDigits(user?.cpf);
  if (cpf && isValidCpf(cpf)) return cpf;
  return null;
}
