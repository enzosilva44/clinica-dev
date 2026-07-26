import { sanitizeError } from "../../shared/errors/sanitizeError.js";

export class IosError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "IosError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assertIos(condition, status, code, message, details) {
  if (!condition) throw new IosError(status, code, message, details);
}

export function asyncIosRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function iosErrorMiddleware(error, _req, res, _next) {
  if (error instanceof IosError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  const prismaStatus = error?.code === "P2002"
    ? 409
    : error?.code === "P2025"
      ? 404
      : error?.code === "P2003"
        ? 409
        : null;

  return res.status(prismaStatus ?? 500).json({
    error: sanitizeError(error),
    code: prismaStatus ? `PRISMA_${error.code}` : "IOS_INTERNAL_ERROR",
  });
}
