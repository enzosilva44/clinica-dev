/**
 * WhatsApp OTP Provider — usa Meta Cloud API quando configurada
 */
import { sendWhatsAppMessage } from "../../modules/whatsapp/whatsapp.provider.js";

export async function sendWhatsappOtp(phone, code, documentName) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(`[OTP WhatsApp] WhatsApp não configurado. Número: ${phone} | Código: ${code}`);
    return;
  }

  const message = `*${code}* — Seu código para assinar o documento "${documentName}" no Iasoclin.\n\nEste código expira em 10 minutos. Não compartilhe com ninguém.`;
  await sendWhatsAppMessage(phone, message, { phoneNumberId, accessToken });
}
