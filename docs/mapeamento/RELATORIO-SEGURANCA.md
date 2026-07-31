# Auditoria de Segurança — Iasoclin

**Data:** 2026-07-30
**Escopo:** repositório `clinica-app` (backend + frontend), branch `main`.
**Método:** varredura de segredos (working tree + histórico git), cobertura de autenticação rota a rota, isolamento multi-tenant, validação de entrada, dependências (`npm audit`), configuração de infraestrutura.

> **Nota de escopo:** esta é uma auditoria de **código estático**. Não houve teste de penetração, análise dinâmica, nem revisão de Security Groups/IAM na AWS. Itens marcados **EXIGE VALIDAÇÃO** precisam de verificação no console AWS ou em runtime.

---

## Resumo executivo

**Postura geral: melhor do que o esperado nos fundamentos, com lacunas graves em proteção de perímetro.**

O que está sólido (e merece registro, porque é onde a maioria dos projetos falha):

- ✅ **Nenhum segredo versionado** — `.gitignore` correto, nenhum `.env` rastreado, **nenhum segredo no histórico do git**
- ✅ **Nenhuma credencial hardcoded** no código
- ✅ **Nenhum fallback inseguro** do tipo `process.env.JWT_SECRET || "dev"`
- ✅ **Isolamento multi-tenant consistente** — `where: { userId }` aplicado sistematicamente
- ✅ **Rotas de arquivo protegidas** — JWT + filtro por dono (corrigindo suspeita do mapeamento anterior)
- ✅ **Uploads validados** — `fileFilter` por MIME + limite de tamanho (15/20 MB)
- ✅ **Webhook da Meta com HMAC SHA256** sobre o corpo bruto

### Achados por severidade

| Severidade | Qtd |
|---|---|
| Crítica | 4 |
| Alta | 5 |
| Média | 7 |
| Baixa | 5 |

### Os quatro críticos

| # | Achado | Por quê |
|---|---|---|
| SEC-01 | Sem rate limiting em lugar nenhum | Força bruta em `/auth/login`, enumeração de OTP, abuso de custo na API de IA |
| SEC-02 | Webhook Asaas aceita tudo se `ASAAS_WEBHOOK_TOKEN` não estiver setado | Terceiro forja confirmação de pagamento |
| SEC-03 | `/admin/*` sem `authorize(['ADMIN'])` no mount | Depende de cada handler lembrar do check |
| SEC-04 | Vazamento multi-tenant em `resolvePatientId()` | Clínica A pode vincular transação a paciente da clínica B |

---

## 1. Gestão de segredos — ✅ APROVADO

| Verificação | Resultado |
|---|---|
| `.env` rastreado pelo git | ❌ Nenhum (só `.env.example`) |
| Segredo no histórico do git | ❌ Nenhum — verificado com `git log --all --diff-filter=A` |
| Chave hardcoded (`sk-`, `$aact_`, `EAA`, `AKIA`, PEM) | ❌ Nenhuma (único match é placeholder de UI) |
| Fallback inseguro em segredo | ❌ Nenhum |
| `.gitignore` cobre `.env`, `.env.*` | ✅ Sim, com exceção correta para `.env.example` |

**Este é o ponto mais forte do projeto.** Vazamento de credencial em repositório é a causa raiz mais comum de incidente, e aqui está limpo — inclusive no histórico, o que costuma ser onde o esqueleto aparece.

### Ressalvas que permanecem

| ID | Achado | Severidade | Ação |
|---|---|---|---|
| SEC-05 | `APP_SECRET` do WhatsApp marcado como "a rotacionar" na memória do projeto (sessão 2026-07-29) | **Alta** | Rotacionar no painel da Meta e atualizar no CodeBuild |
| SEC-06 | Token do webhook Asaas foi exposto em sessão anterior (memória: "webhook token EXPOSTO→rotacionar") | **Alta** | Rotacionar |
| SEC-07 | Chave `clinica-app.pem` (SSH da EC2) em `~/Downloads` | **Média** | Mover para `~/.ssh/` com `chmod 400` |
| SEC-08 | Segredos vivem em texto plano no `.env` da EC2, escritos pelo `gen-env.sh` | **Média** | Migrar para AWS Secrets Manager ou SSM Parameter Store |

