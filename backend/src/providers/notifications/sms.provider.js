/**
 * SMS Provider — stub para integração futura
 * Integrar com: Twilio, Zenvia, TotalVoice, etc.
 */
export async function sendSmsOtp(phone, _code, _documentName) {
  console.warn(`[OTP SMS] Provedor não configurado. Número: ${phone}`);
  throw new Error("Envio por SMS indisponível. Use outro método de validação.");
}
