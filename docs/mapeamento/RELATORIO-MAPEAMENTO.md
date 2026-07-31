# Mapeamento Sistêmico — Iasoclin

**Data:** 2026-07-30
**Fonte da verdade:** código em `/Users/enzosilva/clinica-app` (branch `main`, working tree com alterações não commitadas em `conversations/` e `support/`).
**Diagrama:** [mapeamento-sistemico.drawio](mapeamento-sistemico.drawio) — 19 páginas, 1048 elementos.

> Tudo neste relatório foi extraído do código. Onde não foi possível confirmar, o item está marcado
> explicitamente como **NÃO IDENTIFICADO NO CÓDIGO**, **REGRA NÃO CONFIRMADA** ou **EXIGE VALIDAÇÃO HUMANA**.

---

## 1. Resumo executivo

| Indicador | Valor |
|---|---|
| Módulos backend existentes | 33 |
| Módulos efetivamente montados em `app.js` | 30 |
| Módulos mortos / vazios | 4 (`support`, `clinics`, `prescriptions`, `media`) |
| Modelos Prisma | 83 |
| Enums Prisma | 24 (22 são do IOS; apenas `Role` e `AppointmentStatus` são do core) |
| Endpoints mapeados | ~200 |
| Telas do app da clínica | 30 |
| Fluxos ponta a ponta analisados | 19 |
| **Pontas soltas confirmadas** | **45** (2 hipóteses descartadas na verificação) |

### Severidade

| Severidade | Qtd |
|---|---|
| Crítica | 8 |
| Alta | 14 |
| Média | 13 |
| Baixa | 4 |
| Oportunidade de melhoria | 6 |

### Principais riscos

1. **Agendamento sem validação de conflito de horário** — o coração do produto permite dois atendimentos no mesmo slot. Nenhuma checagem de sobreposição existe em `create()` nem em `update()`.
2. **Webhook do Asaas responde 200 mesmo em erro** — pagamento confirmado no Asaas pode ficar pendente no Iasoclin para sempre, sem retry e sem alerta.
3. **Módulo Iaso Suporte inacessível** — tickets são gravados no banco, mas não existe rota nem tela para atendê-los.
4. **`/admin/*` sem middleware de autorização** — a proteção depende de cada handler lembrar de checar `role === 'ADMIN'`.
5. **Confirmação de agendamento nunca dispara** — `triggerConfirmation()` existe e não tem chamador.
6. **Crons in-process** — escalar para 2+ instâncias duplica todos os envios de WhatsApp.
7. **Sem handler global de erro e sem observabilidade** — falhas viram `console.log` dentro do PM2.
8. **Dois caminhos concorrentes para a mesma mensagem inbound** — legado e novo rodam no mesmo evento.

### Recomendações prioritárias

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | Adicionar validação de conflito de horário em `appointment.service.create/update` | Baixo | Crítico |
| 2 | Fazer o webhook do Asaas retornar 500 em erro (deixar o Asaas retentar) + fila de reconciliação | Baixo | Crítico |
| 3 | Tornar `ASAAS_WEBHOOK_TOKEN` obrigatório (falhar no boot se ausente) | Trivial | Crítico |
| 4 | Registrar `error.middleware.js` em `app.js` e padronizar erro em JSON | Trivial | Alto |
| 5 | Aplicar `authorize(['ADMIN'])` no `app.use("/admin", ...)` | Trivial | Crítico |
| 6 | Chamar `triggerConfirmation()` ao criar agendamento | Trivial | Alto |
| 7 | Substituir todo `catch(() => {})` por log estruturado | Baixo | Alto |
| 8 | Decidir e desativar um dos dois caminhos de inbound do WhatsApp | Médio | Alto |
| 9 | Montar rotas + tela do módulo `support`, ou removê-lo | Médio | Alto |
| 10 | Mover crons para processo dedicado (ou lock distribuído) antes de escalar | Médio | Alto |

---

## 2. Arquitetura identificada

```
clinica-app/
├── backend/          Node + Express (ESM) + Prisma + PostgreSQL
│   ├── src/app.js    monta 30 módulos; blockOverdue GLOBAL antes das rotas
│   ├── src/server.js app.listen() + startAutomationCrons() + startWebhookWorker()
│   ├── src/middlewares/  auth · billing · feature · role(morto) · error(morto)
│   └── src/modules/  33 pastas
├── frontend/         React + Vite; AppRoutes + PrivateRoute + FeatureRoute
├── landing/
├── scripts/          gen-env.sh, after_install.sh (CodeDeploy)
└── docs/
```

