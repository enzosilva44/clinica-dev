const DEFAULT_FOLDERS = ["Sanitária", "Documentos para assinatura"];

// Cria as pastas fixas (isDefault=true) para um usuário, pulando as que já existirem.
export async function seedDefaultFolders(prisma, userId) {
  const existing = await prisma.documentFolder.findMany({
    where: { userId },
    select: { name: true },
  });
  const have = new Set(existing.map((f) => f.name.trim().toLowerCase()));
  const toCreate = DEFAULT_FOLDERS.filter((name) => !have.has(name.trim().toLowerCase()));
  if (toCreate.length === 0) return { created: 0 };
  await prisma.documentFolder.createMany({
    data: toCreate.map((name) => ({ name, userId, isDefault: true })),
  });
  return { created: toCreate.length };
}
