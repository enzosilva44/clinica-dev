import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  listTickets,
  getTicket,
  markTicketRead,
  claimTicket,
  transferTicket,
  resolveTicket,
  reopenTicket,
  addInternalNote,
  ensureDepartments,
} from "./support.service.js";
import { prisma } from "../../config/prisma.js";

// Central de atendimento da própria IASO. Consumido pelo admin-app (gateway),
// nunca pelo app das clínicas — quem atende aqui é a equipe interna.
const router = Router();
router.use(authMiddleware);

// Convivem dois formatos de token no projeto: auth.controller assina `id` e
// auth.service assina `userId`. Ler só um deixaria metade dos logins sem ator.
function actorId(req) {
  return req.user?.id ?? req.user?.userId ?? null;
}

// Filas por status: alimenta os contadores da coluna da esquerda numa só ida.
// Também agrupa por departamento × status, para responder "o que passou pelo
// Comercial" — inclusive o que já foi resolvido, que é o histórico do setor.
router.get("/overview", async (_req, res, next) => {
  try {
    const [porStatus, porDept, departments] = await Promise.all([
      prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ["departmentId", "status"], _count: { _all: true } }),
      ensureDepartments(),
    ]);

    const counts = porStatus.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {});

    // { [departmentId]: { total, abertos, resolvidos, porStatus: {...} } }
    // `abertos` = tudo que ainda pede ação; resolvido/encerrado saem da conta.
    const byDepartment = {};
    for (const g of porDept) {
      const key = g.departmentId ?? "sem_departamento"; // triagem ainda não tem setor
      const n = g._count._all;
      const atual = byDepartment[key] ?? { total: 0, abertos: 0, resolvidos: 0, porStatus: {} };
      atual.total += n;
      atual.porStatus[g.status] = (atual.porStatus[g.status] ?? 0) + n;
      if (g.status === "resolvido" || g.status === "encerrado") atual.resolvidos += n;
      else atual.abertos += n;
      byDepartment[key] = atual;
    }

    return res.json({ counts, byDepartment, departments });
  } catch (err) {
    return next(err);
  }
});

router.get("/departments", async (_req, res, next) => {
  try {
    return res.json(await ensureDepartments());
  } catch (err) {
    return next(err);
  }
});

router.get("/tickets", async (req, res, next) => {
  try {
    const { status, departmentId, assigneeId, page, limit } = req.query;
    return res.json(await listTickets({ status, departmentId, assigneeId, page, limit }));
  } catch (err) {
    return next(err);
  }
});

router.get("/tickets/:id", async (req, res, next) => {
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Chamado não encontrado." });
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
});

router.post("/tickets/:id/read", async (req, res, next) => {
  try {
    return res.json(await markTicketRead(req.params.id));
  } catch (err) {
    return next(err);
  }
});

// Disputa de atribuição é resolvida no service (updateMany atômico): aqui só
// traduzimos o "alguém chegou antes" em 409, que a tela mostra como aviso.
router.post("/tickets/:id/claim", async (req, res, next) => {
  try {
    const result = await claimTicket(req.params.id, actorId(req));
    if (!result.ok) {
      return res.status(409).json({ error: "Outro atendente assumiu este chamado primeiro.", ...result });
    }
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post("/tickets/:id/transfer", async (req, res, next) => {
  try {
    const { toUserId, toDeptId, note } = req.body ?? {};
    const result = await transferTicket({
      ticketId: req.params.id,
      toUserId,
      toDeptId,
      actorId: actorId(req),
      note,
    });
    if (!result.ok) return res.status(404).json({ error: "Chamado não encontrado." });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post("/tickets/:id/resolve", async (req, res, next) => {
  try {
    const { reason } = req.body ?? {};
    return res.json(await resolveTicket({ ticketId: req.params.id, actorId: actorId(req), reason }));
  } catch (err) {
    return next(err);
  }
});

router.post("/tickets/:id/reopen", async (req, res, next) => {
  try {
    return res.json(await reopenTicket({ ticketId: req.params.id, actorId: actorId(req) }));
  } catch (err) {
    return next(err);
  }
});

// Nota interna nunca sai para a Meta — é o que a equipe escreve para si mesma.
// Por isso funciona mesmo sem o número de suporte registrado na Cloud API.
router.post("/tickets/:id/notes", async (req, res, next) => {
  try {
    const text = (req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Escreva a nota antes de salvar." });
    return res.json(await addInternalNote({ ticketId: req.params.id, text, authorId: actorId(req) }));
  } catch (err) {
    return next(err);
  }
});

export default router;
