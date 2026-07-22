// Registry de recursos MEDIDOS por cota (camada de consumo, paralela a features.js
// que trata só acesso booleano). Recurso é string livre — adicionar aqui cria um
// recurso novo sem migração de schema.
//
//   mode:   "count" → 1 unidade por evento (IA, WhatsApp, documentos)
//           "size"  → soma grandeza acumulada por evento (storage em MB)
//   active: true    → consumeQuota debita e pode bloquear
//           false   → pré-declarado (aparece no /usage) mas nunca debita/bloqueia
export const QUOTA_RESOURCES = {
  ai:        { label: "Ações de IA",            unit: "ação",      mode: "count", active: true  },
  whatsapp:  { label: "Mensagens WhatsApp",     unit: "mensagem",  mode: "count", active: true  },
  // Pré-declarados — choke-point já mapeado, débito fica pra fase 2:
  documents: { label: "Documentos/Assinaturas", unit: "documento", mode: "count", active: false },
  storage:   { label: "Armazenamento",          unit: "MB",        mode: "size",  active: false },
};

// Limite por plano e por recurso. Recurso ausente no plano ⇒ ILIMITADO (não bloqueia).
// documents/storage: definir quando ativar (fase 2).
const PLAN_QUOTAS = {
  essencial:    { ai: 150,  whatsapp: 300  },
  profissional: { ai: 600,  whatsapp: 1000 },
  clinica:      { ai: 2000, whatsapp: 3000 },
  // Planos internos/legados sem cota:
  dev:          {}, // ilimitado
  enterprise:   {}, // ilimitado
};

// Planos legados do features.js que ainda existem no banco:
PLAN_QUOTAS.solo = PLAN_QUOTAS.essencial; // solo herda essencial
PLAN_QUOTAS.demo = PLAN_QUOTAS.essencial;
PLAN_QUOTAS.clinica = PLAN_QUOTAS.clinica;

export function getQuotas(plan) {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.essencial;
}

// Limite de um recurso para um plano. null = ilimitado.
export function getResourceLimit(plan, resource) {
  const q = getQuotas(plan);
  return Object.prototype.hasOwnProperty.call(q, resource) ? q[resource] : null;
}

export function isResourceActive(resource) {
  return QUOTA_RESOURCES[resource]?.active === true;
}

// Pacotes de top-up avulso vendidos via Asaas. amount = unidades creditadas.
export const TOPUP_PACKS = {
  ai: {
    ai_100: { label: "+100 ações de IA", resource: "ai",       amount: 100, price: 15.0 },
  },
  whatsapp: {
    wa_200: { label: "+200 mensagens",   resource: "whatsapp", amount: 200, price: 20.0 },
  },
};

export function getTopupPack(resource, packId) {
  return TOPUP_PACKS[resource]?.[packId] ?? null;
}