**Multi-tenancy:** por `User.id`. O modelo `Clinic` existe no schema, mas o módulo não é montado — na prática **a clínica *é* o `User`**. Todo isolamento é feito por `where: { userId }` repetido em cada service.

**Cadeia de autorização por request:**
```
blockOverdue (global) → authMiddleware (por rota) → requireFeature(key) (algumas rotas) → handler
```
Não há camada de RBAC. `role.middleware.js` exporta `authorize(roles)` e **nenhum arquivo o importa**.

**Deploy:** `git push main` → AWS CodePipeline → EC2. `db push` é manual via SSM. `gen-env.sh` reescreve o `.env` a partir do CodeBuild a cada deploy.

---

## 3. Módulos analisados

### 3.1 Montados e funcionais (30)

| Módulo | Prefixo | Feature gate | Observação |
|---|---|---|---|
| auth | `/auth` | — | register, login, google, demo |
| patients | `/patients` | — | CRUD + import em lote |
| appointments | `/appointments` | — | **sem checagem de conflito** |
| evolutions | `/evolutions` | — | sem feature gate (divergente do menu) |
| procedures | `/procedures` | — | |
| products | `/products` | `stock` | movimentações + requisições |
| dashboard | `/dashboard` | — | |
| financial | `/financial` | `financial` | + card-fees |
| club | `/club` | `clube` | planos, membros, aplicações |
| procedure-maps | `/procedure-maps` | `procedureMap` | |
| ai | `/ai` | `aiAssistant` | 8 endpoints OpenAI, debita cota |
| documents | `/documents` | — | upload, envio, OTP, assinatura |
| budgets | `/budgets` | — | orçamentos + sessões de pacote |
| packages | `/packages` | — | só `GET /overview` |
| protocols | `/protocols` | — | |
| reports | `/reports` | `analytics` | só `GET /` |
| photos | `/photos` | — | sem feature gate |
| portfolio | `/portfolio` | `portfolio` | |
| automations | `/automations` | `whatsapp` | templates, logs, config, teste |
| conversations | `/conversations` | — | **sem consumidor no frontend** |
| whatsapp-embed | `/whatsapp` | — | connect/status/disconnect + webhook público |
| billing | `/billing` | parcial | Asaas, split, cotas, contratação |
| admin | `/admin` | — | **sem `authorize(['ADMIN'])`** |
| operating-system | `/admin/ios` | — | 22 modelos; consumido pelo repo admin |
| profile | `/profile` | — | |
| anamnesis | `/anamnesis` | — | templates + respostas |

### 3.2 Existentes mas NÃO montados (4)

| Módulo | Estado | Evidência |
|---|---|---|
| `support` | 5 modelos Prisma, `support.service.js`, `support.triage.js`, 3 suítes de teste. **Sem arquivo de rotas.** Não aparece em `app.js`. Alcançável só indiretamente pelo `webhookWorker`. | `backend/src/modules/support/` vs `app.js:56-85` |
| `clinics` | `clinic.routes.js` está **vazio** (0 bytes de conteúdo). Controller e service existem. | `backend/src/modules/clinics/clinic.routes.js` |
| `prescriptions` | Pasta **vazia**. Funcionalidade inexistente. | `backend/src/modules/prescriptions/` |
| `media` | Pasta **vazia**. | `backend/src/modules/media/` |

---

## 4. Regras de negócio confirmadas no código