---

## 2. Autenticação e autorização

### Cobertura de autenticação — ✅ boa

Auditei os 30 módulos montados. Resultado:

- **13 módulos** usam `router.use(authMiddleware)` — proteção por padrão, não se esquece
- **`auth`** sem auth (correto — são as rotas de login)
- **`documents`, `photos`** — proteção por rota, todas cobertas (verificado uma a uma)
- **`billing`, `conversations`** — `router.use(authMiddleware, requireFeature(...))` a partir de certa linha; rotas anteriores são o webhook público (intencional)

**Nenhuma rota de negócio ficou aberta por esquecimento.**

### Achados

| ID | Achado | Evidência | Severidade | Recomendação |
|---|---|---|---|---|
| SEC-03 | `app.use("/admin", adminRoutes)` sem `authorize(['ADMIN'])`. A proteção depende de cada handler checar `req.user.role`. `authorize()` existe em `role.middleware.js` e **nunca foi importado**. | `app.js:83` | **Crítica** | `app.use("/admin", authMiddleware, authorize(['ADMIN']), adminRoutes)` |
| SEC-09 | JWT com validade de **7 dias**, sem refresh token e sem revogação. Token vazado (XSS, log, proxy) vale uma semana. | `auth.service.js:34` | **Alta** | Access token de 15-60 min + refresh token revogável |
| SEC-10 | Token aceito via **query string** (`?token=`) nas rotas de arquivo. Query strings vazam em logs de servidor, histórico de browser e header `Referer`. | `document.routes.js:421`, `photo.routes.js:90` | **Média** | URL assinada de curta duração, ou header only |
| SEC-11 | Sem RBAC — enum `Role` só tem `USER`/`ADMIN`. Toda a equipe da clínica compartilha o mesmo login. | `schema.prisma` | **Média** | Modelar perfis se o negócio exigir (recepcionista não deveria ver o financeiro) |

---

## 3. Rate limiting e proteção de perímetro — 🔴 AUSENTE

| ID | Achado | Severidade |
|---|---|---|
| SEC-01 | **Nenhum rate limiting em nenhuma rota.** `express-rate-limit` não está instalado. | **Crítica** |
| SEC-12 | **`helmet` não instalado** — sem `X-Frame-Options`, `X-Content-Type-Options`, HSTS, CSP | **Alta** |
| SEC-13 | **CORS com `origin: true`** — reflete qualquer origem e aceita credenciais | **Alta** |

### Superfícies expostas sem rate limit

| Endpoint | Ataque viável |
|---|---|
| `POST /auth/login` | Força bruta de senha, sem lockout |
| `POST /patient-doc/:id/validate-otp` | Força bruta do OTP (há `MAX_ATTEMPTS` por código, mas nada impede pedir códigos novos em massa) |
| `POST /patient-doc/:id/request-otp` | Flood de SMS/e-mail — **custo direto** |
| `POST /ai/*` (8 endpoints) | Abuso de custo na API de IA |
| `POST /billing/webhook` | Flood |
| `POST /documents/upload` | Exaustão de disco (20 MB por request) |

**Recomendação:**

```js
import rateLimit from "express-rate-limit";
import helmet from "helmet";

app.use(helmet());
app.use(cors({
  origin: (o, cb) => cb(null, ALLOWED_ORIGINS.includes(o) || !o),
  credentials: true,
}));

// global, generoso
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// estrito no que dói
const strict = rateLimit({ windowMs: 15 * 60_000, max: 10 });
app.use("/auth/login", strict);
app.use("/documents/*/request-otp", strict);
app.use("/documents/*/validate-otp", strict);
app.use("/ai", rateLimit({ windowMs: 60_000, max: 20 }));
```

