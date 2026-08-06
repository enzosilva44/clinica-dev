// Validação de sessão no cliente.
//
// O token do backend expira em 7 dias (auth.controller.js → buildToken). Até
// 06/08/2026 nada no frontend checava isso: o PrivateRoute só olhava se existia
// uma string em localStorage, então um token vencido entrava no app igual a um
// recém-emitido. O resultado era o app abrir normalmente e todas as chamadas
// voltarem 401 — telas vazias, sem explicação (caso Kristiane, 7 dias exatos
// entre o último login e a reclamação).
//
// Aqui só lemos o `exp` do payload para decidir se ainda vale a pena montar a
// sessão. Quem valida de verdade é o backend; isto é UX, não segurança.

// Lê o payload de um JWT sem depender de biblioteca. Retorna null se o token
// não for decodificável — nesse caso tratamos como inválido.
export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // base64url → base64: o JWT troca +/ por -_ e omite o padding.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Token expirado, malformado ou sem `exp` → sessão inválida.
// Sem `exp` conta como inválido: todo token que emitimos tem expiração, então a
// ausência dela indica lixo no localStorage, não um token eterno.
export function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
