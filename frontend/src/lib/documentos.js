// Validação de CPF/CNPJ.
//
// O documento é obrigatório no cadastro porque o Asaas não emite cobrança sem
// ele — nem a mensalidade do fim do trial, nem a contratação direta. Validar o
// dígito verificador aqui evita descobrir o número errado só lá na frente,
// quando a cobrança falha.

export function onlyDigits(v) {
  return (v || "").replace(/\D/g, "");
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11 e afins

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

// Documento da pessoa/empresa no formato que o Asaas espera (só dígitos).
export function documentoDe({ personType, cpf, cnpj }) {
  return onlyDigits(personType === "pj" ? cnpj : cpf);
}
