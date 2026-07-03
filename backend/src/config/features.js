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
    whatsapp: false,
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