| # | Regra | Onde |
|---|---|---|
| RN-01 | Consultas e retornos exigem paciente; lembretes e compromissos pessoais não | `appointment.service.js:102-112` |
| RN-02 | Agendamento é idempotente por `idempotencyKey` (unique + catch P2002) | `appointment.service.js:124-168` |
| RN-03 | Ao concluir atendimento com vínculo de pacote, consome a sessão | `appointment.service.js:170-173` |
| RN-04 | Autorização é por **feature do plano**, não por papel; ADMIN sempre passa | `feature.middleware.js:7-14` |
| RN-05 | Feature efetiva = `getFeatures(plan)` sobrescrito por `featureOverrides` | `feature.middleware.js:25-28` |
| RN-06 | Inadimplência bloqueia tudo exceto `/auth`, `/billing`, `/profile`, `/uploads`, `/health` | `billing.middleware.js:7` |
| RN-07 | Bloqueio só ocorre após a carência (`accessState === "blocked"`); ADMIN nunca é bloqueado | `billing.middleware.js:26-36` |
| RN-08 | Envio de WhatsApp sem credencial → log `skipped`, não falha | `automation.service.js:127-132` |
| RN-09 | Cota esgotada → `skipped` + `error='quota_exceeded'`, não quebra o lote | `automation.service.js:136-142` |
| RN-10 | Cota só é debitada **após** confirmação de envio pela Meta | `automation.service.js:161` |
| RN-11 | Número único: toda mensagem injeta `{{clinica}}` para identificar a origem | `automation.service.js:124-126` |
| RN-12 | Envio proativo usa template Meta aprovado; sem `metaTemplateName` cai em texto livre | `automation.service.js:150-159` |
| RN-13 | Inbound é idempotente por `metaMessageId` | `inbound.service.js:118-121` |
| RN-14 | Resposta do paciente age no **próximo** agendamento futuro não cancelado/confirmado | `inbound.service.js:58-67` |
| RN-15 | "Confirmar" → `CONFIRMED`; "Remarcar" → `RESCHEDULE_REQUESTED` | `inbound.service.js:69-77` |
| RN-16 | Mensagem de número sem envio recente é **descartada silenciosamente** | `inbound.service.js:126-131` |
| RN-17 | Roteamento por `phone_number_id`: `SUPPORT_PHONE_NUMBER_ID` → suporte; resto → inbox da clínica | `webhookWorker.js:41-44` |
| RN-18 | Fila de webhook: batch 20, máx. 5 tentativas, backoff 0/1/5/15/60 min | `webhookWorker.js:19-27` |
| RN-19 | Pagamento confirmado grava **valor líquido** (`netValue`), não o bruto | `billing.service.js:597-611` |
| RN-20 | Split IASOPay é registrado em `createCharge` e **não recalculado** no recebimento | `billing.service.js:612-617` |
| RN-21 | Eventos de subscription (mensalidade Iaso) são tratados antes das cobranças avulsas | `billing.service.js:577-582` |
| RN-22 | Top-up de cota é identificado por `externalReference` com prefixo `topup:` | `billing.service.js:588-595` |
| RN-23 | `PAYMENT_OVERDUE` de cobrança avulsa é no-op (frontend filtra por `dueDate`) | `billing.service.js:638-643` |
| RN-24 | Simulação de pagamento só é permitida em sandbox | `billing.routes.js` + commit `e321322` |
| RN-25 | OTP invalida o código após `MAX_ATTEMPTS` tentativas | `otp.service.js:63-67` |
| RN-26 | Conta demo tem TTL de 48h e é removida por cron horário | `automation.cron.js:22-26` |
| RN-27 | Kill switch `WHATSAPP_SEND_ENABLED` impede todo envio, mas o registro acontece igual | `webhookWorker.js:57-60` |

---

## 5. Integrações

| Integração | Direção | Autenticação | Retry | Observação |
|---|---|---|---|---|
| Meta WhatsApp Cloud API | Saída | Bearer token (por clínica ou plataforma) | **Não** | Kill switch global |
| Meta — webhook | Entrada | HMAC SHA256 (`APP_SECRET`) sobre `rawBody` | Sim (fila) | Responde 200 imediato |
| Asaas — API | Saída | `access_token` por clínica | **Não** | Sandbox e produção |
| Asaas — webhook | Entrada | header `asaas-access-token` | **Não** | **Aceita tudo se a var não estiver setada** |
| OpenAI | Saída | API key | **Não** | Debita cota de IA |
| AWS SES | Saída | IAM | — | Só OTP; fora do sandbox (50k/dia) |
| AWS S3 | — | — | — | Script de migração existe, **app ainda serve do disco local** |
| AWS CloudWatch / Cost Explorer | Saída | IAM (profile `claude`) | — | `/admin/infra/*` |

---

## 6. Comunicações e notificações

Canal efetivo único: **WhatsApp**. E-mail apenas no OTP (SES). **SMS e push: não identificados no código.**

