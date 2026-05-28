// WhatsApp provider abstraction — swap implementation here when API is chosen.
// Currently: mock that logs to console and returns success.

export async function sendWhatsAppMessage(phone, message) {
  const normalized = phone.replace(/\D/g, "");
  console.log(`[WhatsApp MOCK] → ${normalized}: ${message.slice(0, 80)}…`);
  return { success: true, phone: normalized, mock: true };
}
