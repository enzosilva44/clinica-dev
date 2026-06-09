import { sendEmailOtp }     from "./email.provider.js";
import { sendSmsOtp }       from "./sms.provider.js";
import { sendWhatsappOtp }  from "./whatsapp.provider.js";

export async function sendOtp(method, target, code, documentName, clinicUserId) {
  switch (method) {
    case "email":     return sendEmailOtp(target, code, documentName);
    case "sms":       return sendSmsOtp(target, code, documentName);
    case "whatsapp":  return sendWhatsappOtp(target, code, documentName, clinicUserId);
    default:          throw new Error(`Método OTP desconhecido: ${method}`);
  }
}