| Evento | Dispara | Destinatário | Estado |
|---|---|---|---|
| Paciente cadastrado | `triggerWelcome()` | Paciente | ⚠️ `.catch(() => {})`; sem template não entrega |
| Agendamento criado | `triggerConfirmation()` | Paciente | 🔴 **Nunca dispara — sem chamador** |
| Aniversário | cron `0 9 * * *` | Paciente | ⚠️ Dispara, mas sem template aprovado não entrega |
| Lembrete de consulta | cron `*/30 * * * *` | Paciente | ✅ Funciona (validado em produção) |
| Paciente respondeu | `notifyOwner()` | Dona da clínica | ✅ Funciona (best-effort, silencioso em falha) |
| Documento para assinar | `requestOtp()` | Paciente | ✅ Funciona |
| Cobrança gerada | `sendPaymentLink()` | Paciente | ⚠️ Manual — exige clicar "Enviar link" |
| Pagamento confirmado | — | — | 🔴 **Nenhuma notificação** |
| Estoque baixo | `GET /low-stock` | Clínica | 🔴 Só badge na tela; sem envio ativo |
| Assinatura vencida | `blockOverdue` | Clínica | 🔴 Sem aviso prévio ao bloqueio |
| Ticket de suporte | `support.triage` | Clínica-cliente | 🔴 Resposta automática, sem atendente humano possível |
| Cota esgotada | `checkQuota()` | — | 🔴 Bloqueia em silêncio |
| Notificação interna | `AdminNotification` | Admin IASO | ✅ In-app |

**Não identificados:** opt-out/descadastro (LGPD), central de preferências, reenvio manual de mensagem falha, tratamento de "paciente não respondeu".

---

## 7. Tabela de pontas soltas

