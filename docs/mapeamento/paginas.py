#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Definicao das 19 paginas do mapeamento sistemico do Iasoclin."""

from gerar_drawio import (Page, legend, shp, dec, db, term,
                          AZUL, VERDE, AMARELO, ROXO, LARANJA, VERMELHO, CINZA, BRANCO,
                          BORDA_RISCO)

W, H = 210, 54          # tamanho padrao de no
COL = [60, 320, 580, 840, 1100, 1360]   # colunas


def _hdr(p, titulo, sub):
    p.title(titulo)
    p.subtitle(sub)


# ══════════════════════════════════════════════════════════════════════════════
# 1. VISAO GERAL
# ══════════════════════════════════════════════════════════════════════════════
def pagina_visao_geral():
    p = Page("01 - Visao Geral do Sistema")
    _hdr(p, "Iasoclin - Visao Geral do Sistema",
         "Monorepo: frontend React/Vite + backend Node/Express (ESM) + Prisma/PostgreSQL. "
         "Deploy AWS CodePipeline -> EC2. Multi-tenant por User.id (nao ha isolamento por tabela Clinic).")

    y0 = 110
    # Atores
    a_clin = p.node("ATOR: Clinica\n(dona / recepcao / profissional)\nRole=USER", COL[0], y0, W, 64, shp(AZUL))
    a_adm  = p.node("ATOR: Admin IASO\nRole=ADMIN", COL[0], y0 + 90, W, 64, shp(AZUL))
    a_pac  = p.node("ATOR: Paciente\n(sem login - so WhatsApp/link OTP)", COL[0], y0 + 180, W, 64, shp(AZUL))
    a_ext  = p.node("ATOR: Servicos externos\nMeta / Asaas / OpenAI / AWS", COL[0], y0 + 270, W, 64, shp(LARANJA))

    fe   = p.node("FRONTEND React/Vite\nAppRoutes.jsx + PrivateRoute + FeatureRoute\n~30 paginas, services/api.js (axios)",
                  COL[1], y0 + 40, W + 40, 74, shp(AZUL))
    fe_adm = p.node("FRONTEND Admin (repo separado)\nclinica-admin-app/frontend\npages/tecnologia + routes",
                    COL[1], y0 + 150, W + 40, 64, shp(AZUL, BORDA_RISCO))

    api  = p.node("BACKEND Express (app.js)\nblockOverdue GLOBAL -> authMiddleware\n-> requireFeature -> rotas de modulo",
                  COL[2], y0 + 40, W + 40, 74, shp(VERDE))

    mods = p.node("30 modulos montados\nauth patients appointments evolutions procedures\nproducts dashboard financial club procedure-maps ai\ndocuments budgets packages protocols reports photos\nportfolio automations conversations whatsapp billing\nadmin admin/ios profile anamnesis",
                  COL[3], y0 - 10, W + 60, 160, shp(VERDE, "fontSize=9;"))

    mortos = p.node("NAO MONTADOS / VAZIOS\nsupport (5 modelos + 23 testes, SEM rotas)\nclinics (clinic.routes.js VAZIO)\nprescriptions/ (pasta vazia)\nmedia/ (pasta vazia)\nrole.middleware (authorize) nunca importado\nerror.middleware nunca registrado",
                    COL[3], y0 + 170, W + 60, 120, shp(VERMELHO, "fontSize=9;" + BORDA_RISCO))

    dbn  = p.node("PostgreSQL (Prisma)\n83 modelos\nPROD=RDS  DEV=Neon", COL[4], y0 + 40, W, 74, db())

    cron = p.node("JOBS in-process (server.js)\nstartAutomationCrons()\nstartWebhookWorker()",
                  COL[2], y0 + 200, W + 40, 64, shp(VERDE, "dashed=1;"))
    ext  = p.node("INTEGRACOES\nMeta WhatsApp Cloud API\nAsaas (cobranca + split)\nOpenAI  |  AWS S3/SES",
                  COL[4], y0 + 200, W, 74, shp(LARANJA))

    p.edge(a_clin, fe, "login / uso diario")
    p.edge(a_adm, fe_adm, "gestao da plataforma")
    p.edge(a_pac, ext, "responde WhatsApp", dashed=True)
    p.edge(a_ext, ext, "webhooks", dashed=True)
    p.edge(fe, api, "HTTP + Bearer JWT")
    p.edge(fe_adm, api, "gateway -> core")
    p.edge(api, mods)
    p.edge(mods, dbn, "Prisma Client")
    p.edge(cron, dbn, "fila WebhookEvent", dashed=True)
    p.edge(api, cron, "", dashed=True)
    p.edge(ext, cron, "webhook -> fila", dashed=True)
    p.edge(mods, ext, "envio ativo")

    p.note("PONTA SOLTA CRITICA: o modulo 'support' (Iaso Suporte) tem 5 modelos Prisma, "
           "service, triagem e 3 suites de teste, mas NAO tem arquivo de rotas e NAO e montado "
           "em app.js. So e alcancavel pelo webhookWorker (roteamento por SUPPORT_PHONE_NUMBER_ID). "
           "Nao existe tela nem endpoint para a equipe atender os tickets.",
           COL[0], y0 + 380, 520, 96, VERMELHO)
    p.note("RBAC: role.middleware.js exporta authorize(roles) mas NENHUMA rota o importa. "
           "A unica separacao efetiva e req.user.role==='ADMIN' checado dentro de services/middlewares "
           "especificos. Nao ha perfis de recepcionista/profissional no codigo - o enum Role so tem USER/ADMIN.",
           COL[2], y0 + 380, 520, 96, VERMELHO)
    legend(p, COL[5] - 40, y0)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 2. AUTENTICACAO
# ══════════════════════════════════════════════════════════════════════════════
def pagina_auth():
    p = Page("02 - Autenticacao e Controle de Acesso")
    _hdr(p, "Autenticacao e Controle de Acesso",
         "POST /auth/register | /auth/login | /auth/google | /auth/demo  ->  auth.controller -> auth.service. "
         "JWT assinado com JWT_SECRET, sem refresh token.")

    L_user = p.lane("Usuario", 40, 100, 1500, 130, "#eaf2fb")
    L_fe   = p.lane("Frontend", 40, 230, 1500, 150, "#eaf2fb")
    L_be   = p.lane("Backend", 40, 380, 1500, 220, "#eafbea")
    L_db   = p.lane("Banco", 40, 600, 1500, 110, "#f2f2f2")

    ini = p.node("Acessa /login", 60, 30, 170, 44, term(AZUL), parent=L_user)
    cad = p.node("Acessa /cadastro\n(/register redireciona)", 280, 26, 190, 52, term(AZUL), parent=L_user)
    goo = p.node("Clica 'Entrar com Google'", 520, 30, 190, 44, shp(AZUL), parent=L_user)
    dem = p.node("Clica 'Comece agora'\n(/comece-agora)", 760, 26, 190, 52, shp(AZUL), parent=L_user)

    f_login = p.node("Login.jsx\npreenche e-mail + senha\nbotao 'Entrar'", 60, 30, 190, 62, shp(AZUL), parent=L_fe)
    f_cad   = p.node("Signup.jsx\nwizard de cadastro", 280, 34, 190, 54, shp(AZUL), parent=L_fe)
    f_ctx   = p.node("AuthContext.jsx\nguarda token + user\nno localStorage", 520, 30, 190, 62, shp(AZUL), parent=L_fe)
    f_priv  = p.node("PrivateRoute\nsem token -> /login\nmustChangePassword -> /trocar-senha\nsubscription -> /contratar | /acesso-bloqueado",
                     760, 22, 300, 78, shp(AMARELO, "fontSize=9;"), parent=L_fe)
    f_feat  = p.node("FeatureRoute\nfeature do plano ausente\n-> bloqueia a tela", 1100, 30, 200, 62, shp(AMARELO), parent=L_fe)

    b_login = p.node("POST /auth/login\nauth.controller.login\n-> auth.service", 60, 30, 200, 62, shp(VERDE), parent=L_be)
    b_val   = p.node("Senha confere?\nbcrypt.compare", 300, 30, 170, 62, dec(), parent=L_be)
    b_erro  = p.node("401 'Credenciais invalidas'\n(sem lockout / rate limit)", 300, 120, 200, 54, shp(VERMELHO, BORDA_RISCO), parent=L_be)
    b_jwt   = p.node("Assina JWT\n{id, role, ...}\nJWT_SECRET", 520, 30, 180, 62, shp(VERDE), parent=L_be)
    b_mid   = p.node("authMiddleware\nBearer -> jwt.verify\nfalha -> 401 'Token invalido'", 760, 26, 220, 66, shp(AMARELO), parent=L_be)
    b_block = p.node("blockOverdue (GLOBAL)\nisenta /auth /billing /profile /uploads /health\naccessState==='blocked' -> 403 SUBSCRIPTION_BLOCKED\nfail-open em erro",
                     1020, 22, 280, 74, shp(AMARELO, "fontSize=9;"), parent=L_be)
    b_role  = p.node("role.middleware authorize()\nNUNCA IMPORTADO\n= sem RBAC por perfil", 1330, 26, 200, 66, shp(VERMELHO, BORDA_RISCO), parent=L_be)

    d_user = p.node("User\nemail, passwordHash, role,\nplan, featureOverrides,\nsubscriptionStatus, overdueSince",
                    60, 20, 260, 74, db("fontSize=9;"), parent=L_db)
    d_otp  = p.node("OtpCode\n(assinatura de documento,\nnao e login)", 380, 24, 200, 62, db(), parent=L_db)

    p.edge(ini, f_login); p.edge(cad, f_cad); p.edge(goo, f_ctx); p.edge(dem, f_ctx)
    p.edge(f_login, b_login, "POST /auth/login")
    p.edge(b_login, b_val)
    p.edge(b_val, b_erro, "Nao")
    p.edge(b_val, b_jwt, "Sim")
    p.edge(b_jwt, f_ctx, "token + user")
    p.edge(f_ctx, f_priv)
    p.edge(f_priv, f_feat, "autorizado")
    p.edge(f_priv, b_mid, "toda request")
    p.edge(b_mid, b_block)
    p.edge(b_login, d_user, "findUnique", dashed=True)
    p.edge(b_jwt, d_user, "", dashed=True)

    p.note("RISCO ALTO - Sem rate limiting nem bloqueio por tentativas em /auth/login. "
           "Nao ha refresh token nem revogacao: um JWT vazado vale ate expirar. "
           "Nao ha rota de 'esqueci minha senha' publica - o unico caminho e /profile PATCH /password "
           "(exige estar logado) ou /trocar-senha no 1o acesso. RECUPERACAO DE SENHA NAO IDENTIFICADA NO CODIGO.",
           60, 730, 640, 110, VERMELHO)
    p.note("Contas cortesia: subscriptionStatus='active' e gravado manualmente no banco, "
           "fora do fluxo Asaas. Comportamento exige validacao humana - nao ha trilha de auditoria "
           "desse ato no codigo.",
           730, 730, 500, 110, AMARELO)
    legend(p, 1280, 730)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 3. USUARIOS, CLINICAS, PERFIS E PERMISSOES
