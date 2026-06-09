/**
 * SMS Provider — stub para integração futura
 * Integrar com: Twilio, Zenvia, TotalVoice, etc.
 */
export async function sendSmsOtp(phone, code, _documentName) {
  console.warn(`[OTP SMS] Provedor não configurado. Número: ${phone} | Código: ${code}`);
}
