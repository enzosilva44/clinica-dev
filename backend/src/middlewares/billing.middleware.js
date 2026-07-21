import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { accessState } from "../modules/billing/access.js";

// Prefixos que DEVEM funcionar mesmo com o acesso bloqueado: autenticar,
// regularizar o pagamento e ver/editar o perfil. O resto do app é barrado.
const ALLOWED_PREFIXES = ["/auth", "/billing", "/profile", "/uploads", "/health"];

// Middleware GLOBAL de bloqueio por inadimplência. Montado uma única vez em
// app.js, antes das rotas de negócio. Decodifica o token de forma tolerante
// (sem token → segue; o auth de cada rota é quem barra o não-autenticado).
// Só bloqueia quando o atraso passou da carência (accessState === "blocked").
// ADMIN nunca é bloqueado.
export async function blockOverdue(req, res, next) {
  try {
    if (ALLOWED_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"))) {
      return next();
    }

    const auth = req.headers.authorization;
    if (!auth) return next(); // sem token: deixa o authMiddleware da rota tratar

    let decoded;
    try { decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET); }
    catch { return next(); } // token inválido: idem
    if (decoded?.role === "ADMIN") return next();

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, subscriptionStatus: true, overdueSince: true },
    });
    if (!user || user.role === "ADMIN") return next();

    if (accessState(user).state === "blocked") {
      return res.status(403).json({
        error: "Acesso suspenso por falta de pagamento.",
        code: "SUBSCRIPTION_BLOCKED",
      });
    }

    next();
  } catch (error) {
    return next(); // fail-open: um erro aqui não pode derrubar o app inteiro
  }
}