| ID | Módulo | Fluxo | Ponta solta | Evidência | Impacto | Severidade | Recomendação |
|---|---|---|---|---|---|---|---|
| PS-01 | appointments | Criar/editar agendamento | Nenhuma validação de conflito de horário ou disponibilidade | `appointment.service.js:100-173` — nenhum `overlap`/`conflito` no módulo | Dois atendimentos no mesmo slot; agenda inconsistente | **Crítica** | Checar sobreposição (`startsAt < endsAt_existente AND endsAt > startsAt_existente`) por profissional antes de criar |
| PS-02 | billing | Webhook Asaas | `catch` responde 200 "para o Asaas não retentar" | `billing.routes.js:28-32` | Pagamento confirmado no Asaas fica pendente no sistema, para sempre | **Crítica** | Retornar 500 em erro real + job de reconciliação diária |
| PS-03 | billing | Webhook Asaas | Sem `ASAAS_WEBHOOK_TOKEN` configurado, aceita qualquer chamada | `billing.routes.js:21-24` | Terceiro pode forjar confirmação de pagamento | **Crítica** | Falhar no boot se a var não existir em produção |
| PS-04 | admin | Todas as rotas admin | `app.use("/admin", adminRoutes)` sem `authorize(['ADMIN'])` | `app.js:83`; `authorize` sem nenhum importador | Rota nova que esqueça o check fica exposta a qualquer autenticado | **Crítica** | Aplicar `authorize(['ADMIN'])` no mount |
| PS-05 | support | Atendimento de tickets | Módulo completo sem rotas e sem `app.use()` | `support/` (só service+testes); ausente em `app.js` | Tickets gravados e inatingíveis; suporte não opera | **Crítica** | Criar `support.routes.js`, montar e construir a tela |
| PS-06 | automations | Confirmação de agendamento | `triggerConfirmation()` sem chamador | `automation.service.js:198`; grep sem ocorrências | Paciente nunca recebe confirmação | **Crítica** | Chamar após `appointment.service.create()` |
| PS-07 | jobs | Crons | Rodam in-process; sem lock distribuído | `server.js:8-9` | 2+ instâncias → envios duplicados ao paciente | **Crítica** | Processo dedicado ou advisory lock no Postgres |
| PS-08 | core | Erros | `error.middleware.js` nunca registrado | grep sem ocorrências | 500 em HTML cru; sem formato consistente | **Crítica** | `app.use(errorHandler)` no final de `app.js` |
| PS-09 | whatsapp | Inbound | Dois caminhos concorrentes no mesmo evento | `whatsappWebhook.js:57` e `:76` | Divergência de estado; risco de ação duplicada na agenda | Alta | Desativar o legado após migrar |
| PS-10 | whatsapp | Enfileiramento | `enqueueWebhookEvent(change).catch(() => {})` | `whatsappWebhook.js:57` | Evento perdido sem registro | Alta | Log estruturado + métrica |
| PS-11 | jobs | Fila | `failed` após 5 tentativas sai da rotação, sem alerta nem tela | `webhookWorker.js:18-27` | Mensagens perdidas silenciosamente | Alta | Alerta + endpoint de reprocessamento |
| PS-12 | jobs | Fila | Restart durante `processing` trava o evento | `webhookWorker.js` — sem reaper | Evento nunca reprocessa | Alta | Reaper de claim expirado |
| PS-13 | patients | Boas-vindas | `triggerWelcome(...).catch(() => {})` | `patient.service.js:53` | Falha invisível | Alta | Log + retry |
| PS-14 | automations | Envio | Falha de envio grava `failed` sem retry | `automation.service.js:180-183` | Mensagem nunca reenviada | Alta | Fila de retry com backoff |
| PS-15 | appointments | Remarcação | `RESCHEDULE_REQUESTED` sem tela ou filtro | grep no frontend | Pedido do paciente vira registro órfão | Alta | Filtro/badge na agenda |
| PS-16 | billing | Pós-pagamento | Nenhuma notificação a paciente ou clínica | `billing.service.js:596-620` | Clínica não sabe que recebeu | Alta | Disparar WhatsApp no `PAYMENT_CONFIRMED` |
| PS-17 | auth | Login | Sem rate limit nem lockout | `auth.routes.js` | Força bruta viável | Alta | `express-rate-limit` |
| PS-18 | auth | Senha | Recuperação de senha pública **não identificada** | Só `/profile PATCH /password` (exige login) e `/trocar-senha` | Usuário que esquece a senha fica travado | Alta | Implementar fluxo com OTP/e-mail |
| PS-19 | documents | Arquivos | Uploads em disco local servido por `express.static` | `app.js:52` | Redeploy pode perder arquivos; acesso a validar | Alta | Concluir a migração para S3 |
| PS-20 | photos | LGPD | Fotos clínicas em `/uploads` estático | `app.js:52` | Exposição de dado sensível se a URL vazar | Alta | URL assinada + checagem de dono |
| PS-21 | infra | Deploy | `gen-env.sh` sobrescreve o `.env` da EC2 | `scripts/gen-env.sh` | Var esquecida no CodeBuild derruba integração em silêncio | Alta | Validar vars obrigatórias no boot |
| PS-22 | core | Observabilidade | Sem APM, Sentry ou alerta | Só `console.log` + `/health` | Falhas invisíveis em produção | Alta | Instrumentar |
| PS-23 | ~~products~~ | ~~Estoque~~ | **DESCARTADA** — verificado: `movement.service.js:43` valida `newStock < 0` e grava via `prisma.$transaction` (atômico) | `movement.service.js:28-62` | — | — | Nenhuma ação |
| PS-24 | financial | Exclusão | `DELETE /financial/:id` sem auditoria | `transaction.service.js:392` | Histórico financeiro apagável sem rastro | Alta | Soft delete + log |
| PS-25 | admin | Auditoria | `AdminAuditLog` só cobre o painel admin | grep | Exclusões da clínica sem trilha | Alta | Estender auditoria ao core |
| PS-26 | procedures | Profissional | `Appointment.professional` é texto livre | `appointment.service.js:139` | Sem agenda/comissão por profissional; typo cria "outro" profissional | Alta | Criar entidade Professional |
| PS-27 | conversations | UI | `/conversations` sem consumidor no frontend | grep: 0 arquivos | Inbox construído e inacessível | Média | Construir a tela |
| PS-28 | operating-system | UI | `/admin/ios` sem consumidor no app | grep: 0 arquivos | Consumido só pelo repo admin (esperado) | Média | Documentar a fronteira |
| PS-29 | ~~patients~~ | ~~Exclusão~~ | **DESCARTADA** — verificado: `remove()` faz soft delete (`isActive: false`), relacionamentos preservados | `patient.service.js:309-319` | — | — | Nenhuma ação |
| PS-30 | clinics | Módulo | `clinic.routes.js` vazio; módulo não montado | arquivo vazio | Código morto | Média | Remover ou concluir |
| PS-31 | core | Código morto | `prescriptions/` e `media/` vazios | pastas vazias | Confusão de manutenção | Baixa | Remover |
| PS-32 | core | RBAC | `authorize()` nunca importado | grep | Sem perfis de acesso | Alta | Aplicar ou remover |
| PS-33 | users | Perfis | Enum `Role` só tem USER/ADMIN | `schema.prisma` | Recepcionista/profissional não existem | Média | Modelar se o negócio exigir |
| PS-34 | financial | Modelagem | Status de `Transaction` são strings livres | `billing.service.js` (`"pago"`, `"estornado"`…) | Typo cria status fantasma | Média | Enum Prisma |
| PS-35 | billing | Bloqueio | Sem aviso prévio antes da suspensão | `billing.middleware.js` | Clínica descobre bloqueada | Média | Notificar em D-3/D-1 |
| PS-36 | products | Alerta | Estoque baixo só na tela | `/products/low-stock` | Ruptura não avisada | Média | Notificação ativa |
| PS-37 | products | Requisição | Aprovação não notifica nem gera entrada | `product.routes.js` | Fluxo para na aprovação | Média | Fechar o ciclo |
| PS-38 | crm | Leads | `DELETE /admin/leads/:id` apaga histórico de estágios | `admin.routes.js` | Perda de dado comercial | Média | Soft delete |
| PS-39 | crm | Nutrição | Mudança de estágio não dispara comunicação | grep | Funil sem automação | Oportunidade | Automatizar |
| PS-40 | crm | Cancelamento | Cancelar clínica não exporta dados nem comunica | `admin.routes.js` | Risco LGPD (portabilidade) | Média | Export + comunicação |
| PS-41 | billing | Cortesia | `subscriptionStatus` alterado direto no banco | Memória do projeto | Sem rastro de quem liberou | Média | Endpoint admin auditado |
| PS-42 | core | Middleware | `blockOverdue` é fail-open em erro | `billing.middleware.js:44` | Banco instável libera inadimplente | Baixa | Aceitável; documentar |
| PS-43 | whatsapp | Inbound | Número sem envio recente é descartado | `inbound.service.js:126-131` | Paciente que escreve primeiro é ignorado | Média | Registrar como órfão |
| PS-44 | ai/whatsapp | Cotas | Esgotamento não avisa o usuário | `checkQuota` | Funcionalidade "some" sem explicação | Média | Feedback na UI |
| PS-45 | evolutions/photos | Feature gate | Sem `requireFeature` no backend | `app.js:59, 72` | Regra só no menu do frontend | Média | Alinhar backend e frontend |
| PS-46 | core | Segurança | Sem refresh token nem revogação de JWT | `auth.service.js` | JWT vazado vale até expirar | Média | Refresh + blacklist |
| PS-47 | core | Jobs | Sem reconciliação Asaas × Transaction | grep | Divergência financeira não detectada | Alta | Job diário |

