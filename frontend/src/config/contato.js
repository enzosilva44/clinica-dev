// Fonte ÚNICA do canal de contato da IASO.
//
// Todo "Falar no WhatsApp" do sistema aponta para cá. Antes cada tela lia
// VITE_WHATSAPP_COMMERCIAL por conta própria e a landing tinha o número
// escrito à mão — o resultado era o .env apontando para um número antigo
// enquanto a landing usava o certo.
//
// A env continua sendo respeitada (permite trocar sem novo deploy), mas o
// padrão embutido é o número oficial de suporte: nenhuma tela fica sem botão
// por falta de configuração.

export const WHATSAPP_SUPORTE = (
  import.meta.env.VITE_WHATSAPP_COMMERCIAL || "5511930779474"
).replace(/\D/g, "");

// +55 11 93077-9474 — para exibir em texto
export const WHATSAPP_SUPORTE_LABEL = "+55 11 93077-9474";

// Monta o link do WhatsApp com uma mensagem já preenchida.
export function whatsappHref(mensagem) {
  const base = `https://wa.me/${WHATSAPP_SUPORTE}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
