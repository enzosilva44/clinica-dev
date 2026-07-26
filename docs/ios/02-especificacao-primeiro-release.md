# IASO Operating System — Especificação do primeiro release

Status: aprovado para implementação local  
Escopo: Fundação IOS + Cockpit Executivo + Estratégia  
Acesso inicial: somente `enzo.silva@codebit.com.br`

## 1. Resultado esperado

O primeiro release cria a espinha dorsal do IOS sem duplicar Financeiro, Comercial
ou Tasks. O proprietário consegue:

1. inicializar o workspace operacional da Iaso;
2. registrar missão, visão e valores;
3. criar ciclos estratégicos;
4. criar objetivos e resultados-chave;
5. manter um catálogo de métricas com fonte e fórmula explícitas;
6. registrar observações manuais de métricas quando permitido;
7. criar iniciativas e marcos;
8. relacionar tasks existentes a iniciativas;
9. registrar decisões;
10. visualizar um Cockpit com estratégia, progresso e métricas;
11. consultar a trilha de auditoria do IOS.

## 2. Controle de acesso

### Regra inicial

- O core busca o usuário autenticado por `req.user.id`.
- O acesso é permitido apenas quando o e-mail normalizado coincide com
  `IOS_OWNER_EMAIL`.
- O valor padrão é `enzo.silva@codebit.com.br`.
- A variável de ambiente existe para configuração; nenhuma alteração de `.env` de
  produção faz parte deste release.
- Todas as rotas `/admin/ios/*` aplicam autenticação, papel `ADMIN` e acesso IOS.
- O frontend oculta menu/rotas para outros usuários, mas o core permanece como
  autoridade.

### Evolução preparada

O domínio inclui membership e capacidades. O proprietário inicial recebe
`OWNER`. A abertura para outras pessoas deverá ser uma ação explícita futura.

## 3. Estados e transições

### Ciclo estratégico

- `DRAFT`: editável, ainda não vigente;
- `ACTIVE`: ciclo vigente;
- `CLOSED`: encerrado;
- `ARCHIVED`: preservado, fora da operação.

Somente um ciclo pode ficar `ACTIVE` por organização. Ativar um ciclo encerra o
anterior na mesma transação.

### Objetivo

- `DRAFT`;
- `ACTIVE`;
- `AT_RISK`;
- `COMPLETED`;
- `CANCELED`.

### Resultado-chave

- `DRAFT`;
- `ACTIVE`;
- `AT_RISK`;
- `ACHIEVED`;
- `CANCELED`.

O progresso é derivado de baseline, alvo e última observação da métrica. Não é
gravado como porcentagem editável.

### Iniciativa

- `PLANNED`;
- `IN_PROGRESS`;
- `BLOCKED`;
- `COMPLETED`;
- `CANCELED`.

### Marco

- `PENDING`;
- `COMPLETED`;
- `CANCELED`.

### Decisão

- `DRAFT`;
- `DECIDED`;
- `REVIEWED`;
- `REVERSED`.

Decisões publicadas não têm seu conteúdo sobrescrito silenciosamente; revisões
geram registro de auditoria e preservam o antes/depois.

## 4. Objetos e contratos

### Workspace

```json
{
  "id": "cuid",
  "name": "Iaso",
  "slug": "iaso",
  "mission": "string|null",
  "vision": "string|null",
  "values": ["string"],
  "timezone": "America/Sao_Paulo",
  "currency": "BRL"
}
```

### Ciclo

```json
{
  "name": "Q3 2026",
  "description": "string|null",
  "cadence": "QUARTERLY",
  "startDate": "ISO-8601",
  "endDate": "ISO-8601",
  "status": "DRAFT"
}
```

Regras:

- nome obrigatório;
- início anterior ao fim;
- período máximo de 24 meses;
- organização é obtida do acesso, nunca aceita do cliente.

### Métrica

```json
{
  "code": "growth.mrr",
  "name": "MRR",
  "description": "Receita recorrente mensal normalizada",
  "unit": "BRL",
  "direction": "INCREASE",
  "frequency": "MONTHLY",
  "sourceType": "CALCULATED",
  "sourceRef": "billing.subscriptions",
  "formulaKey": "growth.mrr",
  "formulaVersion": "1",
  "allowManualInput": false,
  "ownerId": "user-id|null"
}
```

Regras:

- `code` é estável, minúsculo e usa segmentos separados por ponto;
- métrica calculada exige `formulaKey` e versão;
- métrica manual exige descrição de fonte;
- observação manual é proibida quando `allowManualInput=false`;
- uma fórmula não é enviada pelo cliente nem executada dinamicamente.

### Observação

```json
{
  "metricId": "cuid",
  "periodStart": "ISO-8601",
  "periodEnd": "ISO-8601",
  "value": "decimal-as-string",
  "sourceRef": "Documento/URL/referência",
  "note": "Justificativa"
}
```

### Objetivo e KR

