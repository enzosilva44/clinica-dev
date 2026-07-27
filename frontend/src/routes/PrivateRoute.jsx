import { Navigate } from "react-router-dom";

// Corte da regra de contratação obrigatória. Contas criadas ANTES desta data
// (legadas) passam livres mesmo sem assinatura; a partir dela, todo cadastro
// novo precisa concluir /contratar antes de usar o sistema.
const CONTRACT_GATE_CUTOFF = new Date("2026-07-27T00:00:00Z");

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

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("user") || "{}"); } catch { stored = {}; }

  // 1º acesso: se precisa trocar a senha, bloqueia o resto do app até trocar.
  if (!allowPasswordChange && stored.mustChangePassword) {
    return <Navigate to="/trocar-senha" />;
  }

  // Contratação obrigatória (só contas novas): sem assinatura ativa, manda para
  // /contratar. Demos (que exploram antes de contratar) e legados ficam de fora.
  if (!allowContract && needsContract(stored)) {
    return <Navigate to="/contratar" />;
  }

  // Inadimplência: passada a carência de 10 dias, tranca tudo até regularizar.
  if (!allowBlocked && stored.accessState === "blocked") {
    return <Navigate to="/acesso-bloqueado" />;
  }

  return children;
}

// Conta nova (pós-corte), sem assinatura e que não é demo → precisa contratar.
function needsContract(user) {
  if (user.subscriptionStatus) return false;        // já contratou
  if (user.demoExpiresAt) return false;             // conta demo: fluxo próprio
  if (!user.createdAt) return false;                // sem data → trata como legado
  return new Date(user.createdAt) >= CONTRACT_GATE_CUTOFF;
}