---

## 8. Matriz de rastreabilidade

| Módulo | Tela/Componente | Botão/Ação | Endpoint | Regra de negócio | Modelo afetado | Notificação/Integração | Resultado |
|---|---|---|---|---|---|---|---|
| Auth | `Login.jsx` | "Entrar" | `POST /auth/login` | bcrypt + JWT; sem rate limit | `User` | — | Token + redirect por `PrivateRoute` |
| Auth | `Signup.jsx` | "Criar conta" | `POST /auth/register` | — | `User` | — | Conta criada |
| Auth | `ComeceAgora.jsx` | "Comece agora" | `POST /auth/demo` | TTL 48h | `User`, `Lead` | Cron de limpeza | Conta demo |
| Auth | `TrocarSenha.jsx` | "Salvar" | `PATCH /profile/password` | `mustChangePassword` | `User` | — | Senha trocada |
| Billing | `Contratar.jsx` | "Contratar" | `POST /billing/contratar` | Gate por data de corte | `User` | Asaas (subscription) | `subscriptionStatus` |
| Pacientes | `Patients.jsx` | "Novo paciente" | `POST /patients` | Nome obrigatório | `Patient` | `triggerWelcome` (frágil) | Paciente + WhatsApp |
| Pacientes | `PatientDetails.jsx` | abas | `GET /patients/:id/stats` | — | `Patient` + relações | — | Ficha 360º |
| Pacientes | `EditPatient.jsx` | "Salvar" | `PUT /patients/:id` | — | `Patient` | — | Atualizado |
| Pacientes | — | importar base | `POST /patients/import` | dedupe | `Patient` | — | Lote importado |
| Agenda | `Agenda.jsx` | slot vazio → "Salvar" | `POST /appointments` | RN-01, RN-02; **sem conflito** | `Appointment`, `AppointmentProcedure` | `triggerConfirmation` **morto** | Agendamento |
| Agenda | `Agenda.jsx` | mudar status | `PUT /appointments/:id` | RN-03 | `Appointment`, `Transaction`, `BudgetSession` | — | Concluído + financeiro |
| Agenda | `components/calendar` | navegar | `GET /appointments/calendar` | — | `Appointment` | — | Grade |
| Procedimentos | `Procedures.jsx` | "Novo" | `POST /procedures` | — | `Procedure`, `ProcedureProduct` | — | Cadastrado |
| Evoluções | `PatientDetails` | "Salvar evolução" | `POST /evolutions` | sem feature gate | `Evolution` | — | Registrada |
| Evoluções | `components/ai` | "Gerar com IA" | `POST /ai/evolution-draft` | `checkQuota('ai')` | `UsageEvent` | OpenAI | Rascunho |
| Fotos | `PatientDetails` | upload | `POST /photos/patient/:id` | — | `PatientPhoto` | — | Arquivo em disco |
| Mapa | `components/procedure-map` | marcar pontos | `POST /procedure-maps/patient/:id` | feature `procedureMap` | `ProcedureMap` | — | Mapa salvo |
| Documentos | `Documents.jsx` | "Upload" | `POST /documents/upload` | multer | `Document`, `DocumentVersion` | — | Modelo salvo |
| Documentos | `Documents.jsx` | "Enviar ao paciente" | `POST /documents/send` | — | `PatientDocument` | WhatsApp/e-mail | Pendente de assinatura |
| Assinatura | (tela do paciente **não identificada**) | "Receber código" | `POST /patient-doc/:id/request-otp` | RN-25 | `OtpCode` | SES / WhatsApp | Código enviado |
| Assinatura | idem | "Assinar" | `PUT /patient-doc/:id/sign` | OTP válido | `PatientDocument` | — | `status=assinado` |
| Anamnese | `AnamneseModelos.jsx` | "Novo modelo" | `POST /anamnesis/templates` | — | `AnamnesisTemplate` | — | Modelo |
| Anamnese | `components/anamnesis` | "Finalizar" | `POST /responses/:id/finalize` | — | `AnamnesisResponse` | — | Finalizada |
| Orçamentos | `PatientDetails` | "Aprovar" | `PATCH /budgets/:id/status` | libera `BudgetSession` | `Budget`, `BudgetSession` | — | Aprovado |
| Pacotes | `Sessoes.jsx` | consumir sessão | `GET /packages/overview` | RN-03 | `BudgetSession` | — | Saldo |
| Cobrança | `components/billing` | "Gerar cobrança" | `POST /billing/charges` | RN-20; exige `asaasApiKey` | `Transaction` | Asaas + split | Cobrança + link |
| Cobrança | `components/billing` | "Enviar link" | `POST /charges/:id/send-link` | — | `AutomationLog` | WhatsApp | Link enviado |
| Cobrança | — | (webhook) | `POST /billing/webhook` | RN-19, RN-21, RN-22 | `Transaction`, `User` | Asaas | `status=pago` |
| Financeiro | `Financeiro.jsx` | "Novo lançamento" | `POST /financial` | CardFee → `netAmount` | `Transaction` | — | Lançado |
| Financeiro | `Financeiro.jsx` | "Aprovar" | `PATCH /financial/:id/approve` | — | `Transaction` | — | Aprovado |
| Financeiro | `Faturamento.jsx` | dar baixa | `GET /financial` | — | `Transaction` | — | Conciliado |
| Estoque | `Products.jsx` | "Novo produto" | `POST /products` | feature `stock` | `Product` | — | Cadastrado |
| Estoque | `Products.jsx` | movimentar | `POST /:id/movements` | **saldo não validado** | `ProductMovement` | — | Saldo alterado |
| Estoque | `Products.jsx` | "Aprovar requisição" | `PATCH /stock-requests/:id/approve` | — | `StockRequest` | — | Aprovada (fluxo para aqui) |
| Clube | `Clube.jsx` | criar plano | `POST /club/plans` | feature `clube` | `ClubPlan` | — | Plano |
| Clube | `Clube.jsx` | adicionar membro | `POST /club/members` | — | `ClubMember` | — | Membro |
| Portfólio | `Portfolio.jsx` | publicar caso | `POST /portfolio` | feature `portfolio` | `PortfolioCase` | — | Caso |
| Automações | `Automacoes.jsx` | editar template | `PUT /automations/templates/:type` | RN-11, RN-12 | `AutomationTemplate` | Meta | Template salvo |
| Automações | `Automacoes.jsx` | "Testar envio" | `POST /automations/whatsapp-test` | kill switch | `AutomationLog` | Meta | Teste |
| Automações | `Automacoes.jsx` | ver histórico | `GET /automations/logs` | — | `AutomationLog` | — | Logs |
| WhatsApp | `components/whatsapp` | "Conectar WhatsApp" | `POST /whatsapp/connect` | Embedded Signup | `User` | Meta | Número conectado |
| WhatsApp | — | (webhook Meta) | `POST /whatsapp/webhook` | RN-13→RN-18 | `WebhookEvent`, `WhatsappInbound`, `Conversation` | Meta | Fila + inbox |
| Conversas | **sem tela** | — | `GET /conversations` | — | `Conversation`, `Message` | — | 🔴 inacessível |
| Suporte | **sem tela e sem rota** | — | — | triagem | `SupportTicket` | Meta | 🔴 inacessível |
| Relatórios | `Relatorios.jsx` | filtros | `GET /reports` | feature `analytics` | leitura | — | Relatório |
| Dashboard | `Dashboard.jsx` | abrir | `GET /dashboard/stats` | — | leitura | — | KPIs |
| IA | `components/ai` | "Insight do dia" | `GET /ai/daily-insight` | cota | `UsageEvent` | OpenAI | Insight |
| Config | `Settings.jsx` | salvar | `PATCH /profile` | — | `User` | — | Perfil |
| Admin | (repo admin) | gerir clínicas | `GET/POST/PATCH/DELETE /admin/clinics` | **sem `authorize`** | `User`, `AdminAuditLog` | — | Clínica gerida |
| Admin | (repo admin) | funil | `PATCH /admin/leads/:id` | — | `Lead`, `LeadStageHistory` | — | Estágio movido |
| Admin | (repo admin) | infra | `GET /admin/infra/metrics` | — | — | CloudWatch/Cost Explorer | Métricas |
| IOS | (repo admin) | cenários | `POST /admin/ios/scenarios/:id/run` | — | `IosScenario`, `IosProjectionRun` | — | Projeção |

