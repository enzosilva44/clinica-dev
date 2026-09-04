import { Navigate } from "react-router-dom";

import { isTokenExpired, clearSession } from "../services/session";

// Corte da regra de contratação obrigatória. Contas criadas ANTES desta data
// (legadas) passam livres mesmo sem assinatura; a partir dela, todo cadastro
// novo precisa concluir /contratar antes de usar o sistema.
const CONTRACT_GATE_CUTOFF = new Date("2026-07-27T00:00:00Z");

// ORDEM DAS GUARDAS — a parte fácil de quebrar.
//
// Cada rota de exceção libera só a SUA pendência (/trocar-senha permite senha
// pendente, /contratar permite falta de assinatura). Uma conta com as DUAS
// pendências ao mesmo tempo — criada pelo admin depois do corte, que é o caso
// de toda clínica cadastrada à mão — fazia as duas telas se expulsarem em
// looping, e o app abria em branco no primeiro acesso.
//
// A senha vem primeiro e as demais guardas só valem depois dela. Ao mexer
// aqui, confira estes casos:
//
//   senha pendente + sem assinatura  → /trocar-senha  (e fica lá)
//   só sem assinatura                → /contratar
//   legada (pré-corte)               → passa
//   demo, ou assinatura ativa        → passa

export default function PrivateRoute({
  children,
  allowPasswordChange = false,
  allowBlocked = false,
  allowContract = false,
}) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" />;
  }

  // Token vencido: a sessão acabou. Limpamos o resto antes de mandar para o
  // login, senão o `user` velho continuaria em localStorage e as regras abaixo
  // (trocar senha, contratar, bloqueio) decidiriam com base em dados obsoletos.
  if (isTokenExpired(token)) {
    clearSession();
    return <Navigate to="/login?sessao=expirada" replace />;
  }

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("user") || "{}"); } catch { stored = {}; }

  // 1º acesso: se precisa trocar a senha, bloqueia o resto do app até trocar.
  if (!allowPasswordChange && stored.mustChangePassword) {
    return <Navigate to="/trocar-senha" />;
  }

  // Contratação obrigatória (só contas novas): sem assinatura ativa, manda para
  // /contratar. Demos (que exploram antes de contratar) e legados ficam de fora.
  //
  // A senha pendente tem precedência: conta criada pelo admin chega com as DUAS
  // pendências (senha provisória + sem assinatura), e sem esta condição as duas
  // telas se expulsavam em looping — /trocar-senha mandava para /contratar, que
  // mandava de volta — - deixando a tela branca no primeiro acesso. Além do
  // loop, pedir cartão a quem ainda está com senha provisória é fora de ordem.
  if (!allowContract && !stored.mustChangePassword && needsContract(stored)) {
    return <Navigate to="/contratar" />;
  }

  // Contratou direto (sem trial) e ainda não pagou: a conta existe, mas o app
  // só abre quando o webhook do Asaas confirmar. Sem esta guarda o usuário
  // entraria e levaria 403 em toda chamada — telas vazias sem explicação.
  // Vem antes do bloqueio por inadimplência: são coisas diferentes, e esta é
  // a que se aplica a quem nunca chegou a pagar.
  if (!allowBlocked && stored.subscriptionStatus === "pending_payment") {
    return <Navigate to="/pagamento-pendente" />;
  }

  // Inadimplência: passada a carência de 10 dias, tranca tudo até regularizar.
  if (!allowBlocked && stored.accessState === "blocked") {
    return <Navigate to="/acesso-bloqueado" />;
  }

  return children;
}

// Conta nova (pós-corte), sem assinatura e que não é demo → precisa contratar.
// Exportada porque a tela de troca de senha decide o destino com a MESMA regra:
// duplicá-la lá faria as duas divergirem no dia em que o corte mudasse.
export function needsContract(user) {
  if (user.subscriptionStatus) return false;        // já contratou
  if (user.demoExpiresAt) return false;             // conta demo: fluxo próprio
  if (!user.createdAt) return false;                // sem data → trata como legado
  return new Date(user.createdAt) >= CONTRACT_GATE_CUTOFF;
}
