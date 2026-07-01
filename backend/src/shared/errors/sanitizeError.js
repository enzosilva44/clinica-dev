// Converte qualquer erro em uma mensagem segura para o cliente.
// Erros do Prisma viram mensagens genéricas (não vazam schema/stack);
// erros de negócio (new Error("...")) mantêm a mensagem.

const PRISMA_NAMES = new Set([
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
]);

function isPrisma(err) {
  if (!err) return false;
  if (PRISMA_NAMES.has(err.name)) return true;
  if (typeof err.message === "string" && err.message.includes("prisma.")) return true;
  return typeof err.code === "string" && /^P\d{4}$/.test(err.code);
}

export function sanitizeError(err) {
  if (isPrisma(err)) {
    switch (err.code) {
      case "P2002": return "Registro duplicado: já existe um item com esses dados.";
      case "P2025": return "Registro não encontrado.";
      case "P2003": return "Referência inválida: registro relacionado não existe.";
      default:      return "Dados inválidos. Verifique as informações enviadas.";
    }
  }
  return err?.message || "Erro ao processar a solicitação.";
}