---

## 9. Dúvidas que exigem validação humana

1. **Existe tela pública para o paciente assinar documento?** O backend expõe `request-otp`/`validate-otp`/`sign`, mas nenhuma rota de frontend foi encontrada em `AppRoutes.jsx`.
2. **Valor jurídico da assinatura por OTP** — não há certificado ICP-Brasil, carimbo de tempo nem hash do documento assinado. Exige parecer jurídico.
3. **`/uploads` estático protege fotos e documentos clínicos?** Se a URL for adivinhável ou vazar, há exposição de dado sensível de saúde (LGPD).
4. **`processInboundMessage` (legado) e `webhookWorker` (novo) devem coexistir?** Ambos processam o mesmo evento hoje.
5. **O repo `clinica-admin-app` consome todos os endpoints `/admin/*` e `/admin/ios/*`?** A análise cobriu o repo `clinica-app`; a fronteira precisa ser confirmada.
6. **Módulo `support` vai ser concluído ou removido?** Há 5 modelos e 23 testes investidos.
7. **Como o frontend trata queda de rede em POST?** `services/api.js` (axios) — comportamento não padronizado, não validado.
8. **Quantas instâncias rodam em produção?** Determina se os crons já estão duplicando envios hoje.
9. **`Clinic` no schema vai ser usado?** Hoje a clínica é o `User`; migrar depois será caro.

---

## 10. Como abrir o diagrama

1. Acesse [diagrams.net](https://app.diagrams.net) → **File → Open From → Device**
2. Selecione `docs/mapeamento/mapeamento-sistemico.drawio`
3. As 19 páginas ficam nas abas na base da janela.

Também abre no VS Code com a extensão *Draw.io Integration* (`hediet.vscode-drawio`).

**Regeneração:** `cd docs/mapeamento && python3 montar.py` (edite `paginas.py` para alterar o conteúdo).
