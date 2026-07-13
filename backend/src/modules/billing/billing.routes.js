import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import {
  createCharge, listCharges, getCharge, cancelCharge, simulatePayment,
  getBalance, createTransfer, listTransfers,
  saveConfig, getConfig, handleWebhook, sendPaymentLink,
  createSubaccount,
} from "./billing.service.js";

const router = Router();

// webhook — sem auth (chamado pelo Asaas)
router.post("/webhook", async (req, res) => {
  try {
    await handleWebhook(req.body);
    res.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e.message);
    res.status(200).json({ received: true }); // sempre 200 para o Asaas não retentar
  }
});

router.use(authMiddleware, requireFeature("faturamento"));

// ── cobranças ──────────────────────────────────────────────────────────────────
router.get("/charges", async (req, res) => {
  try {
    const result = await listCharges(req.user.id, req.query);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/charges", async (req, res) => {
  try {
    const charge = await createCharge(req.user.id, req.body);
    res.json(charge);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/charges/:id", async (req, res) => {
  try {
    const charge = await getCharge(req.user.id, req.params.id);
    res.json(charge);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/charges/:id", async (req, res) => {
  try {
    await cancelCharge(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/charges/:id/simulate", async (req, res) => {
  try {
    const result = await simulatePayment(req.user.id, req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/charges/:id/send-link", async (req, res) => {
  try {
    const result = await sendPaymentLink(req.user.id, req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── saldo & transferências ─────────────────────────────────────────────────────
router.get("/balance", async (req, res) => {
  try {
    const balance = await getBalance(req.user.id);
    res.json(balance);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/transfer", async (req, res) => {
  try {
    const transfer = await createTransfer(req.user.id, req.body);
    res.json(transfer);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/transfers", async (req, res) => {
  try {
    const result = await listTransfers(req.user.id);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── configuração ───────────────────────────────────────────────────────────────
router.get("/config", async (req, res) => {
  try {
    const config = await getConfig(req.user.id);
    res.json(config);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/config", async (req, res) => {
  try {
    const result = await saveConfig(req.user.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── IASOPay: ativar (cria subconta Asaas para a clínica) ────────────────────────
router.post("/subaccount", async (req, res) => {
  try {
    const result = await createSubaccount(req.user.id);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
