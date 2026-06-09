import { sendWhatsAppMessage } from "../../modules/whatsapp/whatsapp.provider.js";
import { prisma } from "../../config/prisma.js";

export async function sendWhatsappOtp(phone, code, documentName, clinicUserId) {
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  // Credenciais da clínica têm prioridade sobre as variáveis de ambiente
  if (clinicUserId) {
    const user = await prisma.user.findUnique({
      where: { id: clinicUserId },
      select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
    });
    if (user?.whatsappPhoneNumberId) phoneNumberId = user.whatsappPhoneNumberId;
    if (user?.whatsappAccessToken)   accessToken   = user.whatsappAccessToken;
  }

  if (!phoneNumberId || !accessToken) {
    console.warn(`[OTP WhatsApp] WhatsApp não configurado. Número: ${phone} | Código: ${code}`);
    return;
  }

  const message = `*${code}* — Seu código para assinar o documento "${documentName}" no Iasoclin.\n\nEste código expira em 10 minutos. Não compartilhe com ninguém.`;
  await sendWhatsAppMessage(phone, message, { phoneNumberId, accessToken });
}
