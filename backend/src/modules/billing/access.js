// Regra única de acesso por situação de pagamento da assinatura SaaS.
// Usada pelo middleware (bloqueio) e pelo publicUser (frontend mostra aviso/tela).
//
// Fluxo: trialing/active → acesso normal. Ao vencer, o webhook grava
// overdueSince e status=past_due. A clínica ainda acessa por GRACE_DAYS dias
// (com aviso). Passado esse prazo, o acesso é bloqueado até regularizar.

export const GRACE_DAYS = 10; // dias de carência após o vencimento antes de bloquear

// Retorna o estado de acesso derivado do user.
//   state:      "ok" | "grace" | "blocked"
//   daysLeft:   dias restantes de carência (só em "grace")
//   overdue:    boolean — há atraso em aberto (grace OU blocked)
export function accessState(user) {
  const status = user?.subscriptionStatus;
  const overdueSince = user?.overdueSince ? new Date(user.overdueSince) : null;

  // Sem atraso registrado: acesso liberado (trialing, active, sem assinatura, ADMIN…).
  if (!overdueSince || (status !== "past_due" && status !== "suspended")) {
    return { state: "ok", daysLeft: null, overdue: false };
  }

  const msPerDay = 86_400_000;
  const elapsed = Math.floor((Date.now() - overdueSince.getTime()) / msPerDay);
  const daysLeft = GRACE_DAYS - elapsed;

  if (daysLeft > 0) return { state: "grace", daysLeft, overdue: true };
  return { state: "blocked", daysLeft: 0, overdue: true };
}