> ⚠️ **Atenção:** por trás de CloudFront, é preciso `app.set('trust proxy', 1)` — senão o rate limit vê o IP do CDN e bloqueia todos os usuários de uma vez.

---

## 4. Isolamento multi-tenant

O padrão geral é **correto e consistente**: todo service filtra por `userId`. Auditei ~40 queries. Encontrei **uma falha real**:

### SEC-04 — Vazamento entre clínicas em `resolvePatientId()` — **CRÍTICA**

```js
// backend/src/modules/financial/transaction.service.js:47-57
async function resolvePatientId(data) {
  if (data.patientId) return data.patientId;
  if (data.appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: data.appointmentId }   // ← SEM userId
    });
    if (appt?.patientId) return appt.patientId;
  }
  if (data.budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: data.budgetId }        // ← SEM userId
    });
    if (budget?.patientId) return budget.patientId;
  }
  return null;
}
```

**Cenário de ataque:** a clínica A envia `POST /financial` com um `appointmentId` da clínica B (IDs são cuid, mas podem vazar por logs, prints ou tentativa). O service resolve o `patientId` da clínica B e cria uma transação vinculada a um paciente que não é seu. Confirma existência de dado alheio e corrompe a integridade referencial entre tenants.

**Correção:** passar `userId` e incluir no `where` das duas queries.

### SEC-14 — `createPending` sem `userId` — **Média**

```js
// transaction.service.js:262
const existing = await prisma.transaction.findUnique({
  where: { appointmentId: data.appointmentId }  // ← SEM userId
});
if (existing) return existing;
```

Retorna a `Transaction` de outra clínica se o `appointmentId` colidir. Menos grave (exige conhecer o ID), mas mesma classe de bug.

---

## 5. Validação de entrada

| Verificação | Resultado |
|---|---|
| SQL injection | ✅ **Baixo risco** — Prisma parametriza; único `$queryRaw` é `SELECT 1` no health check |
| Upload — tipo de arquivo | ✅ `fileFilter` por MIME em ambos os módulos |
| Upload — tamanho | ✅ 15 MB (fotos) / 20 MB (documentos) |
| Biblioteca de validação de schema | 🔴 **Nenhuma** — `zod`/`joi`/`express-validator` não instalados |

| ID | Achado | Severidade | Recomendação |
|---|---|---|---|
| SEC-15 | Sem validação declarativa de payload — cada handler valida ad-hoc ou não valida | **Média** | `zod` nos endpoints que escrevem |
| SEC-16 | `fileFilter` confia no `mimetype` enviado pelo cliente (falsificável) | **Média** | Validar magic bytes do arquivo |
| SEC-17 | Nome de arquivo interpolado em `Content-Disposition` sem sanitização | **Baixa** | Sanitizar (`document.routes.js:440`) |

---

## 6. Exposição de informação

| ID | Achado | Evidência | Severidade |
|---|---|---|---|
| SEC-18 | **115 ocorrências** de `error: e.message` devolvido ao cliente. Mensagens do Prisma vazam nomes de tabela, coluna e constraint. | `grep` em `modules/` | **Alta** |
| SEC-19 | Sem handler global de erro → stack trace do Express em HTML | `error.middleware.js` nunca registrado | **Alta** |
| SEC-20 | `GET /health` público expõe estado do banco | `app.js:94` | **Baixa** |

**Correção conjunta:** registrar `error.middleware.js` e devolver mensagem genérica em produção, logando o detalhe no servidor.

---

## 7. Dependências

```
4 vulnerabilidades: 3 HIGH, 1 LOW
```

| Pacote | Severidade | Correção | Ação |
|---|---|---|---|
| `multer` | **HIGH** | ✅ disponível | `npm audit fix` |
| `nodemailer` | **HIGH** | ⚠️ major (9.0.3) | Atualizar e testar o envio de OTP |
| `body-parser` | LOW | ✅ disponível | `npm audit fix` |
| `xlsx` (SheetJS) | HIGH→**Baixa** | ✅ `npm uninstall xlsx` | **Não é importado em lugar nenhum** — dependência órfã |

