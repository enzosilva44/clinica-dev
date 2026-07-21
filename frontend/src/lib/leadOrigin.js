// Captura e persiste a origem do lead (UTM / canal de aquisição) para propagar
// ao criar conta demo ou conta real. Guarda em sessionStorage para sobreviver
// à navegação entre landing → demo → wizard de contratação.

const KEY = "iaso_lead_origin";

// Mapeia utm_source/medium/campaign para o canal de aquisição do CRM:
// ads | influencer | cupom. Fallback: valor bruto do utm_source.
function inferChannel(params) {
  const source = (params.utm_source || "").toLowerCase();
  const medium = (params.utm_medium || "").toLowerCase();
  if (params.cupom || params.coupon || medium === "cupom") return "cupom";
  if (medium === "influencer" || source === "influencer" || params.inf) return "influencer";
  if (["ads", "cpc", "paid", "google", "meta", "facebook", "instagram"].includes(medium) ||
      ["ads", "google", "meta", "facebook"].includes(source)) return "ads";
  return source || null;
}

// Lê a querystring atual e persiste a origem, se houver algo relevante.
// Chame no mount da landing/captação.
export function captureLeadOrigin(search = window.location.search) {
  const params = Object.fromEntries(new URLSearchParams(search));
  const hasSignal = ["utm_source", "utm_medium", "utm_campaign", "cupom", "coupon", "inf"]
    .some((k) => params[k]);
  if (!hasSignal) return getLeadOrigin();

  const origin = {
    acquisitionChannel: inferChannel(params),
    utm: {
      source: params.utm_source || null,
      medium: params.utm_medium || null,
      campaign: params.utm_campaign || null,
      coupon: params.cupom || params.coupon || null,
    },
    capturedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(KEY, JSON.stringify(origin));
  return origin;
}

export function getLeadOrigin() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}
