import { prisma } from "../../config/prisma.js";

export const IOS_ORGANIZATION_SLUG = "iaso";
const DEFAULT_OWNER_EMAIL = "enzo.silva@codebit.com.br";

function allowedEmails() {
  return (process.env.IOS_OWNER_EMAIL || DEFAULT_OWNER_EMAIL)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireIosOwner(req, res, next) {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    const allowed = actor?.role === "ADMIN"
      && allowedEmails().includes(actor.email.toLowerCase());

    if (!allowed) {
      return res.status(403).json({
        error: "O IASO Operating System está restrito ao proprietário.",
        code: "IOS_ACCESS_DENIED",
      });
    }

    const organization = await prisma.iosOrganization.findUnique({
      where: { slug: IOS_ORGANIZATION_SLUG },
    });
    const membership = organization
      ? await prisma.iosMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: actor.id,
            },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : null;

    req.ios = { actor, organization, membership };
    next();
  } catch (error) {
    next(error);
  }
}