### SEC-21 — `xlsx` é dependência órfã — **rebaixado para Baixa**

Prototype Pollution + ReDoS, sem versão corrigida no npm. **Porém: verificado que `xlsx` não é importado em NENHUM arquivo** — nem em `src/`, nem em `scripts/`. É dependência direta declarada em `package.json:44` e nunca usada.

**Não há superfície de ataque.** A correção é simplesmente remover:

```bash
npm uninstall xlsx
```

Isso zera 1 dos 3 achados HIGH do `npm audit` sem nenhum risco de regressão.

| ID | Achado | Severidade |
|---|---|---|
| SEC-22 | Sem `npm audit` no CI e sem Dependabot | **Média** |

---

## 8. Infraestrutura — ⚠️ EXIGE VALIDAÇÃO NO CONSOLE AWS

Não auditável pelo código. Checklist para verificação manual:

| # | Verificar | Por quê |
|---|---|---|
| 1 | **RDS não é publicamente acessível** (`Publicly accessible = No`) | Banco exposto é comprometimento direto |
| 2 | **Security Group do RDS** aceita só o SG da EC2, não `0.0.0.0/0` | |
| 3 | **Porta 22 (SSH)** restrita ao seu IP, não `0.0.0.0/0` | |
| 4 | **Backup automático do RDS** ativo, retenção ≥ 7 dias | |
| 5 | **Criptografia em repouso** no RDS | Dados de saúde (LGPD art. 46) |
| 6 | **HTTPS obrigatório** no CloudFront (redirect HTTP→HTTPS) | |
| 7 | **Rotação de credencial do banco** | |
| 8 | **AWS WAF** no CloudFront | Camada extra de rate limit e regras OWASP |
| 9 | **CloudTrail** ativo | Auditoria de ação na conta |
| 10 | **MFA na conta root** | |

---

## 9. LGPD — dados sensíveis de saúde

O sistema processa **dado pessoal sensível** (art. 5º, II da LGPD): prontuário, evolução clínica, fotografia de paciente, anamnese. Isso eleva o patamar de exigência.

| ID | Achado | Severidade |
|---|---|---|
| SEC-23 | Sem criptografia em repouso na camada de aplicação para dados clínicos | **Média** |
| SEC-24 | Sem trilha de auditoria de **acesso** a prontuário (quem viu o quê, quando) | **Alta** |
| SEC-25 | Sem opt-out de comunicação para o paciente | **Média** |
| SEC-26 | Sem export/exclusão de dados do titular (portabilidade, art. 18) | **Média** |
| SEC-27 | Sem política de retenção — dado de paciente inativo fica indefinidamente | **Baixa** |

> **Contexto profissional:** o CFM (Res. 1.821/2007) exige guarda de prontuário por 20 anos, o que interage com o direito de exclusão da LGPD. **Exige orientação jurídica** — não é decisão técnica.

---

## 10. Plano de ação priorizado

### Fase 1 — Esta semana (~3h, alto impacto)

| # | Ação | Esforço |
|---|---|---|
| 1 | `npm audit fix` + `npm uninstall xlsx` (remove 2 dos 3 HIGH) | 10 min |
| 2 | Instalar `helmet` + `express-rate-limit`, aplicar global e nas rotas sensíveis | 1h |
| 3 | Restringir CORS a origens conhecidas | 15 min |
| 4 | `authorize(['ADMIN'])` no mount de `/admin` | 10 min |
| 5 | Tornar `ASAAS_WEBHOOK_TOKEN` obrigatório (falhar no boot) | 10 min |
| 6 | Corrigir `resolvePatientId()` e `createPending()` — passar `userId` | 30 min |
| 7 | Registrar `error.middleware.js` + mensagem genérica em produção | 30 min |
| 8 | Rotacionar `APP_SECRET` e token do webhook Asaas | 20 min |

