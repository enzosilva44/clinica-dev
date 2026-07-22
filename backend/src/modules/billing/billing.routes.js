import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import {
  createCharge, listCharges, getCharge, cancelCharge, simulatePayment,
  getBalance, createTransfer, listTransfers,
  saveConfig, getConfig, handleWebhook, sendPaymentLink,
  createSubaccount, syncIasopayWallet, getIasopayWalletId,
} from "./billing.service.js";
import { contratar } from "./contract.service.js";
import { getUsage } from "./quota.service.js";
import { createTopupCharge } from "./usage.service.js";

const router = Router();

// webhook — sem authMiddleware (chamado pelo Asaas), mas validado pelo token
// que o Asaas envia no header `asaas-access-token`. Se ASAAS_WEBHOOK_TOKEN
// estiver configurado e o header não bater, rejeita (401). Se não estiver
// configurado, aceita (não quebra caso o token ainda não tenha sido setado).
router.post("/webhook", async (req, res) => {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expected && req.headers["asaas-access-token"] !== expected) {
    console.warn("[webhook] rejeitado: asaas-access-token ausente ou inválido.");
    return res.status(401).json({ error: "invalid webhook token" });
  }
  try {
    await handleWebhook(req.body);
    res.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e.message);
    res.status(200).json({ received: true }); // sempre 200 para o Asaas não retentar
  }
});

// ── contratação self-service (mensalidade Iaso → clínica) ───────────────────────
// Fica ANTES do requireFeature: contas demo (plano Solo) não têm "faturamento",
// mas precisam poder contratar. Só exige estar autenticado.
router.post("/contratar", authMiddleware, async (req, res) => {
  try {
    const u = await contratar(req.user.id, req.body);
    // devolve só os campos públicos (nunca o password hash)
    res.json({
      user: {
        id: u.id, name: u.name, email: u.email, role: u.role,
        plan: u.plan, nickname: u.nickname, clinicName: u.clinicName,
        featureOverrides: u.featureOverrides ?? {}, avatarUrl: u.avatarUrl,
        demoExpiresAt: u.demoExpiresAt ?? null,
      },
    });
  } catch (e) {
    console.error("[/billing/contratar]", e.message);
    res.status(400).json({ error: e.message });
  }
});

// ── cotas de uso (todos os planos têm; NÃO exige faturamento) ───────────────────
// Medidor de consumo (IA/WhatsApp/…) para o app e para o painel admin.
router.get("/usage", authMiddleware, async (req, res) => {
  try {
    const usage = await getUsage(req.user.id);
    res.json(usage);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Compra de top-up avulso (gera cobrança PIX na conta RAIZ da Iaso; crédito no webhook).
router.post("/usage/topup", authMiddleware, async (req, res) => {
  try {
    const { resource, pack } = req.body;
    if (!resource || !pack) return res.status(400).json({ error: "resource e pack são obrigatórios." });
    const result = await createTopupCharge(req.user.id, resource, pack);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── IASOPay (plataforma / admin) ────────────────────────────────────────────────
// walletId da conta RAIZ que recebe a comissão do Split. Operação de plataforma:
// exige ADMIN, fora do escopo de "faturamento" (que é por clínica).
router.get("/iasopay-wallet", authMiddleware, async (req, res) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado." });
  try {
    const walletId = await getIasopayWalletId();
    res.json({ walletId, configured: !!walletId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/iasopay-wallet/sync", authMiddleware, async (req, res) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado." });
  try {
    const result = await syncIasopayWallet(req.user?.name ?? "Admin");
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
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
  } catch (e) {
    if (e?.name === "QuotaExceededError") {
      return res.status(402).json({
        error: "Sua cota de mensagens de WhatsApp deste mês acabou.",
        resource: "whatsapp", reason: "quota_exceeded",
      });
    }
    res.status(400).json({ error: e.message });
  }
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
    const result = await createSubaccount(req.user.id, { incomeValue: req.body?.incomeValue });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
