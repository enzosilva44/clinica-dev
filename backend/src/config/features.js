const ALL_FEATURES = {
  multiProfessional: true,
  whatsapp: true,
  faturamento: true,
  clube: true,
  aiSummary: true,
  aiAssistant: true,
  documents: true,
  signatures: true,
  procedureMap: true,
  stock: true,
  financial: true,
  analytics: true,
  agenda: true,
  patients: true,
  portfolio: true,
};

const PLAN_FEATURES = {
  dev: ALL_FEATURES,
  enterprise: ALL_FEATURES,
  solo: {
    multiProfessional: false,
    // WhatsApp NÃO é definido pelo plano: quem libera ou corta é a feature na
    // tela de admin (featureOverrides). O plano só define o default de partida,
    // e o default é ligado — desligar é decisão explícita por clínica.
    whatsapp: true,
    faturamento: false,
    clube: false,
    aiSummary: true,
    aiAssistant: true,
    documents: true,
    signatures: true,
    procedureMap: true,
    stock: true,
    financial: true,
    analytics: true,
    agenda: true,
    patients: true,
    portfolio: true,
  },
  clinica: {
    multiProfessional: true,
    whatsapp: true,
    faturamento: true,
    clube: true,
    aiSummary: true,
    aiAssistant: true,
    documents: true,
    signatures: true,
    procedureMap: true,
    stock: true,
    financial: true,
    analytics: true,
    agenda: true,
    patients: true,
    portfolio: true,
  },
};

// Demo herda as features do plano Solo; ajustes finos são feitos por featureOverrides.
PLAN_FEATURES.demo = PLAN_FEATURES.solo;

export function getFeatures(plan) {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.solo;
}