> ⚠️ Itens 2 e 3 mudam comportamento de rede. Testar antes de subir — CORS restrito demais quebra o frontend, e rate limit sem `trust proxy` atrás do CloudFront bloqueia todo mundo.

### Fase 2 — Próximas semanas

| # | Ação |
|---|---|
| 9 | Auditar checklist de infra AWS (seção 8) |

| 11 | `zod` nos endpoints de escrita |
| 12 | Mover chave `.pem` para `~/.ssh/` com `chmod 400` |
| 12b | Remover `express.static("/uploads")` de `app.js:52` (defesa em profundidade) |
| 13 | `npm audit` no CI + Dependabot |
| 14 | Atualizar `nodemailer` (major) e testar OTP |

### Fase 3 — Estrutural

| # | Ação |
|---|---|
| 15 | Refresh token + JWT curto |
| 16 | Trilha de auditoria de acesso a prontuário (LGPD) |
| 17 | Segredos no AWS Secrets Manager |
| 18 | AWS WAF no CloudFront |
| 19 | Fluxo de export/exclusão do titular |
| 20 | RBAC com perfis reais |

---

## 11. Correções ao relatório de mapeamento anterior

Duas suspeitas registradas em `RELATORIO-MAPEAMENTO.md` foram investigadas a fundo aqui e **não se confirmaram**:

| Item anterior | Realidade verificada |
|---|---|
| PS-20: "fotos clínicas em `/uploads` estático, acesso a validar" | **Incorreto.** `GET /photos/:id/file` valida JWT e filtra por `userId` (`photo.routes.js:87-113`). O conteúdo vem de `getFile()`, não de `express.static`. O que permanece é a ressalva do token em query string (SEC-10). |
| PS-19: "uploads em disco servidos por `express.static`" | **Incorreto — VERIFICADO EM PRODUÇÃO.** `app.js:52` monta `/uploads` estático, mas o CloudFront **não roteia `/uploads` para a EC2**. A rota cai no fallback do SPA. Nenhum arquivo é servido sem autenticação. |

### Verificação executada em produção (2026-07-30)

| Requisição | HTTP | Content-Type | Corpo |
|---|---|---|---|
| `GET /api/uploads/<arquivo real>.pdf` | 404 | text/html | — |
| `GET /uploads/<arquivo real>.pdf` | 200 | text/html | `<!doctype html>` (SPA) |
| `GET /uploads/<inexistente>.pdf` (controle) | 200 | text/html | idêntico ao anterior |

**Conclusão: sem exposição.** O `200` é o fallback do SPA, não o PDF — comprovado pela resposta idêntica ao arquivo inexistente e pela ausência do magic number `%PDF-`. Prontuários e documentos só saem pelas rotas autenticadas (`/documents/:id/file`, `/photos/:id/file`), que validam JWT e filtram por dono.

> **Ressalva:** essa proteção vem da **configuração do CloudFront**, não do código. Se um dia `/uploads` for roteado para a EC2 (por mudança de behavior no CDN), a exposição passa a existir imediatamente, sem nenhuma alteração no repositório. **Recomendação: remover `app.use("/uploads", express.static(uploadsDir))` de `app.js:52`**, já que as rotas autenticadas usam `getFile()` e não dependem dele.

---

## 12. Conclusão

Para um produto construído em ritmo de fundador, a base está **acima da média**: sem segredo vazado, multi-tenant consistente, uploads validados, HMAC no webhook da Meta. Esses são os erros caros de corrigir depois, e não foram cometidos.

As lacunas concentram-se em **proteção de perímetro** — rate limiting, headers, CORS — que é justamente a parte mais barata de resolver. As 8 ações da Fase 1 levam cerca de 3 horas e eliminam os 4 achados críticos.

O item que eu trataria com mais urgência não é o mais sofisticado: **`npm audit fix` + `helmet` + `rate-limit`**, porque hoje qualquer pessoa com um script pode fazer força bruta no login ou torrar sua cota da API de IA sem nenhuma barreira.
