const ALL_FEATURES = {
  multiProfessional: true,
  whatsapp:          true,
  faturamento:       true,
  clube:             true,
  aiSummary:         true,
  aiAssistant:       true,
  documents:         true,
  signatures:        true,
  procedureMap:      true,
  stock:             true,
  financial:         true,
  analytics:         true,
  agenda:            true,
  patients:          true,
};

const PLAN_FEATURES = {
  dev:        ALL_FEATURES,
  enterprise: ALL_FEATURES,
  solo: {
    multiProfessional: false,
    whatsapp:          false,
    faturamento:       false,
    clube:             false,
    aiSummary:         true,
    aiAssistant:       true,
    documents:         true,
    signatures:        true,
    procedureMap:      true,
    stock:             true,
    financial:         true,
    analytics:         true,
    agenda:            true,
    patients:          true,
  },
  clinica: {
    multiProfessional: false,
    whatsapp:          true,
    faturamento:       true,
    clube:             true,
    aiSummary:         true,
    aiAssistant:       true,
    documents:         true,
    signatures:        true,
    procedureMap:      true,
    stock:             true,
    financial:         true,
    analytics:         true,
    agenda:            true,
    patients:          true,
  },
};

PLAN_FEATURES.demo = PLAN_FEATURES.solo;

export function getFeatures(plan) {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.solo;
}