# ══════════════════════════════════════════════════════════════════════════════
def pagina_usuarios():
    p = Page("03 - Usuarios, Clinicas, Perfis e Permissoes")
    _hdr(p, "Usuarios, Clinicas, Perfis e Permissoes",
         "Enum Role = USER | ADMIN (apenas 2 perfis). Permissao efetiva = plano + featureOverrides. "
         "Modelo Clinic existe no schema mas o modulo nao esta montado.")

    y = 110
    n1 = p.node("Admin IASO\nabre painel Tecnologia", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("GET /admin/clinics\nadmin.routes -> forward do gateway", COL[1], y, W + 40, H, shp(VERDE))
    n3 = p.node("POST /admin/clinics\ncria clinica (User com plano)", COL[1], y + 80, W + 40, H, shp(VERDE))
    n4 = p.node("PATCH /admin/clinics/:id\nmuda plano / featureOverrides", COL[1], y + 160, W + 40, H, shp(VERDE))
    n5 = p.node("DELETE /admin/clinics/:id", COL[1], y + 240, W + 40, H, shp(VERMELHO, BORDA_RISCO))

    d1 = p.node("User\n(a 'clinica' E o User)", COL[2], y, W, H, db())
    d2 = p.node("AdminAuditLog\nregistra acao do admin", COL[2], y + 80, W, H, db())
    d3 = p.node("Clinic (modelo Prisma)\nSEM modulo montado", COL[2], y + 160, W, H, db(BORDA_RISCO))

    f1 = p.node("config/features.js\ngetFeatures(plan)", COL[3], y, W, H, shp(AMARELO))
    f2 = p.node("requireFeature(key)\nADMIN sempre passa\n403 'Recurso nao disponivel'", COL[3], y + 80, W, 62, shp(AMARELO))
    f3 = p.node("featureOverrides (JSON)\nsobrescreve o plano\npor clinica", COL[3], y + 165, W, 62, shp(AMARELO))

    r1 = p.node("PONTA SOLTA: nao existe\nperfil recepcionista /\nprofissional. Todo usuario\nda clinica e o MESMO User.",
                COL[4], y, W, 80, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: DELETE de\nclinica sem checagem de\ndependencias (pacientes,\nagenda, financeiro).",
                COL[4], y + 100, W, 80, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, n2); p.edge(n1, n3); p.edge(n1, n4); p.edge(n1, n5)
    p.edge(n2, d1); p.edge(n3, d1); p.edge(n4, d1); p.edge(n5, d1, "delete")
    p.edge(n3, d2, "audit", dashed=True); p.edge(n4, d2, "audit", dashed=True)
    p.edge(n4, f3)
    p.edge(d1, f1); p.edge(f1, f2); p.edge(f3, f2)
    p.edge(n5, r2)
    p.edge(f2, r1)

    p.note("REGRA DE NEGOCIO CONFIRMADA: a autorizacao e por FEATURE (plano), nao por papel. "
           "requireFeature() consulta User.plan + User.featureOverrides a cada request "
           "(uma query por request - sem cache).",
           COL[0], y + 340, 560, 90, VERDE)
    p.note("NAO IDENTIFICADO NO CODIGO: convite de usuario para a clinica, multiplos logins por clinica, "
           "gestao de equipe interna da clinica. O campo 'professional' em Appointment e TEXTO LIVRE, "
           "nao referencia um usuario.",
           COL[2], y + 340, 560, 90, VERMELHO)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 4. PACIENTES
# ══════════════════════════════════════════════════════════════════════════════
def pagina_pacientes():
    p = Page("04 - Pacientes")
    _hdr(p, "Pacientes",
         "GET/POST/PUT/DELETE /patients | GET /patients/:id/stats | POST /patients/import/check | POST /patients/import")

    L_u  = p.lane("Usuario (clinica)", 40, 100, 1500, 120, "#eaf2fb")
    L_fe = p.lane("Frontend", 40, 220, 1500, 130, "#eaf2fb")
    L_be = p.lane("Backend", 40, 350, 1500, 200, "#eafbea")
    L_db = p.lane("Banco", 40, 550, 1500, 100, "#f2f2f2")
    L_cm = p.lane("Comunicacao", 40, 650, 1500, 110, "#f3eafb")

    u1 = p.node("Clica 'Novo paciente'", 60, 30, 190, 44, shp(AZUL), parent=L_u)
    u2 = p.node("Preenche ficha\n(nome, telefone, CPF...)", 290, 26, 190, 52, shp(AZUL), parent=L_u)
    u3 = p.node("Clica 'Salvar'", 520, 30, 160, 44, shp(AZUL), parent=L_u)
    u4 = p.node("Importa base CSV/JSON\n(script + endpoint)", 720, 26, 200, 52, shp(AZUL), parent=L_u)
    u5 = p.node("Clica 'Excluir'", 960, 30, 160, 44, shp(AZUL), parent=L_u)

    f1 = p.node("Patients.jsx (lista)\nbusca + filtros", 60, 30, 190, 54, shp(AZUL), parent=L_fe)
    f2 = p.node("CreatePatient.jsx\nvalidacao de formulario", 290, 30, 190, 54, shp(AZUL), parent=L_fe)
    f3 = p.node("PatientDetails.jsx\nabas: dados, agenda, evolucoes,\nfotos, documentos, orcamentos", 520, 22, 240, 70, shp(AZUL, "fontSize=9;"), parent=L_fe)
    f4 = p.node("EditPatient.jsx", 800, 34, 160, 46, shp(AZUL), parent=L_fe)

    b1 = p.node("POST /patients\npatient.controller -> patient.service.create", 60, 26, 250, 54, shp(VERDE), parent=L_be)
    b2 = p.node("Dados validos?\n(nome obrigatorio)", 350, 26, 170, 60, dec(), parent=L_be)
    b3 = p.node("Cria Patient\n{userId: dono}", 560, 30, 180, 54, shp(VERDE), parent=L_be)
    b4 = p.node("triggerWelcome(userId, patient)\n.catch(() => {})  <- FALHA SILENCIOSA", 780, 26, 280, 60, shp(ROXO, BORDA_RISCO), parent=L_be)
    b5 = p.node("DELETE /patients/:id\nremove() -> SOFT DELETE\nisActive = false", 1100, 22, 200, 62, shp(VERDE), parent=L_be)
    b6 = p.node("POST /patients/import/check\n+ POST /patients/import\ndedupe por nome/telefone", 1330, 22, 200, 66, shp(VERDE, "fontSize=9;"), parent=L_be)

    d1 = p.node("Patient\nuserId, name, phone, cpf,\nbirthDate, isActive", 60, 20, 240, 62, db(), parent=L_db)
    d2 = p.node("Relacionados: Appointment, Evolution,\nBudget, PatientPhoto, PatientDocument,\nProcedureMap, ClubMember, Transaction",
                340, 20, 340, 62, db("fontSize=9;"), parent=L_db)

    c1 = p.node("Mensagem de BOAS-VINDAS (WhatsApp)\ntype='welcome' -> logAndSend\nSE nao ha template Meta aprovado -> nao entrega",
                60, 20, 340, 72, shp(ROXO, BORDA_RISCO), parent=L_cm)

    p.edge(u1, f2); p.edge(u2, f2); p.edge(u3, b1); p.edge(u4, b6); p.edge(u5, b5)
    p.edge(f1, f3, "clica no paciente")
    p.edge(f3, f4, "'Editar'")
    p.edge(b1, b2)
    p.edge(b2, b3, "Sim")
    p.edge(b3, d1)
    p.edge(b3, b4, "apos criar", dashed=True)
    p.edge(b4, c1, "", dashed=True)
    p.edge(b5, d1, "delete")
    p.edge(b6, d1)

    p.note("PONTA SOLTA (ALTA): triggerWelcome e chamado com .catch(() => {}) em patient.service.js:53. "
           "Qualquer erro no envio some - sem log, sem retry, sem visibilidade. "
           "Alem disso, se o AutomationTemplate de boas-vindas nao tiver metaTemplateName, "
           "o envio proativo cai em texto livre e a Meta REJEITA fora da janela de 24h.",
           60, 780, 700, 110, VERMELHO)
    p.note("VERIFICADO E OK: DELETE /patients/:id faz SOFT DELETE (patient.service.js:309-319 -> "
           "isActive: false). Relacionamentos com Appointment/Transaction/Evolution ficam preservados. "
           "Ponto de atencao remanescente: a exclusao NAO gera trilha de auditoria.",
           790, 780, 700, 110, VERDE)
    legend(p, 1300, 100)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 5. AGENDA E AGENDAMENTOS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_agenda():
    p = Page("05 - Agenda e Agendamentos")
    _hdr(p, "Agenda e Agendamentos",
         "GET /appointments | /calendar | /patient/:id | /:id  ||  POST /appointments  ||  PUT /appointments/:id. "
         "Sem rota DELETE - cancelamento e via PUT status=CANCELED.")

    L_u  = p.lane("Usuario", 40, 100, 1560, 110, "#eaf2fb")
    L_fe = p.lane("Frontend", 40, 210, 1560, 120, "#eaf2fb")
    L_be = p.lane("Backend", 40, 330, 1560, 300, "#eafbea")
    L_db = p.lane("Banco", 40, 630, 1560, 110, "#f2f2f2")
    L_cm = p.lane("Comunicacao / Assincrono", 40, 740, 1560, 130, "#f3eafb")

    u1 = p.node("Abre /agenda", 60, 26, 160, 44, shp(AZUL), parent=L_u)
    u2 = p.node("Clica em horario vazio\n-> modal 'Novo agendamento'", 250, 22, 220, 52, shp(AZUL), parent=L_u)
    u3 = p.node("Escolhe paciente, procedimento(s),\ncategoria, profissional, horario", 510, 22, 260, 52, shp(AZUL), parent=L_u)
    u4 = p.node("Clica 'Salvar'", 810, 26, 150, 44, shp(AZUL), parent=L_u)
    u5 = p.node("Arrasta / edita\n-> muda status", 1000, 22, 180, 52, shp(AZUL), parent=L_u)

    f1 = p.node("Agenda.jsx + components/calendar\nvisao dia/semana/mes", 60, 30, 240, 54, shp(AZUL), parent=L_fe)
    f2 = p.node("GET /appointments/calendar\n?from&to&types", 340, 30, 210, 54, shp(AZUL), parent=L_fe)
    f3 = p.node("Modal de agendamento\nenvia idempotencyKey", 590, 30, 210, 54, shp(AZUL), parent=L_fe)

    b1 = p.node("POST /appointments\nappointment.service.create()", 60, 26, 230, 50, shp(VERDE), parent=L_be)
    b2 = p.node("categoria exige paciente?\nconsulta|retorno -> SIM\nlembrete|pessoal -> NAO", 330, 20, 210, 66, dec(), parent=L_be)
    b3 = p.node("Paciente existe e isActive?", 580, 26, 200, 50, dec(), parent=L_be)
    b4 = p.node("Erro 'Paciente nao encontrado'", 580, 110, 200, 44, shp(VERMELHO), parent=L_be)
    b5 = p.node("idempotencyKey ja existe?\nfindUnique -> retorna o existente", 820, 20, 230, 66, dec(), parent=L_be)
    b6 = p.node("normalizeProcedures()\nprocedureType = 1o item\nproceduresTotal = soma", 1090, 20, 210, 66, shp(VERDE), parent=L_be)
    b7 = p.node("prisma.appointment.create\nstatus = SCHEDULED (default)", 1340, 26, 200, 54, shp(VERDE), parent=L_be)

    b8 = p.node("SEM VALIDACAO DE CONFLITO\nDE HORARIO / DISPONIBILIDADE\n(nenhum overlap check no service)",
                330, 170, 250, 70, shp(VERMELHO, BORDA_RISCO), parent=L_be)
    b9 = p.node("catch P2002 (race)\n-> retorna o existente\nIDEMPOTENCIA OK", 620, 170, 200, 66, shp(VERDE), parent=L_be)
    b10= p.node("PUT /appointments/:id  update()\nstatus COMPLETED|FINISHED\n-> consumePackageSession()\n-> gera Transaction (financeiro)",
                860, 165, 260, 78, shp(VERDE, "fontSize=9;"), parent=L_be)
    b11= p.node("triggerConfirmation() EXISTE\nMAS NINGUEM CHAMA\n= confirmacao nunca dispara",
                1170, 168, 240, 72, shp(VERMELHO, BORDA_RISCO), parent=L_be)

    d1 = p.node("Appointment\nstartsAt, endsAt, status, category,\nidempotencyKey (unique), recurrenceRule,\npackageItemId, professional (texto livre)",
                60, 18, 340, 72, db("fontSize=9;"), parent=L_db)
    d2 = p.node("AppointmentProcedure\n(N procedimentos por atendimento)", 440, 26, 250, 56, db(), parent=L_db)
    d3 = p.node("Transaction\n(gerada ao concluir)", 730, 26, 190, 56, db(), parent=L_db)
    d4 = p.node("BudgetSession / ProtocolSession\n(consumo de pacote)", 960, 26, 230, 56, db(), parent=L_db)

    c1 = p.node("CRON */30min runReminderCron()\nlembrete de consulta -> WhatsApp", 60, 26, 260, 56, shp(ROXO, "dashed=1;"), parent=L_cm)
    c2 = p.node("Paciente responde no WhatsApp\n-> confirm  -> status=CONFIRMED\n-> reschedule -> RESCHEDULE_REQUESTED",
                360, 20, 280, 70, shp(ROXO), parent=L_cm)
    c3 = p.node("Status RESCHEDULE_REQUESTED\nNAO TEM TELA/FILTRO DEDICADO\n-> risco de ficar orfao",
                680, 20, 250, 70, shp(VERMELHO, BORDA_RISCO), parent=L_cm)

    p.edge(u1, f1); p.edge(u2, f3); p.edge(u3, f3); p.edge(u4, b1); p.edge(u5, b10)
    p.edge(f1, f2)
    p.edge(b1, b2)
    p.edge(b2, b3, "Sim")
    p.edge(b2, b5, "Nao (lembrete)")
    p.edge(b3, b4, "Nao")
    p.edge(b3, b5, "Sim")
    p.edge(b5, b7, "Nao -> cria")
    p.edge(b5, b6, "normaliza")
    p.edge(b6, b7)
    p.edge(b7, b9, "P2002", dashed=True)
    p.edge(b7, d1)
    p.edge(b7, d2)
    p.edge(b1, b8, "AUSENTE", dashed=True)
    p.edge(b10, d3); p.edge(b10, d4); p.edge(b10, d1)
    p.edge(b7, b11, "deveria disparar", dashed=True)
    p.edge(c1, d1, "", dashed=True)
    p.edge(c2, d1, "actOnAppointment", dashed=True)
    p.edge(c2, c3, "", dashed=True)

    p.note("PONTA SOLTA CRITICA - Nao ha checagem de conflito de horario em create() nem em update(). "
           "Dois agendamentos podem ocupar exatamente o mesmo slot do mesmo profissional. "
           "A regra 'horario esta disponivel?' NAO EXISTE NO BACKEND. Se existe no frontend, e regra so de interface.",
           60, 890, 720, 100, VERMELHO)
    p.note("PONTA SOLTA CRITICA - triggerConfirmation(userId, appointment, patient) esta implementado em "
           "automation.service.js:198 mas o grep nao encontra NENHUM chamador. O paciente nunca recebe "
           "a confirmacao de agendamento. Ja diagnosticado, nao corrigido.",
           810, 890, 720, 100, VERMELHO)
    legend(p, 1620, 110)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 6. PROCEDIMENTOS E PROFISSIONAIS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_procedimentos():
    p = Page("06 - Procedimentos e Profissionais")
    _hdr(p, "Procedimentos e Profissionais",
         "GET/POST/PUT/DELETE /procedures (authMiddleware, sem requireFeature). "
         "Profissional NAO e uma entidade - e string livre em Appointment.professional.")

    y = 110
    n1 = p.node("Abre /procedures", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("'Novo procedimento'\nnome, preco, duracao", COL[0], y + 80, W, H, shp(AZUL))
    n3 = p.node("Vincula produtos consumidos\n(ProcedureProduct)", COL[0], y + 160, W, H, shp(AZUL))

    b1 = p.node("GET /procedures\nprocedure.service.findAll", COL[1], y, W, H, shp(VERDE))
    b2 = p.node("POST /procedures", COL[1], y + 80, W, H, shp(VERDE))
    b3 = p.node("PUT /procedures/:id", COL[1], y + 160, W, H, shp(VERDE))
    b4 = p.node("DELETE /procedures/:id", COL[1], y + 240, W, H, shp(VERMELHO, BORDA_RISCO))

    d1 = p.node("Procedure\nname, price, durationMin", COL[2], y, W, H, db())
    d2 = p.node("ProcedureProduct\nproduto + quantidade\nconsumida por sessao", COL[2], y + 80, W, 62, db())
    d3 = p.node("AppointmentProcedure\n(historico do atendimento)", COL[2], y + 170, W, H, db())

    e1 = p.node("Ao concluir atendimento:\nbaixa de estoque via\nProductMovement", COL[3], y + 80, W, 62, shp(VERDE))
    e2 = p.node("Preco alimenta\nTransaction (financeiro)\ne Budget (orcamento)", COL[3], y, W, 62, shp(VERDE))

    r1 = p.node("PONTA SOLTA: 'Profissional'\nnao existe como modelo.\nAppointment.professional e\nTEXTO LIVRE (typo = outro nome).",
                COL[4], y, W, 84, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: DELETE de\nprocedimento usado em\nagendamentos historicos -\ndependencia nao verificada.",
                COL[4], y + 100, W, 84, shp(VERMELHO, BORDA_RISCO))
    r3 = p.node("NAO IDENTIFICADO: agenda\npor profissional, comissao\npor profissional, escala\nou horario de trabalho.",
                COL[4], y + 200, W, 84, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, b1); p.edge(n2, b2); p.edge(n3, b3)
    p.edge(b1, d1); p.edge(b2, d1); p.edge(b3, d1); p.edge(b4, d1, "delete")
    p.edge(b3, d2)
    p.edge(d1, d3, "usado em atendimento")
    p.edge(d2, e1); p.edge(d1, e2)
    p.edge(b4, r2)
    p.edge(d3, r1)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 7. DOCUMENTOS, ANAMNESES E ASSINATURA
# ══════════════════════════════════════════════════════════════════════════════
def pagina_documentos():
    p = Page("07 - Documentos, Anamneses e Assinaturas")
    _hdr(p, "Documentos, Anamneses e Assinatura por OTP",
         "/documents (folders, upload, send, patient-doc/:id/sign, request-otp, validate-otp) | "
         "/anamnesis (templates, responses, finalize). Assinatura = OTP proprio, NAO e certificado ICP-Brasil.")

    L_u  = p.lane("Clinica", 40, 100, 1560, 110, "#eaf2fb")
    L_be = p.lane("Backend", 40, 210, 1560, 250, "#eafbea")
    L_pac= p.lane("Paciente", 40, 460, 1560, 130, "#eaf2fb")
    L_db = p.lane("Banco", 40, 590, 1560, 110, "#f2f2f2")

    u1 = p.node("Cria pasta\nPOST /documents/folders", 60, 26, 200, 52, shp(AZUL), parent=L_u)
    u2 = p.node("Upload de modelo\nPOST /documents/upload", 290, 26, 200, 52, shp(AZUL), parent=L_u)
    u3 = p.node("Clica 'Enviar ao paciente'\nPOST /documents/send", 520, 26, 210, 52, shp(AZUL), parent=L_u)
    u4 = p.node("Monta modelo de anamnese\nPOST /anamnesis/templates", 760, 26, 230, 52, shp(AZUL), parent=L_u)
    u5 = p.node("Preenche anamnese\nPOST /anamnesis/responses", 1020, 26, 220, 52, shp(AZUL), parent=L_u)
    u6 = p.node("'Finalizar'\nPOST /responses/:id/finalize", 1270, 26, 210, 52, shp(AZUL), parent=L_u)

    b1 = p.node("document.routes\nmulter -> uploads/ (disco local)", 60, 26, 240, 52, shp(VERDE), parent=L_be)
    b2 = p.node("Cria PatientDocument\nstatus = pendente", 340, 26, 200, 52, shp(VERDE), parent=L_be)
    b3 = p.node("POST /patient-doc/:id/request-otp\notp.service.requestOtp()", 580, 22, 240, 60, shp(VERDE), parent=L_be)
    b4 = p.node("Gera codigo + grava OtpCode\nenvia por e-mail (SES) ou WhatsApp", 860, 22, 260, 60, shp(ROXO), parent=L_be)
    b5 = p.node("POST /patient-doc/:id/validate-otp\ncodigo confere e nao expirou?", 1160, 22, 250, 60, dec(), parent=L_be)
    b6 = p.node("attempts+1 >= MAX_ATTEMPTS\n-> invalida o codigo", 1160, 110, 250, 56, shp(VERMELHO), parent=L_be)
    b7 = p.node("PUT /patient-doc/:id/sign\nstatus = assinado + signedAt", 860, 110, 260, 56, shp(VERDE), parent=L_be)
    b8 = p.node("DocumentVersion\nversionamento do modelo", 580, 110, 240, 56, shp(VERDE), parent=L_be)
    b9 = p.node("DELETE /patient-doc/:id\nremove documento do paciente", 60, 110, 240, 56, shp(VERMELHO, BORDA_RISCO), parent=L_be)
    b10= p.node("GET /:id/file  |  /patient-doc/:id/file\nservir arquivo (checa dono?)", 340, 110, 240, 56, shp(AMARELO), parent=L_be)

    pa1= p.node("Recebe link do documento\n(canal: WhatsApp / e-mail)", 60, 26, 240, 56, shp(ROXO), parent=L_pac)
    pa2= p.node("Solicita codigo\n'Receber codigo'", 340, 26, 190, 56, shp(AZUL), parent=L_pac)
    pa3= p.node("Digita o codigo OTP", 570, 26, 190, 56, shp(AZUL), parent=L_pac)
    pa4= p.node("Assina o documento", 800, 26, 190, 56, shp(AZUL), parent=L_pac)
    pa5= p.node("NAO IDENTIFICADO NO CODIGO:\ntela publica do paciente para\nvisualizar/assinar (rota frontend)",
                1030, 20, 280, 68, shp(VERMELHO, BORDA_RISCO), parent=L_pac)

    d1 = p.node("Document / DocumentFolder\nDocumentVersion", 60, 24, 240, 58, db(), parent=L_db)
    d2 = p.node("PatientDocument\nstatus, signedAt, signatureData", 340, 24, 250, 58, db(), parent=L_db)
    d3 = p.node("OtpCode\ncode, context, attempts, expiresAt", 630, 24, 250, 58, db(), parent=L_db)
    d4 = p.node("AnamnesisTemplate\nAnamnesisResponse", 920, 24, 230, 58, db(), parent=L_db)

    p.edge(u1, b1); p.edge(u2, b1); p.edge(b1, b2); p.edge(u3, b2)
    p.edge(b2, pa1, "envia link", dashed=True)
    p.edge(pa1, pa2); p.edge(pa2, b3); p.edge(b3, b4)
    p.edge(b4, pa3, "codigo", dashed=True)
    p.edge(pa3, b5)
    p.edge(b5, b6, "Nao")
    p.edge(b5, pa4, "Sim")
    p.edge(pa4, b7); p.edge(b7, d2)
    p.edge(b3, d3); p.edge(b1, d1); p.edge(b8, d1)
    p.edge(u4, d4); p.edge(u5, d4); p.edge(u6, d4)
    p.edge(b9, d2, "delete")

    p.note("REGRA CONFIRMADA: a 'assinatura digital' e um aceite com OTP (codigo enviado ao paciente) "
           "gravado em PatientDocument. NAO ha certificado digital ICP-Brasil, carimbo de tempo, "
           "nem hash do documento assinado no codigo lido. Valor juridico exige VALIDACAO HUMANA/JURIDICA.",
           60, 720, 720, 100, VERMELHO)
    p.note("PONTA SOLTA: uploads vao para disco local (uploads/ servido por express.static). "
           "Existe script migrate-uploads-to-s3.js, mas o app.js ainda serve do disco - "
           "em EC2 com redeploy, arquivos podem se perder. INTEGRACAO S3 PENDENTE OU PARCIAL.",
           810, 720, 720, 100, VERMELHO)
    legend(p, 1620, 110)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 8. EVOLUCOES E FOTOGRAFIAS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_evolucoes():
    p = Page("08 - Evolucoes e Fotografias")
    _hdr(p, "Evolucoes, Fotografias e Mapa de Procedimentos",
         "/evolutions (POST + GET) | /photos (patient/:id, :id/file, DELETE) | "
         "/procedure-maps (feature 'procedureMap') | /protocols | /portfolio")

    y = 110
    n1 = p.node("Abre PatientDetails\naba 'Evolucoes'", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("Escreve evolucao\ne clica 'Salvar'", COL[0], y + 80, W, H, shp(AZUL))
    n3 = p.node("'Gerar com IA'\n(rascunho)", COL[0], y + 160, W, H, shp(AZUL))
    n4 = p.node("Upload de fotos\nantes/depois", COL[0], y + 240, W, H, shp(AZUL))
    n5 = p.node("Marca pontos no\nMapa de Procedimentos", COL[0], y + 320, W, H, shp(AZUL))

    b1 = p.node("POST /evolutions\nevolution.service", COL[1], y + 40, W, H, shp(VERDE))
    b2 = p.node("POST /ai/evolution-draft\nrequireFeature('aiAssistant')", COL[1], y + 160, W, H, shp(VERDE))
    b3 = p.node("POST /photos/patient/:id\nmulter -> disco", COL[1], y + 240, W, H, shp(VERDE))
    b4 = p.node("POST /procedure-maps/patient/:id\nPOST /:id/retorno", COL[1], y + 320, W, H, shp(VERDE))

    x1 = p.node("OpenAI API\n(consome cota de IA)", COL[2], y + 160, W, H, shp(LARANJA))
    q1 = p.node("checkQuota('ai')\nesgotada -> bloqueia", COL[2], y + 240, W, H, shp(AMARELO))

    d1 = p.node("Evolution", COL[3], y + 40, W, 44, db())
    d2 = p.node("PatientPhoto\n(arquivo em disco)", COL[3], y + 110, W, H, db())
    d3 = p.node("ProcedureMap\npontos + produtos + retorno", COL[3], y + 190, W, H, db())
    d4 = p.node("UsageCounter / UsageEvent\nledger de cotas", COL[3], y + 270, W, H, db())
    d5 = p.node("PortfolioCase\n(caso publicavel)", COL[3], y + 350, W, H, db())

    r1 = p.node("PONTA SOLTA: /photos e\n/evolutions NAO tem\nrequireFeature - qualquer\nplano acessa (divergencia\ncom o menu do frontend).",
                COL[4], y, W, 96, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: DELETE de foto\nremove o registro; remocao\ndo arquivo em disco nao\nconfirmada = lixo acumulado.",
                COL[4], y + 120, W, 84, shp(VERMELHO, BORDA_RISCO))
    r3 = p.node("RISCO LGPD: fotos clinicas\nservidas por /uploads estatico.\nControle de acesso ao arquivo\nexige VALIDACAO HUMANA.",
                COL[4], y + 230, W, 84, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, b1); p.edge(n2, b1); p.edge(n3, b2); p.edge(n4, b3); p.edge(n5, b4)
    p.edge(b2, q1); p.edge(q1, x1, "com cota"); p.edge(x1, d4, "debita", dashed=True)
    p.edge(b1, d1); p.edge(b3, d2); p.edge(b4, d3)
    p.edge(d2, d5, "vira caso de portfolio")
    p.edge(b3, r2); p.edge(d2, r3)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 9. ORCAMENTOS E PAGAMENTOS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_orcamentos():
    p = Page("09 - Orcamentos e Pagamentos")
    _hdr(p, "Orcamentos, Pacotes e Cobranca ao Paciente",
         "/budgets (patient/:id, POST, PATCH :id/status, sessions) | /packages/overview | /protocols | "
         "/billing/charges (Asaas)")

    L_u  = p.lane("Clinica", 40, 100, 1560, 110, "#eaf2fb")
    L_be = p.lane("Backend", 40, 210, 1560, 240, "#eafbea")
    L_ext= p.lane("Asaas (externo)", 40, 450, 1560, 130, "#ffeedd")
    L_db = p.lane("Banco", 40, 580, 1560, 110, "#f2f2f2")
    L_pac= p.lane("Paciente", 40, 690, 1560, 110, "#f3eafb")

    u1 = p.node("Monta orcamento\nprocedimentos + sessoes", 60, 26, 210, 52, shp(AZUL), parent=L_u)
    u2 = p.node("'Aprovar orcamento'\nPATCH /budgets/:id/status", 300, 26, 220, 52, shp(AZUL), parent=L_u)
    u3 = p.node("'Gerar cobranca'\nPOST /billing/charges", 550, 26, 200, 52, shp(AZUL), parent=L_u)
    u4 = p.node("Escolhe PIX / boleto / cartao\n+ parcelas", 780, 26, 230, 52, shp(AZUL), parent=L_u)
    u5 = p.node("'Enviar link'\nPOST /charges/:id/send-link", 1040, 26, 220, 52, shp(AZUL), parent=L_u)
    u6 = p.node("'Cancelar cobranca'\nDELETE /charges/:id", 1290, 26, 210, 52, shp(AZUL), parent=L_u)

    b1 = p.node("budget.service\ncria Budget + BudgetItem", 60, 26, 210, 52, shp(VERDE), parent=L_be)
    b2 = p.node("status = aprovado\n-> libera BudgetSession\n(isPackage = pacote de sessoes)", 300, 20, 230, 64, shp(VERDE), parent=L_be)
    b3 = p.node("billing.service.createCharge\nfindOrCreateCustomer(paciente)", 570, 20, 240, 64, shp(VERDE), parent=L_be)
    b4 = p.node("Clinica tem asaasApiKey\nconfigurada?", 850, 20, 200, 64, dec(), parent=L_be)
    b5 = p.node("Erro - config ausente\n(sem fallback manual)", 850, 110, 200, 52, shp(VERMELHO), parent=L_be)
    b6 = p.node("Aplica SPLIT IASOPay\niasoRevenue + splitApplied", 1090, 20, 230, 64, shp(VERDE), parent=L_be)
    b7 = p.node("Cria Transaction\nstatus = pendente", 1360, 26, 190, 52, shp(VERDE), parent=L_be)
    b8 = p.node("POST /charges/:id/simulate\nSO EM SANDBOX", 570, 110, 240, 52, shp(AMARELO), parent=L_be)
    b9 = p.node("consumePackageSession()\nao concluir atendimento", 300, 110, 230, 52, shp(VERDE), parent=L_be)

    x1 = p.node("POST /v3/payments\ncria cobranca", 60, 26, 200, 52, shp(LARANJA), parent=L_ext)
    x2 = p.node("Gera link PIX / boleto\n/ checkout cartao", 300, 26, 210, 52, shp(LARANJA), parent=L_ext)
    x3 = p.node("Webhook -> POST /billing/webhook\nvalida asaas-access-token", 560, 20, 260, 64, shp(LARANJA), parent=L_ext)
    x4 = p.node("PAYMENT_CONFIRMED / RECEIVED\n-> Transaction status='pago'\n+ netAmount + feeAmount", 870, 16, 260, 72, shp(VERDE), parent=L_ext)
    x5 = p.node("PAYMENT_REFUNDED -> estornado\nPAYMENT_DELETED -> cancelado\nPAYMENT_OVERDUE -> no-op", 1170, 16, 270, 72, shp(AMARELO), parent=L_ext)

    d1 = p.node("Budget / BudgetItem / BudgetSession", 60, 26, 280, 52, db(), parent=L_db)
    d2 = p.node("Transaction\nstatus, netAmount, feeAmount,\nsplitApplied, iasoRevenue", 380, 20, 250, 64, db(), parent=L_db)
    d3 = p.node("Protocol / ProtocolSession", 670, 26, 230, 52, db(), parent=L_db)
    d4 = p.node("SplitConfig / CardFee", 940, 26, 210, 52, db(), parent=L_db)

    pa1= p.node("Recebe link de pagamento\n(WhatsApp / e-mail)", 60, 26, 230, 52, shp(ROXO), parent=L_pac)
    pa2= p.node("Paga", 320, 30, 140, 44, shp(AZUL), parent=L_pac)
    pa3= p.node("NAO IDENTIFICADO:\nconfirmacao automatica ao paciente apos o pagamento",
                500, 22, 330, 60, shp(VERMELHO, BORDA_RISCO), parent=L_pac)

    p.edge(u1, b1); p.edge(u2, b2); p.edge(u3, b3); p.edge(u4, b3); p.edge(u5, pa1); p.edge(u6, x1, "cancel")
    p.edge(b1, d1); p.edge(b2, d1); p.edge(b2, b9)
    p.edge(b3, b4)
    p.edge(b4, b5, "Nao")
    p.edge(b4, b6, "Sim")
    p.edge(b6, b7); p.edge(b7, d2); p.edge(b6, d4)
    p.edge(b3, x1, "API Asaas")
    p.edge(x1, x2); p.edge(x2, pa1, "", dashed=True)
    p.edge(pa2, x3, "", dashed=True)
    p.edge(x3, x4); p.edge(x3, x5)
    p.edge(x4, d2, "updateMany", dashed=True)
    p.edge(pa2, pa3)
    p.edge(b8, x4, "simula", dashed=True)

    p.note("PONTA SOLTA (ALTA): o webhook do Asaas sempre responde 200 mesmo em erro "
           "(catch -> res.status(200)) 'para o Asaas nao retentar'. Se handleWebhook falhar no meio, "
           "o pagamento fica CONFIRMADO no Asaas e PENDENTE no Iasoclin, sem retry e sem alerta. "
           "Nao ha DLQ nem reconciliacao periodica identificada.",
           60, 820, 740, 110, VERMELHO)
    p.note("PONTA SOLTA (MEDIA): se ASAAS_WEBHOOK_TOKEN nao estiver configurado, o webhook ACEITA "
           "qualquer chamada (comentario explicito no codigo: 'nao quebra caso o token ainda nao "
           "tenha sido setado'). Em producao isso permite forjar confirmacao de pagamento.",
           830, 820, 700, 110, VERMELHO)
    legend(p, 1620, 110)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 10. FINANCEIRO
# ══════════════════════════════════════════════════════════════════════════════
def pagina_financeiro():
    p = Page("10 - Financeiro")
    _hdr(p, "Financeiro da Clinica",
         "/financial (GET, POST, PUT :id, PATCH :id/approve, PATCH :id/cancel, DELETE :id, summary, analytics, upcoming, card-fees). "
         "requireFeature('financial').")

    y = 110
    n1 = p.node("Abre /financeiro", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("'Novo lancamento'\nreceita ou despesa", COL[0], y + 80, W, H, shp(AZUL))
    n3 = p.node("'Aprovar' lancamento\npendente", COL[0], y + 160, W, H, shp(AZUL))
    n4 = p.node("'Cancelar'", COL[0], y + 240, W, H, shp(AZUL))
    n5 = p.node("'Excluir'", COL[0], y + 320, W, H, shp(AZUL))
    n6 = p.node("Configura taxas de cartao\n(CardFee)", COL[0], y + 400, W, H, shp(AZUL))

    b1 = p.node("GET /financial/summary\n+ /analytics + /upcoming", COL[1], y, W, H, shp(VERDE))
    b2 = p.node("POST /financial\ncreate() ou createPending()", COL[1], y + 80, W, H, shp(VERDE))
    b3 = p.node("PATCH /:id/approve\napprove()", COL[1], y + 160, W, H, shp(VERDE))
    b4 = p.node("PATCH /:id/cancel", COL[1], y + 240, W, H, shp(VERDE))
    b5 = p.node("DELETE /:id  remove()", COL[1], y + 320, W, H, shp(VERMELHO, BORDA_RISCO))
    b6 = p.node("GET/POST/PUT/DELETE\n/financial/card-fees", COL[1], y + 400, W, H, shp(VERDE))

    dec1 = p.node("Lancamento veio de\ncobranca Asaas?", COL[2], y + 80, W, H, dec())
    dec2 = p.node("Pagamento em cartao?\naplica CardFee -> netAmount", COL[2], y + 160, W, 62, dec())

    d1 = p.node("Transaction\ntype, status, amount,\nnetAmount, feeAmount,\npaidAt, dueDate",
                COL[3], y + 60, W, 84, db("fontSize=9;"))
    d2 = p.node("CardFee\nbandeira, parcelas, %", COL[3], y + 170, W, H, db())

    e1 = p.node("Dashboard recalcula\nGET /dashboard/stats", COL[4], y, W, H, shp(VERDE))
    e2 = p.node("Relatorios\nGET /reports", COL[4], y + 80, W, H, shp(VERDE))
    e3 = p.node("Faturamento (baixa)\npage Faturamento.jsx", COL[4], y + 160, W, H, shp(VERDE))

    r1 = p.node("PONTA SOLTA: status de\nTransaction sao STRINGS livres\n('pago','pendente','cancelado',\n'estornado','aprovado') - sem\nenum Prisma = risco de typo.",
                COL[4], y + 250, W, 96, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: DELETE de\nlancamento ja pago apaga\nhistorico financeiro sem\ntrilha de auditoria.",
                COL[4], y + 370, W, 84, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, b1); p.edge(n2, b2); p.edge(n3, b3); p.edge(n4, b4); p.edge(n5, b5); p.edge(n6, b6)
    p.edge(b2, dec1); p.edge(dec1, dec2, "Nao (manual)")
    p.edge(dec1, d1, "Sim - ja existe")
    p.edge(dec2, d1); p.edge(b3, d1); p.edge(b4, d1); p.edge(b5, d1, "delete"); p.edge(b6, d2)
    p.edge(d2, dec2, "", dashed=True)
    p.edge(d1, e1, "", dashed=True); p.edge(d1, e2, "", dashed=True); p.edge(d1, e3, "", dashed=True)
    p.edge(b5, r2); p.edge(d1, r1)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 11. ESTOQUE
# ══════════════════════════════════════════════════════════════════════════════
def pagina_estoque():
    p = Page("11 - Estoque")
    _hdr(p, "Estoque, Movimentacoes e Requisicoes",
         "/products (GET, POST, PUT, DELETE, low-stock, movements/all, :id/movements, stock-requests, "
         "PATCH :id/approve, PATCH :id/reject). requireFeature('stock').")

    y = 110
    n1 = p.node("Abre /products", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("'Novo produto'\nnome, qtd, minQty, preco", COL[0], y + 80, W, H, shp(AZUL))
    n3 = p.node("Registra movimentacao\n(entrada / saida)", COL[0], y + 160, W, H, shp(AZUL))
    n4 = p.node("Cria requisicao de compra\nPOST /stock-requests", COL[0], y + 240, W, H, shp(AZUL))
    n5 = p.node("'Aprovar' / 'Rejeitar'\nrequisicao", COL[0], y + 320, W, H, shp(AZUL))

    b1 = p.node("GET /products\n+ /low-stock", COL[1], y, W, H, shp(VERDE))
    b2 = p.node("POST /products", COL[1], y + 80, W, H, shp(VERDE))
    b3 = p.node("POST /:id/movements\nProductMovement", COL[1], y + 160, W, H, shp(VERDE))
    b4 = p.node("POST /stock-requests", COL[1], y + 240, W, H, shp(VERDE))
    b5 = p.node("PATCH /stock-requests/:id/approve\n/reject", COL[1], y + 320, W + 30, H, shp(VERDE))

    dec1= p.node("quantity <= minQuantity?", COL[2], y, W, H, dec())
    dec2= p.node("Saida maior que o saldo?\nVALIDADO: newStock < 0 -> erro\n'Estoque insuficiente'",
                 COL[2], y + 160, W, 68, dec(VERDE))

    d1 = p.node("Product\nquantity, minQuantity,\ncategory, supplier, unitPrice", COL[3], y + 60, W, 68, db())
    d2 = p.node("ProductMovement\ntipo, quantidade, motivo", COL[3], y + 150, W, H, db())
    d3 = p.node("StockRequest\nstatus (pendente/aprovado/rejeitado)", COL[3], y + 230, W, H, db())

    e1 = p.node("Alerta de estoque baixo\nna tela (badge)", COL[4], y, W, H, shp(AMARELO))
    e2 = p.node("Baixa automatica ao concluir\natendimento (ProcedureProduct)", COL[4], y + 90, W, 62, shp(VERDE))

    r1 = p.node("PONTA SOLTA: alerta de\nestoque baixo NAO gera\nnotificacao (e-mail/WhatsApp)\n- so aparece se abrir a tela.",
                COL[4], y + 180, W, 84, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: aprovacao de\nrequisicao nao notifica quem\nsolicitou; sem fluxo de\nrecebimento/entrada apos aprovar.",
                COL[4], y + 285, W, 84, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, b1); p.edge(n2, b2); p.edge(n3, b3); p.edge(n4, b4); p.edge(n5, b5)
    p.edge(b1, dec1); p.edge(dec1, e1, "Sim")
    p.edge(b2, d1); p.edge(b3, dec2); p.edge(dec2, d2, "Nao -> $transaction atomica")
    p.edge(d2, d1, "atualiza saldo")
    p.edge(b4, d3); p.edge(b5, d3)
    p.edge(e2, d2, "", dashed=True)
    p.edge(e1, r1); p.edge(b5, r2)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 12. CRM E COMERCIAL
# ══════════════════════════════════════════════════════════════════════════════
def pagina_crm():
    p = Page("12 - CRM e Comercial")
    _hdr(p, "CRM, Funil Comercial e Customer Success (painel Admin IASO)",
         "/admin/leads (GET, POST, PATCH, DELETE) | /admin/cs (notes, clinics/:id/cancel, reactivate) | "
         "/admin/ios/commercial (canais, campanhas, parceiros, comissoes)")

    y = 110
    n1 = p.node("Visitante preenche\n/comece-agora", COL[0], y, W, H, shp(AZUL))
    n2 = p.node("Admin abre funil\nde leads", COL[0], y + 90, W, H, shp(AZUL))
    n3 = p.node("Move lead de estagio", COL[0], y + 180, W, H, shp(AZUL))
    n4 = p.node("Registra nota de CS", COL[0], y + 270, W, H, shp(AZUL))
    n5 = p.node("Cancela / reativa clinica", COL[0], y + 360, W, H, shp(AZUL))

    b1 = p.node("POST /auth/demo\ncria conta demo (TTL 48h)", COL[1], y, W + 30, H, shp(VERDE))
    b2 = p.node("POST /admin/leads", COL[1], y + 90, W + 30, H, shp(VERDE))
    b3 = p.node("PATCH /admin/leads/:id\n-> LeadStageHistory", COL[1], y + 180, W + 30, H, shp(VERDE))
    b4 = p.node("POST /admin/cs/notes", COL[1], y + 270, W + 30, H, shp(VERDE))
    b5 = p.node("PATCH /admin/cs/clinics/:id/cancel\n/reactivate", COL[1], y + 360, W + 30, H, shp(VERDE))

    d1 = p.node("Lead\nstage, origem, contato", COL[2], y, W, H, db())
    d2 = p.node("LeadStageHistory\ntrilha do funil", COL[2], y + 90, W, H, db())
    d3 = p.node("CsNote", COL[2], y + 180, W, 44, db())
    d4 = p.node("User.subscriptionStatus\ncanceled / active", COL[2], y + 250, W, H, db())
    d5 = p.node("IosCommercialChannel\nIosCampaign / IosPartner\nIosCommission", COL[2], y + 330, W, 62, db())

    e1 = p.node("Conta demo expira\nCRON 15 * * * *\ncleanupExpiredDemos()", COL[3], y, W, 62, shp(VERDE, "dashed=1;"))
    e2 = p.node("Gate de contratacao\n/contratar -> POST /billing/contratar", COL[3], y + 90, W, 62, shp(AMARELO))
    e3 = p.node("Dashboard Admin\nMRR, CAC, LTV, churn", COL[3], y + 180, W, H, shp(VERDE))

    r1 = p.node("PONTA SOLTA: nao ha\nautomacao de nutricao do lead\n(nenhum e-mail/WhatsApp\ndisparado por mudanca de estagio).",
                COL[4], y, W, 90, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("PONTA SOLTA: DELETE /admin/leads/:id\napaga o lead e o historico\nde estagios - perda de\ndado comercial sem auditoria.",
                COL[4], y + 110, W, 90, shp(VERMELHO, BORDA_RISCO))
    r3 = p.node("PONTA SOLTA: cancelamento de\nclinica nao dispara comunicacao\nao cliente nem exporta os dados\n(LGPD - direito de portabilidade).",
                COL[4], y + 220, W, 90, shp(VERMELHO, BORDA_RISCO))

    p.edge(n1, b1); p.edge(n2, b2); p.edge(n3, b3); p.edge(n4, b4); p.edge(n5, b5)
    p.edge(b1, d1); p.edge(b1, e1, "", dashed=True)
    p.edge(b2, d1); p.edge(b3, d2); p.edge(b4, d3); p.edge(b5, d4)
    p.edge(b1, e2, "demo -> contratacao")
    p.edge(d1, e3, "", dashed=True); p.edge(d4, e3, "", dashed=True)
    p.edge(b3, r1); p.edge(b2, r2); p.edge(b5, r3)
    p.edge(d5, e3, "", dashed=True)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 13. WHATSAPP E CENTRAL DE ATENDIMENTO
# ══════════════════════════════════════════════════════════════════════════════
def pagina_whatsapp():
    p = Page("13 - WhatsApp e Central de Atendimento")
    _hdr(p, "WhatsApp: envio ativo, webhook da Meta, inbound do paciente e Iaso Suporte",
         "GET/POST /whatsapp/webhook (publico, HMAC) | /whatsapp connect/status/disconnect | "
         "/automations | /conversations | modulo support (NAO MONTADO)")

    L_pac = p.lane("Paciente / Clinica-cliente", 40, 100, 1560, 110, "#eaf2fb")
    L_meta= p.lane("Meta WhatsApp Cloud API", 40, 210, 1560, 120, "#ffeedd")
    L_be  = p.lane("Backend - recepcao", 40, 330, 1560, 190, "#eafbea")
    L_wk  = p.lane("Worker assincrono", 40, 520, 1560, 200, "#eafbea")
    L_db  = p.lane("Banco", 40, 720, 1560, 110, "#f2f2f2")

    pa1 = p.node("Paciente responde\n'Confirmar' / 'Remarcar' / texto", 60, 24, 250, 56, shp(AZUL), parent=L_pac)
    pa2 = p.node("Clinica-cliente escreve para\no numero da CENTRAL IASO", 350, 24, 250, 56, shp(AZUL), parent=L_pac)
    pa3 = p.node("Paciente NAO responde\n-> nenhum tratamento de\ntimeout/sem-resposta", 650, 18, 240, 68, shp(VERMELHO, BORDA_RISCO), parent=L_pac)

    m1 = p.node("GET /whatsapp/webhook\nverifyWebhook (hub.challenge)", 60, 26, 250, 56, shp(LARANJA), parent=L_meta)
    m2 = p.node("POST /whatsapp/webhook\nentry[].changes[].value", 350, 26, 240, 56, shp(LARANJA), parent=L_meta)
    m3 = p.node("value.statuses[]\nsent|delivered|read|failed", 640, 26, 240, 56, shp(LARANJA), parent=L_meta)
    m4 = p.node("Envio ativo: templates aprovados\n*_iaso (fora da janela 24h)", 930, 26, 260, 56, shp(LARANJA), parent=L_meta)

    b1 = p.node("isValidSignature(req)\nHMAC SHA256 com APP_SECRET\nfalha -> 401", 60, 20, 230, 66, dec(), parent=L_be)
    b2 = p.node("res.sendStatus(200) IMEDIATO\ndepois processa (Meta reenvia se demorar)", 330, 20, 290, 66, shp(VERDE), parent=L_be)
    b3 = p.node("enqueueWebhookEvent(change)\n.catch(() => {})  <- FALHA SILENCIOSA", 660, 20, 280, 66, shp(VERMELHO, BORDA_RISCO), parent=L_be)
    b4 = p.node("statuses -> automationLog.updateMany\n(status de entrega)", 980, 20, 270, 66, shp(VERDE), parent=L_be)
    b5 = p.node("processInboundMessage(msg)\nFLUXO LEGADO, roda em PARALELO\nao worker novo", 1290, 16, 250, 74, shp(AMARELO, BORDA_RISCO), parent=L_be)

    w1 = p.node("webhookWorker (in-process)\nBATCH=20, MAX_ATTEMPTS=5\nbackoff 0/1/5/15/60 min", 60, 20, 250, 70, shp(VERDE, "dashed=1;"), parent=L_wk)
    w2 = p.node("isSupportNumber(phone_number_id)\n== SUPPORT_PHONE_NUMBER_ID?", 350, 20, 260, 70, dec(), parent=L_wk)
    w3 = p.node("SUPORTE IASO\nrecordInboundSupportMessage\n+ triagem -> resposta automatica", 650, 16, 250, 78, shp(ROXO), parent=L_wk)
    w4 = p.node("INBOX CLINICA\nrecordInboundMessage\n-> Contact/Conversation/Message", 940, 16, 250, 78, shp(VERDE), parent=L_wk)
    w5 = p.node("Apos MAX_ATTEMPTS -> 'failed'\nSAI DA ROTACAO, sem alerta\ne sem tela de reprocessamento", 1230, 16, 300, 78, shp(VERMELHO, BORDA_RISCO), parent=L_wk)

    d1 = p.node("WebhookEvent (a fila)\nstatus, attempts, receivedAt", 60, 24, 240, 58, db(), parent=L_db)
    d2 = p.node("WhatsappInbound (legado)\nContact / Conversation / Message", 340, 24, 260, 58, db(), parent=L_db)
    d3 = p.node("AutomationLog\nstatus: pending|sent|skipped|failed", 640, 24, 260, 58, db(), parent=L_db)
    d4 = p.node("SupportTicket / SupportMessage\nSupportDepartment / SupportContact", 940, 24, 270, 58, db(BORDA_RISCO), parent=L_db)

    p.edge(pa1, m2); p.edge(pa2, m2)
    p.edge(m2, b1); p.edge(b1, b2, "assinatura OK")
    p.edge(b2, b3); p.edge(b2, b4); p.edge(b2, b5)
    p.edge(b3, d1, "enfileira", dashed=True)
    p.edge(d1, w1, "drena", dashed=True)
    p.edge(w1, w2); p.edge(w2, w3, "Sim"); p.edge(w2, w4, "Nao")
    p.edge(w1, w5, "esgotou retries", dashed=True)
    p.edge(w3, d4); p.edge(w4, d2)
    p.edge(b4, d3); p.edge(b5, d2)
    p.edge(m4, d3, "envio ativo", dashed=True)
    p.edge(m3, b4, "", dashed=True)

    p.note("PONTA SOLTA CRITICA - Os tickets do Iaso Suporte sao GRAVADOS mas NAO HA COMO ATENDE-LOS: "
           "o modulo support nao tem rotas nem esta em app.js, e nao ha tela. A triagem responde "
           "automaticamente, mas qualquer escalonamento para humano morre no banco.",
           60, 850, 740, 100, VERMELHO)
    p.note("PONTA SOLTA CRITICA - Convivem DOIS caminhos para a mesma mensagem inbound: "
           "processInboundMessage (legado -> WhatsappInbound) e o webhookWorker (novo -> Conversation). "
           "Ambos rodam no mesmo evento. Risco de divergencia de estado e de acao duplicada na agenda.",
           830, 850, 700, 100, VERMELHO)
    p.note("KILL SWITCH: WHATSAPP_SEND_ENABLED controla todo envio. Desligado = nada sai, mas o "
           "registro (ticket/log) acontece igual. Confirmado no webhookWorker e no provider.",
           60, 970, 740, 70, AMARELO)
    p.note("attributeToClinic(phone): se nao houve envio recente para o numero, a mensagem e "
           "DESCARTADA SILENCIOSAMENTE ('melhor nao poluir'). Paciente que escreve primeiro nunca e visto.",
           830, 970, 700, 70, VERMELHO)
    legend(p, 1620, 110)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 14. NOTIFICACOES E COMUNICACOES
# ══════════════════════════════════════════════════════════════════════════════
def pagina_notificacoes():
    p = Page("14 - Notificacoes e Comunicacoes")
    _hdr(p, "Matriz de comunicacoes - quem dispara, quando, por qual canal",
         "Canal unico efetivo = WhatsApp (Meta Cloud API). E-mail so via SES no OTP. "
         "SMS e PUSH: NAO IDENTIFICADOS NO CODIGO.")

    y = 110
    cab = ["EVENTO / GATILHO", "QUEM DISPARA", "DESTINATARIO", "CANAL / TEMPLATE", "STATUS NO CODIGO"]
    xs  = [60, 380, 640, 900, 1220]
    ws  = [310, 250, 250, 310, 320]
    for i, c in enumerate(cab):
        p.node(c, xs[i], y, ws[i], 40, shp("fillColor=#333333;strokeColor=#333333;fontColor=#ffffff;", "fontStyle=1;"))

    linhas = [
        ("Paciente cadastrado", "patient.service.create ->\ntriggerWelcome()", "Paciente", "WhatsApp\ntype='welcome'",
         "FRAGIL - .catch(() => {}) e\nsem template Meta = nao entrega", VERMELHO),
        ("Agendamento criado", "triggerConfirmation()", "Paciente", "WhatsApp\ntype='confirmation'",
         "NUNCA DISPARA -\nnenhum chamador no codigo", VERMELHO),
        ("Aniversario do paciente", "CRON 0 9 * * *\nrunBirthdayCron()", "Paciente", "WhatsApp\ntype='birthday'",
         "Dispara, mas sem template\naprovado nao entrega", VERMELHO),
        ("Lembrete de consulta", "CRON */30 * * * *\nrunReminderCron()", "Paciente", "WhatsApp\ntype='reminder'",
         "FUNCIONA (validado em prod)", VERDE),
        ("Paciente respondeu", "inbound.service ->\nnotifyOwner()", "Dona da clinica", "WhatsApp\nresposta_paciente_iaso",
         "FUNCIONA - best-effort,\nsilencioso em falha", AMARELO),
        ("Documento para assinar", "otp.service.requestOtp()", "Paciente", "E-mail (SES)\nou WhatsApp",
         "Funciona - OTP com\nMAX_ATTEMPTS e expiracao", VERDE),
        ("Cobranca gerada", "sendPaymentLink()", "Paciente", "Link Asaas via\nWhatsApp",
         "Manual - exige clicar\n'Enviar link'", AMARELO),
        ("Pagamento confirmado", "webhook Asaas", "-", "-",
         "NENHUMA notificacao ao\npaciente nem a clinica", VERMELHO),
        ("Estoque baixo", "GET /products/low-stock", "Clinica", "Badge na tela",
         "SEM notificacao ativa -\nso vendo a tela", VERMELHO),
        ("Assinatura vencida", "blockOverdue / reconcile", "Clinica", "Tela /acesso-bloqueado",
         "Sem aviso PREVIO ao\nbloqueio (nao identificado)", VERMELHO),
        ("Ticket de suporte", "support.triage", "Clinica-cliente", "WhatsApp\n(central IASO)",
         "Resposta automatica OK,\nmas sem atendente humano", VERMELHO),
        ("Cota de IA/WhatsApp\nesgotada", "checkQuota()", "-", "-",
         "So bloqueia e grava\n'skipped' - sem avisar", VERMELHO),
        ("Notificacao interna admin", "AdminNotification\nGET /admin/notifications", "Admin IASO", "In-app",
         "Existe (read / read-all)", VERDE),
    ]
    yy = y + 44
    for ev, quem, dest, canal, status, cor in linhas:
        alt = "fillColor=#fbfbfb;strokeColor=#b3b3b3;"
        p.node(ev,    xs[0], yy, ws[0], 58, shp(alt, "fontSize=10;align=left;spacingLeft=6;"))
        p.node(quem,  xs[1], yy, ws[1], 58, shp(alt, "fontSize=9;"))
        p.node(dest,  xs[2], yy, ws[2], 58, shp(alt, "fontSize=10;"))
        p.node(canal, xs[3], yy, ws[3], 58, shp(ROXO, "fontSize=9;"))
        p.node(status,xs[4], yy, ws[4], 58, shp(cor, "fontSize=9;"))
        yy += 62

    p.note("NAO IDENTIFICADOS NO CODIGO: SMS, push notification, e-mail transacional de marketing, "
           "central de preferencias de comunicacao do paciente, opt-out / descadastro (LGPD), "
           "e reenvio manual de mensagem que falhou.",
           60, yy + 20, 700, 90, VERMELHO)
    p.note("PIPELINE DE ENVIO (logAndSend em automation.service.js): "
           "1) sem phoneNumberId/token -> 'skipped'  2) checkQuota falhou -> 'skipped' + error='quota_exceeded'  "
           "3) cria AutomationLog 'pending'  4) template aprovado -> sendWhatsAppTemplate, senao texto livre  "
           "5) consumeQuota SO apos sucesso  6) 'sent' + sentAt  7) erro -> 'failed' + error.",
           790, yy + 20, 760, 90, VERDE)
    legend(p, 1620, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 15. INTEGRACOES E WEBHOOKS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_integracoes():
    p = Page("15 - Integracoes Externas e Webhooks")
    _hdr(p, "Integracoes externas, webhooks de entrada e variaveis de ambiente",
         "Meta WhatsApp | Asaas (cobranca + split IASOPay) | OpenAI | AWS (S3, SES, RDS, EC2, CloudFront)")

    y = 110
    # Meta
    m0 = p.node("META / WhatsApp Cloud API", COL[0], y, W + 40, 40, shp(LARANJA, "fontStyle=1;"))
    m1 = p.node("SAIDA: sendWhatsAppMessage\nsendWhatsAppTemplate\n(kill switch WHATSAPP_SEND_ENABLED)", COL[0], y + 50, W + 40, 68, shp(LARANJA))
    m2 = p.node("ENTRADA: POST /whatsapp/webhook\nHMAC SHA256 com APP_SECRET\nverify: rawBody guardado no express.json", COL[0], y + 128, W + 40, 68, shp(LARANJA))
    m3 = p.node("Embedded Signup\nPOST /whatsapp/connect\nGET /status  POST /disconnect", COL[0], y + 206, W + 40, 62, shp(LARANJA))
    m4 = p.node("Vars: WHATSAPP_PHONE_NUMBER_ID,\nWHATSAPP_ACCESS_TOKEN, APP_SECRET,\nWABA_ID, SUPPORT_PHONE_NUMBER_ID,\nSUPPORT_ACCESS_TOKEN, WHATSAPP_SEND_ENABLED",
                COL[0], y + 278, W + 40, 82, shp(CINZA, "fontSize=9;"))

    # Asaas
    a0 = p.node("ASAAS (pagamentos)", COL[2], y, W + 40, 40, shp(LARANJA, "fontStyle=1;"))
    a1 = p.node("SAIDA: asaas(method, path, body, apiKey)\ncustomers, payments, transfers,\nsubaccounts, webhooks", COL[2], y + 50, W + 40, 68, shp(LARANJA))
    a2 = p.node("ENTRADA: POST /billing/webhook\nheader asaas-access-token\nSE token nao configurado -> ACEITA TUDO", COL[2], y + 128, W + 40, 68, shp(VERMELHO, BORDA_RISCO))
    a3 = p.node("SPLIT IASOPay\nsubconta por clinica + walletId root\nsyncIasopayWallet()", COL[2], y + 206, W + 40, 62, shp(LARANJA))
    a4 = p.node("Vars: ASAAS_API_KEY, ASAAS_BASE_URL,\nASAAS_WEBHOOK_TOKEN, IASOPAY_WALLET_ID",
                COL[2], y + 278, W + 40, 62, shp(CINZA, "fontSize=9;"))

    # OpenAI + AWS
    o0 = p.node("OPENAI", COL[4], y, W + 40, 40, shp(LARANJA, "fontStyle=1;"))
    o1 = p.node("/ai/* : patient-summary, evolution-draft,\nreturn-suggestions, chat, financial-health,\nproduct-health, chat-reports, daily-insight",
                COL[4], y + 50, W + 40, 68, shp(LARANJA, "fontSize=9;"))
    o2 = p.node("Debita cota de IA\n(UsageCounter / UsageEvent)", COL[4], y + 128, W + 40, 50, shp(AMARELO))
    aw0= p.node("AWS", COL[4], y + 190, W + 40, 34, shp(LARANJA, "fontStyle=1;"))
    aw1= p.node("SES (e-mail OTP) | S3 (script de migracao,\nnao ativo no app.js) | RDS (prod) |\nEC2 + CodePipeline | CloudFront",
                COL[4], y + 230, W + 40, 68, shp(LARANJA, "fontSize=9;"))

    core = p.node("BACKEND\nIasoclin", COL[1] + 60, y + 130, 160, 70, shp(VERDE, "fontStyle=1;"))

    p.edge(core, m1); p.edge(m2, core, "", dashed=True); p.edge(core, m3)
    p.edge(core, a1); p.edge(a2, core, "", dashed=True); p.edge(core, a3)
    p.edge(core, o1); p.edge(o1, o2)
    p.edge(core, aw1)

    p.note("PONTA SOLTA (ALTA): nenhuma das integracoes tem retry automatico no caminho de SAIDA. "
           "Falha em chamada ao Asaas ou a Meta e capturada, gravada como 'failed' e encerrada. "
           "So a fila WebhookEvent (ENTRADA) tem backoff e retry.",
           COL[0], y + 400, 700, 90, VERMELHO)
    p.note("PONTA SOLTA (ALTA): gen-env.sh sobrescreve o .env da EC2 a partir do CodeBuild. "
           "Variavel nao cadastrada no CodeBuild simplesmente SOME no proximo deploy - "
           "integracao pode parar sem erro visivel. Sem healthcheck por integracao.",
           COL[2], y + 400, 700, 90, VERMELHO)
    p.note("SEM OBSERVABILIDADE: nao ha APM, Sentry, nem alerta. O unico healthcheck e GET /health "
           "(so testa SELECT 1 no banco) e GET /admin/health. Falhas de integracao so aparecem "
           "em console.log dentro do PM2.",
           COL[0], y + 505, 700, 80, VERMELHO)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 16. JOBS E PROCESSOS ASSINCRONOS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_jobs():
    p = Page("16 - Processos Automaticos, Filas e Jobs")
    _hdr(p, "Jobs e filas - tudo IN-PROCESS no mesmo servidor Express",
         "server.js chama startAutomationCrons() e startWebhookWorker(). Sem Redis, sem BullMQ, sem SQS. "
         "O Postgres e a fila.")

    y = 120
    s = p.node("server.js  app.listen()", COL[0], y, W + 60, 44, shp(VERDE, "fontStyle=1;"))

    c1 = p.node("CRON 0 9 * * *\nrunBirthdayCron()\naniversariantes do dia", COL[1], y, W + 20, 68, shp(VERDE, "dashed=1;"))
    c2 = p.node("CRON */30 * * * *\nrunReminderCron()\nlembretes de consulta", COL[1], y + 84, W + 20, 68, shp(VERDE, "dashed=1;"))
    c3 = p.node("CRON 15 * * * *\ncleanupExpiredDemos()\ndemos com TTL 48h", COL[1], y + 168, W + 20, 68, shp(VERDE, "dashed=1;"))
    w1 = p.node("webhookWorker\nloop continuo, BATCH=20", COL[1], y + 252, W + 20, 68, shp(VERDE, "dashed=1;"))

    q1 = p.node("Le WebhookEvent\nstatus='pending' e elegivel\npelo backoff", COL[2], y + 252, W, 68, db())
    q2 = p.node("Marca 'processing'\n(claim atomico)", COL[3], y + 252, W, 50, shp(VERDE))
    q3 = p.node("Sucesso -> 'processed'", COL[4], y + 220, W, 44, shp(VERDE))
    q4 = p.node("Erro -> attempts+1, volta a 'pending'\nbackoff 0/1/5/15/60 min", COL[4], y + 274, W, 56, shp(AMARELO))
    q5 = p.node("attempts >= 5 -> 'failed'\nSEM ALERTA, SEM TELA\nDE REPROCESSAMENTO", COL[4], y + 340, W, 62, shp(VERMELHO, BORDA_RISCO))

    e1 = p.node("logAndSend()\n-> AutomationLog + Meta", COL[2], y + 40, W, 56, shp(ROXO))

    r1 = p.node("RISCO ALTO: jobs rodam DENTRO do processo Express.\nCom 2+ instancias (PM2 cluster ou autoscaling),\nOS CRONS DUPLICAM os envios. Nao ha lock distribuido.",
                COL[1], y + 350, 620, 80, shp(VERMELHO, BORDA_RISCO))
    r2 = p.node("RISCO: restart do servidor durante o processamento\ndeixa eventos travados em 'processing' para sempre\n(nao ha reaper de claim expirado identificado).",
                COL[1], y + 445, 620, 80, shp(VERMELHO, BORDA_RISCO))

    p.edge(s, c1); p.edge(s, c2); p.edge(s, c3); p.edge(s, w1)
    p.edge(c1, e1); p.edge(c2, e1)
    p.edge(w1, q1, "", dashed=True); p.edge(q1, q2); p.edge(q2, q3, "OK"); p.edge(q2, q4, "erro")
    p.edge(q4, q1, "retry", dashed=True); p.edge(q4, q5, "esgotou")
    p.edge(c1, r1); p.edge(q2, r2)

    p.note("NAO IDENTIFICADO NO CODIGO: job de reconciliacao financeira (comparar Asaas x Transaction), "
           "job de limpeza de OtpCode expirado, job de backup logico, rotina de reprocessamento de "
           "WebhookEvent 'failed', e monitoramento de execucao dos crons (se um cron parar, ninguem sabe).",
           COL[1], y + 540, 900, 90, VERMELHO)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 17. ADMINISTRACAO E CONFIGURACOES
# ══════════════════════════════════════════════════════════════════════════════
def pagina_admin():
    p = Page("17 - Administracao e Configuracoes")
    _hdr(p, "Painel Admin IASO, IOS (sistema operacional da empresa) e configuracoes da clinica",
         "/admin/* (clinics, audit, stats, usage, health, infra, dashboard, team, tasks, notifications, leads, "
         "financial, cs) | /admin/ios/* | /profile | /settings")

    y = 110
    a1 = p.node("ADMIN IASO", COL[0], y, W, 36, shp(AZUL, "fontStyle=1;"))
    a2 = p.node("Gestao de clinicas\nGET/POST/PATCH/DELETE /admin/clinics", COL[0], y + 46, W, 56, shp(VERDE))
    a3 = p.node("Financeiro da empresa\n/admin/financial (entries, recorrentes,\nconciliacao, society, premissas, estimates)", COL[0], y + 112, W, 68, shp(VERDE, "fontSize=9;"))
    a4 = p.node("Tarefas internas\n/admin/tasks + comments", COL[0], y + 190, W, 50, shp(VERDE))
    a5 = p.node("Auditoria  GET /admin/audit\nAdminAuditLog", COL[0], y + 250, W, 50, shp(VERDE))
    a6 = p.node("Infra  GET /admin/infra/metrics\n/cost  /backups  (CloudWatch, Cost Explorer)", COL[0], y + 310, W, 56, shp(LARANJA, "fontSize=9;"))
    a7 = p.node("Cotas  GET /admin/usage\npainel de consumo IA/WhatsApp", COL[0], y + 376, W, 50, shp(VERDE))

    i1 = p.node("IOS - Iaso Operating System", COL[2], y, W + 40, 36, shp(AZUL, "fontStyle=1;"))
    i2 = p.node("/admin/ios/performance  + sync\nmetricas e OKRs", COL[2], y + 46, W + 40, 50, shp(VERDE))
    i3 = p.node("/admin/ios/scenarios\ncriar, rodar, publicar, versionar", COL[2], y + 106, W + 40, 50, shp(VERDE))
    i4 = p.node("/admin/ios/commercial\ncanais, campanhas, parceiros, comissoes", COL[2], y + 166, W + 40, 50, shp(VERDE))
    i5 = p.node("/admin/ios/product\nreleases, tasks, adoption", COL[2], y + 226, W + 40, 50, shp(VERDE))
    i6 = p.node("/admin/ios/people\npositions", COL[2], y + 286, W + 40, 44, shp(VERDE))
    i7 = p.node("22 modelos Ios* + 22 enums\nSEM CONSUMIDOR no frontend do app\n(consumido pelo repo admin separado)",
                COL[2], y + 340, W + 40, 62, shp(AMARELO, BORDA_RISCO))

    c1 = p.node("CLINICA - configuracoes", COL[4], y, W, 36, shp(AZUL, "fontStyle=1;"))
    c2 = p.node("/settings  Settings.jsx", COL[4], y + 46, W, 44, shp(AZUL))
    c3 = p.node("GET/PATCH /profile\nPATCH /profile/password", COL[4], y + 100, W, 50, shp(VERDE))
    c4 = p.node("GET/PUT /automations/whatsapp-config\nPOST /whatsapp-test", COL[4], y + 160, W, 50, shp(VERDE))
    c5 = p.node("GET/POST /billing/config\n(chave Asaas da clinica)", COL[4], y + 220, W, 50, shp(VERDE))
    c6 = p.node("/mais  Mais.jsx\n(menu overflow mobile)", COL[4], y + 280, W, 50, shp(AZUL))

    d1 = p.node("AdminSetting / AdminAuditLog /\nAdminNotification / AdminTask /\nAdminFinancialEntry / FinancialEstimate",
                COL[1], y + 190, W, 74, db("fontSize=9;"))

    p.edge(a1, a2); p.edge(a1, a3); p.edge(a1, a4); p.edge(a1, a5); p.edge(a1, a6); p.edge(a1, a7)
    p.edge(a2, d1); p.edge(a3, d1); p.edge(a4, d1)
    p.edge(i1, i2); p.edge(i1, i3); p.edge(i1, i4); p.edge(i1, i5); p.edge(i1, i6)
    p.edge(i1, i7, "", dashed=True)
    p.edge(c1, c2); p.edge(c1, c3); p.edge(c1, c4); p.edge(c1, c5); p.edge(c1, c6)

    p.note("PONTA SOLTA (ALTA): as rotas /admin/* sao montadas SEM authorize(['ADMIN']). "
           "A protecao depende de checagem interna em cada handler (req.user.role === 'ADMIN'). "
           "Qualquer rota nova que esqueca essa checagem fica exposta a qualquer usuario autenticado. "
           "VERIFICACAO HUMANA NECESSARIA rota a rota.",
           COL[0], y + 450, 760, 100, VERMELHO)
    p.note("PONTA SOLTA (MEDIA): AdminAuditLog existe, mas so cobre acoes do painel admin. "
           "Acoes destrutivas da CLINICA (excluir paciente, excluir lancamento financeiro, excluir "
           "agendamento) NAO geram trilha de auditoria.",
           COL[3], y + 450, 700, 100, VERMELHO)
    legend(p, COL[5] - 40, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 18. TRATAMENTO DE ERROS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_erros():
    p = Page("18 - Tratamento de Erros e Excecoes")
    _hdr(p, "Como o sistema se comporta quando algo falha",
         "Nao ha error handler global registrado. Cada rota faz seu try/catch. "
         "Padroes recorrentes: fail-open, catch vazio e 200 forcado.")

    y = 110
    cab = ["CENARIO DE FALHA", "COMPORTAMENTO ATUAL", "EVIDENCIA", "RISCO"]
    xs, ws = [60, 460, 900, 1300], [390, 430, 390, 300]
    for i, c in enumerate(cab):
        p.node(c, xs[i], y, ws[i], 40, shp("fillColor=#333333;strokeColor=#333333;fontColor=#ffffff;", "fontStyle=1;"))

    linhas = [
        ("Erro nao tratado em qualquer rota",
         "Express responde 500 padrao (HTML).\nSem formato JSON consistente.",
         "error.middleware.js existe mas\nNUNCA e registrado em app.js", "ALTO", VERMELHO),
        ("blockOverdue falha (ex.: banco fora)",
         "fail-open: next() - libera o acesso",
         "billing.middleware.js catch -> next()", "MEDIO", AMARELO),
        ("Webhook do Asaas lanca excecao",
         "Responde 200 assim mesmo,\nAsaas nao reenvia. Pagamento perdido.",
         "billing.routes.js catch ->\nres.status(200)", "CRITICO", VERMELHO),
        ("Webhook da Meta falha ao processar",
         "Ja respondeu 200 antes; so console.error.\nA fila WebhookEvent salva o caso.",
         "whatsappWebhook.js:80-84", "MEDIO", AMARELO),
        ("enqueueWebhookEvent falha",
         "catch(() => {}) - evento PERDIDO\nsem qualquer registro",
         "whatsappWebhook.js:57", "ALTO", VERMELHO),
        ("triggerWelcome falha",
         "catch(() => {}) - silencio total",
         "patient.service.js:53", "MEDIO", VERMELHO),
        ("Envio de WhatsApp falha",
         "AutomationLog status='failed' + error.\nSEM retry automatico.",
         "automation.service.js logAndSend", "ALTO", VERMELHO),
        ("Evento esgota 5 tentativas",
         "status='failed', sai da rotacao.\nSem alerta e sem tela para reprocessar.",
         "webhookWorker.js MAX_ATTEMPTS", "ALTO", VERMELHO),
        ("Meta envia mensagem duplicada",
         "TRATADO: idempotencia por metaMessageId\nem WhatsappInbound e no service.",
         "inbound.service.js:118-121", "OK", VERDE),
        ("Duplo clique em 'Salvar' agendamento",
         "TRATADO: idempotencyKey unique\n+ catch P2002 retorna o existente.",
         "appointment.service.js:124-168", "OK", VERDE),
        ("Token JWT invalido/expirado",
         "401 'Token invalido'. Frontend\ndesloga (comportamento a confirmar).",
         "auth.middleware.js", "BAIXO", VERDE),
        ("Cota de IA/WhatsApp esgotada",
         "Bloqueia a acao, grava 'skipped'.\nNao avisa o usuario proativamente.",
         "checkQuota / logAndSend", "MEDIO", AMARELO),
        ("Banco de dados indisponivel",
         "GET /health retorna 503.\nRotas de negocio dao 500 cru.",
         "app.js /health", "ALTO", VERMELHO),
        ("Internet cai no meio de um POST",
         "Frontend: tratamento nao padronizado.\nNao ha retry nem fila offline.",
         "services/api.js (axios)\nCOMPORTAMENTO A VALIDAR", "MEDIO", AMARELO),
    ]
    yy = y + 44
    for cen, comp, ev, risco, cor in linhas:
        alt = "fillColor=#fbfbfb;strokeColor=#b3b3b3;"
        p.node(cen,  xs[0], yy, ws[0], 56, shp(alt, "fontSize=10;align=left;spacingLeft=6;"))
        p.node(comp, xs[1], yy, ws[1], 56, shp(alt, "fontSize=9;align=left;spacingLeft=6;"))
        p.node(ev,   xs[2], yy, ws[2], 56, shp(CINZA, "fontSize=9;align=left;spacingLeft=6;"))
        p.node(risco,xs[3], yy, ws[3], 56, shp(cor, "fontSize=11;fontStyle=1;"))
        yy += 60

    p.note("RECOMENDACAO PRIORITARIA: registrar error.middleware.js em app.js (ultimo app.use), "
           "padronizar resposta de erro em JSON, substituir todo catch(() => {}) por log estruturado, "
           "e criar um reprocessador de WebhookEvent 'failed'.",
           60, yy + 20, 900, 80, VERDE)
    legend(p, 1420, y)
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 19. PONTAS SOLTAS
# ══════════════════════════════════════════════════════════════════════════════
def pagina_pontas():
    p = Page("19 - Pontas Soltas e Inconsistencias")
    _hdr(p, "Mapa consolidado das pontas soltas encontradas",
         "Detalhamento completo, com evidencia e recomendacao, no relatorio RELATORIO-MAPEAMENTO.md")

    y = 110
    grupos = [
        ("CODIGO MORTO / NAO MONTADO", VERMELHO, [
            "modulo support: 5 modelos + service + triagem + 23 testes, SEM rotas e SEM app.use()",
            "clinics/clinic.routes.js esta VAZIO - modulo nunca montado",
            "prescriptions/ - pasta vazia (funcionalidade inexistente)",
            "media/ - pasta vazia",
            "role.middleware.js authorize() - nunca importado (sem RBAC)",
            "error.middleware.js - nunca registrado (sem handler global)",
        ]),
        ("FLUXO INTERROMPIDO", VERMELHO, [
            "triggerConfirmation() implementado, sem nenhum chamador",
            "status RESCHEDULE_REQUESTED gravado, sem tela/filtro que o trate",
            "SupportTicket gravado, sem endpoint nem tela de atendimento",
            "WebhookEvent 'failed' sai da fila sem alerta e sem reprocessamento",
            "Pagamento confirmado nao notifica paciente nem clinica",
        ]),
        ("REGRA DE NEGOCIO AUSENTE", VERMELHO, [
            "Agendamento SEM validacao de conflito de horario (create e update)",
            "Aprovacao de requisicao de compra nao gera entrada de estoque (fluxo para na aprovacao)",
            "'Profissional' e texto livre - nao existe entidade nem agenda por profissional",
            "Recuperacao de senha publica NAO IDENTIFICADA NO CODIGO",
            "Sem aviso previo antes do bloqueio por inadimplencia",
        ]),
        ("SEGURANCA", VERMELHO, [
            "/admin/* sem authorize(['ADMIN']) no middleware - depende de check por handler",
            "Webhook Asaas ACEITA TUDO se ASAAS_WEBHOOK_TOKEN nao estiver setado",
            "Sem rate limit em /auth/login (forca bruta)",
            "Fotos e documentos clinicos em /uploads estatico - controle de acesso a validar",
            "Sem refresh token nem revogacao de JWT",
        ]),
        ("DUPLICIDADE / DIVERGENCIA", AMARELO, [
            "DOIS caminhos para o mesmo inbound: processInboundMessage (legado) + webhookWorker (novo)",
            "WhatsappInbound e Conversation/Message guardam a mesma informacao",
            "Status de Transaction sao strings livres, sem enum Prisma",
            "Menu do frontend nao expoe /conversations nem o Iaso Suporte",
        ]),
        ("OPERACAO E OBSERVABILIDADE", AMARELO, [
            "Crons in-process: com 2+ instancias os envios DUPLICAM (sem lock distribuido)",
            "Eventos podem travar em 'processing' apos restart (sem reaper)",
            "Sem APM/Sentry/alerta - falhas so em console.log dentro do PM2",
            "gen-env.sh sobrescreve o .env: variavel esquecida no CodeBuild derruba integracao em silencio",
            "Sem job de reconciliacao Asaas x Transaction",
        ]),
        ("AUDITORIA E LGPD", VERMELHO, [
            "Exclusoes da clinica (paciente, financeiro, agendamento) sem trilha de auditoria",
            "Cancelamento de clinica nao exporta dados (portabilidade)",
            "Sem opt-out / descadastro de comunicacao para o paciente",
            "Contas cortesia com subscriptionStatus alterado direto no banco, sem registro",
        ]),
    ]

    x, yy = 60, y
    col = 0
    xs = [60, 560, 1060]
    ys = [y, y, y]
    for titulo, cor, itens in grupos:
        cx = xs[col % 3]
        cy = ys[col % 3]
        h = 40 + len(itens) * 40
        cont = p.node(titulo, cx, cy, 470, h,
                      "swimlane;startSize=34;html=1;fontSize=12;fontStyle=1;" + cor)
        iy = 40
        for it in itens:
            p.node(it, 10, iy, 450, 36,
                   shp("fillColor=#ffffff;strokeColor=#999999;", "fontSize=9;align=left;spacingLeft=6;"),
                   parent=cont)
            iy += 40
        ys[col % 3] = cy + h + 24
        col += 1

    legend(p, 1560, y)
    return p


TODAS = [
    pagina_visao_geral, pagina_auth, pagina_usuarios, pagina_pacientes, pagina_agenda,
    pagina_procedimentos, pagina_documentos, pagina_evolucoes, pagina_orcamentos,
    pagina_financeiro, pagina_estoque, pagina_crm, pagina_whatsapp, pagina_notificacoes,
    pagina_integracoes, pagina_jobs, pagina_admin, pagina_erros, pagina_pontas,
]
