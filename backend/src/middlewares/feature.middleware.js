import { prisma } from "../config/prisma.js";
import { getFeatures } from "../config/features.js";

export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (req.user?.role === "ADMIN") return next();

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          plan: true,
          featureOverrides: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado." });
      }

      if (user.role === "ADMIN") return next();

      const features = {
        ...getFeatures(user.plan),
        ...(user.featureOverrides ?? {}),
      };

      if (!features[featureKey]) {
        return res.status(403).json({
          error: "Recurso não disponível no plano atual.",
          feature: featureKey,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: "Erro ao validar permissão de feature." });
    }
  };
}