```json
{
  "objective": {
    "title": "Atingir tração comercial repetível",
    "description": "string|null",
    "ownerId": "user-id|null",
    "status": "ACTIVE"
  },
  "keyResult": {
    "title": "Chegar a R$ 10 mil de MRR",
    "metricId": "metric-id",
    "baseline": "1000.00",
    "target": "10000.00",
    "startDate": "ISO-8601",
    "dueDate": "ISO-8601",
    "ownerId": "user-id|null"
  }
}
```

### Iniciativa e marco

```json
{
  "initiative": {
    "title": "Estruturar canal de parceiros",
    "description": "string|null",
    "objectiveId": "objective-id|null",
    "ownerId": "user-id|null",
    "priority": "HIGH",
    "status": "PLANNED",
    "startDate": "ISO-8601|null",
    "dueDate": "ISO-8601|null"
  },
  "milestone": {
    "title": "Assinar os 3 primeiros parceiros",
    "dueDate": "ISO-8601|null"
  }
}
```

Tasks são ligadas por `taskId`. A task continua pertencendo ao módulo Tasks.

### Decisão

```json
{
  "title": "Priorizar aquisição por parceiros",
  "context": "string",
  "decision": "string",
  "rationale": "string|null",
  "alternatives": [],
  "evidence": [],
  "cycleId": "cuid|null",
  "objectiveId": "cuid|null",
  "reviewAt": "ISO-8601|null",
  "status": "DECIDED"
}
```

## 5. Endpoints do core

Prefixo: `/admin/ios`

### Acesso e bootstrap

- `GET /access`
- `GET /workspace`
- `POST /bootstrap`
- `PATCH /workspace`
- `GET /team`

### Cockpit

- `GET /cockpit`

### Ciclos

- `GET /cycles`
- `POST /cycles`
- `PATCH /cycles/:id`
- `DELETE /cycles/:id` — arquiva, não apaga

### Objetivos e KRs

- `POST /cycles/:cycleId/objectives`
- `PATCH /objectives/:id`
- `DELETE /objectives/:id` — cancela/arquiva conforme estado
- `POST /objectives/:objectiveId/key-results`
- `PATCH /key-results/:id`
- `DELETE /key-results/:id`

### Métricas

- `GET /metrics`
- `POST /metrics`
- `PATCH /metrics/:id`
- `POST /metrics/:id/observations`

### Iniciativas

- `POST /cycles/:cycleId/initiatives`
- `PATCH /initiatives/:id`
- `POST /initiatives/:id/milestones`
- `PATCH /milestones/:id`
- `POST /initiatives/:id/tasks`
- `DELETE /initiatives/:id/tasks/:taskId`

### Decisões

- `GET /decisions`
- `POST /decisions`
- `PATCH /decisions/:id`

### Auditoria

- `GET /audit`

## 6. Cockpit

O payload deve ser uma read model única:

```json
{
  "workspace": {},
  "activeCycle": {},
  "summary": {
    "objectives": 0,
    "onTrack": 0,
    "atRisk": 0,
    "initiatives": 0,
    "blockedInitiatives": 0,
    "pendingMilestones": 0
  },
  "objectives": [],
  "metrics": [],
  "recentDecisions": [],
  "audit": []
}
```

Cada métrica exibe:

- valor atual;
- período;
- alvo quando ligada a KR;
- tendência quando existem ao menos duas observações comparáveis;
- fonte;
- fórmula e versão;
- atualização;
- estado de qualidade.

## 7. Auditoria

Cada escrita registra, na mesma transação:

- ator;
- ação;
- entidade;
- id;
- estado anterior;
- estado posterior;
- metadados;
- timestamp.

Leituras não geram auditoria, exceto futuramente exportações ou consultas de dados
sensíveis.

## 8. Requisitos não funcionais

- nenhuma escrita aceita `organizationId` do frontend;
- respostas não vazam erro bruto do Prisma;
- consultas do Cockpit evitam N+1;
- listagens possuem limite defensivo;
- datas são armazenadas em UTC e exibidas em `America/Sao_Paulo`;
- dinheiro usa `Decimal`;
- payloads JSON possuem limite de tamanho;
- regras centrais possuem testes com `node:test`;
- nenhuma nova dependência é necessária no primeiro recorte;
- nenhum `db push` será executado sem aprovação separada.

## 9. Estados de interface

Todas as páginas tratam:

- acesso negado;
- workspace ainda não inicializado;
- carregamento;
- vazio;
- erro recuperável;
- sucesso;
- confirmação antes de arquivar/cancelar;
- conflito de atualização com mensagem clara.

## 10. Fora do primeiro release

- demais usuários com acesso;
- IA executiva;
- fórmulas arbitrárias configuráveis;
- edição automática de planos/preços;
- coortes completas de retenção;
- CAC/LTV oficiais sem fontes suficientes;
- migração integral dos módulos Financeiro, Comercial e Tasks;
- mudanças de produção.
