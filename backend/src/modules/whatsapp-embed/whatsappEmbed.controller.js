import {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
} from "./whatsappEmbed.service.js";

export async function connect(req, res) {
  try {
    const { code, wabaId, phoneNumberId } = req.body;
    const result = await connectWhatsApp(req.user.id, { code, wabaId, phoneNumberId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function status(req, res) {
  const result = await getWhatsAppStatus(req.user.id);
  res.json(result);
}

export async function disconnect(req, res) {
  const result = await disconnectWhatsApp(req.user.id);
  res.json(result);
}
