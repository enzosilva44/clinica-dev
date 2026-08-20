# Migração RDS — Clube × Financeiro

Campo novo no model `Transaction` (schema.prisma): `clubMemberId String?`,
com relação para `ClubMember` (`onDelete: SetNull`) e `@@index([clubMemberId])`.

Nullable → mudança **aditiva e segura**: linhas existentes ficam com `NULL` e
seguem funcionando. Adesões do Clube feitas antes desta migração continuam sem
vínculo (a tela do Clube mostra "—" na coluna Financeiro para elas); só as novas
nascem ligadas.

Por que existe: a venda do plano já lançava a solicitação no Financeiro, mas o
único vínculo era o texto da descrição (`"Clube: <plano> — <paciente>"`). Sem
campo, o Clube não tinha como mostrar se aquele pedido já foi liquidado — e a
baixa continua sendo dada no Financeiro, à mão.

## Já aplicado
- [ ] Neon local (`db push`)

## Pendente — PRODUÇÃO (RDS) — só com autorização do Enzo
Local usa Neon, prod usa RDS: `db push` local NÃO toca o RDS. Aplicar à mão na
EC2 APÓS o deploy.

### 1. Snapshot manual do RDS ANTES (regra obrigatória)
```bash
aws rds create-db-snapshot \
  --db-instance-identifier <ID_DA_INSTANCIA_RDS> \
  --db-snapshot-identifier clube-financeiro-$(date +%Y%m%d-%H%M)
# aguardar status "available" antes de prosseguir
```

### 2. Aplicar schema na EC2 (após deploy do código)
```bash
cd /caminho/do/backend
node node_modules/prisma/build/index.js db push --skip-generate
```
