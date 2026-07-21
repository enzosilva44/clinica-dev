# Migração RDS — Ciclo de vida self-service

Campos novos adicionados ao model `User` (schema.prisma):
`asaasSubscriptionId`, `demoExpiresAt`, `leadSource`, `acquisitionChannel`,
`lgpdAcceptedAt`, `lgpdVersion`, `contractAcceptedAt`, `contractVersion`.

Todos são **opcionais/nullable** → mudança aditiva e segura (não quebra linhas existentes).

## Já aplicado
- [x] Neon local (`db push` OK)

## Pendente — PRODUÇÃO (RDS) — só com autorização do Enzo
Local usa Neon, prod usa RDS: `db push` local NÃO toca o RDS. Aplicar à mão na EC2 APÓS o deploy.

### 1. Snapshot manual do RDS ANTES (regra obrigatória)
```bash
aws rds create-db-snapshot \
  --db-instance-identifier <ID_DA_INSTANCIA_RDS> \
  --db-snapshot-identifier ciclo-vida-selfservice-$(date +%Y%m%d-%H%M)
# aguardar status "available" antes de prosseguir
```

### 2. Aplicar schema na EC2 (após deploy do código)
```bash
cd /caminho/do/backend
node node_modules/prisma/build/index.js db push --skip-generate
```
