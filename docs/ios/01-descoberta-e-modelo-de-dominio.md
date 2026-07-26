# IASO Operating System — Descoberta e modelo de domínio

Status: arquitetura aprovada para o primeiro release  
Data da análise: 2026-07-24  
Repositórios analisados:

- `clinica-app` (`aaa950c`, `main`) — core, Prisma e banco oficial.
- `clinica-admin-app` (`42a096c`, `main`, um commit à frente de `origin/main`) — frontend interno e BFF.
- Notas do Obsidian sobre App Admin, Admin Gateway, estado do produto, deploy, regras de produção e design system.

> Ordem de autoridade usada nesta análise: código atual, depois documentação do
> projeto, depois hipóteses do prompt. As notas do Obsidian são um snapshot e não
> substituem o código.

## 1. Conclusão executiva

O IASO Operating System é viável dentro da arquitetura atual, mas não deve começar
como sete novas telas independentes.

O produto já possui dados e capacidades úteis em Financeiro, Comercial, Customer
Success, Tasks, clínicas, consumo e infraestrutura. O primeiro trabalho do IOS é
criar uma espinha dorsal que torne esses dados confiáveis e conectáveis:

1. catálogo de métricas com definição, fórmula, fonte, período, responsável e versão;
2. ciclos de planejamento com objetivos, resultados-chave, iniciativas e marcos;
3. cenários e premissas versionados;
4. histórico de eventos de negócio;
5. decisões e projeções imutáveis/auditáveis;
6. autorização por capacidade, além do papel genérico `ADMIN`.

Sem essa fundação, cada submódulo repetiria cálculos e conceitos já divergentes no
sistema. O resultado seria um conjunto de dashboards, não um sistema operacional
empresarial.

O primeiro recorte recomendado é **Fundação IOS + Cockpit Executivo + Estratégia**.
Ele cria a linguagem comum usada depois por Crescimento, Financeiro, Comercial,
Produto, Pessoas e IA.

## 2. Mapa da arquitetura atual

```text
Browser
  |
  v
clinica-admin-app/frontend (React + Vite, porta 5175)
  |
  v
clinica-admin-app/backend (Express, porta 3001, BFF/gateway)
  |
  v
clinica-app/backend (Express, porta 3000, regras e Prisma)
  |
  +--> PostgreSQL (Neon local / RDS em produção)
  +--> AWS (métricas, custo, backups)
  +--> Asaas e demais provedores do produto
```

O backend do admin não possui Prisma, banco ou lógica de negócio própria. Cada rota
é encaminhada para `/admin/*` no core. Assim, toda persistência e regra do IOS deve
ficar no `clinica-app`; o `clinica-admin-app` fornece navegação e experiência
interna.

### 2.1 Stack

| Camada | Estado atual |
|---|---|
| Admin frontend | React 19, React Router 7, Vite 8, Tailwind 4, Axios, Lucide, React Hot Toast |
| Admin BFF | Node.js, Express 4, `fetch` para o core |
| Core | Node.js, Express, Prisma |
| Banco | PostgreSQL |
| Estado frontend | `useState`/`useEffect`, Context apenas para autenticação, cache pontual em `localStorage` |
| Gráficos | SVG próprio; não há biblioteca de gráficos |
| Deploy | pipelines separados para core e admin |

### 2.2 Organização

Admin frontend:

- `src/pages`: páginas principais e páginas de Tecnologia;
- `src/modules/financeiro`: calculadora, premissas, cenários e projeções;
- `src/components`: layout, notificações, avatar, menções e componentes pontuais;
- `src/contexts`: autenticação;
- `src/routes`: tabela central de rotas;
- `src/services`: cliente Axios.

Admin BFF:

- `src/modules/auth`: login encaminhado ao core;
- `src/modules/admin`: lista explícita de rotas encaminhadas;
- `src/config/coreApi.js`: transporte HTTP para o core.

Core:

- módulos de produto separados por domínio;
- todas as rotas internas do admin estão concentradas em
  `backend/src/modules/admin/admin.routes.js`;
- persistência Prisma centralizada no mesmo schema do produto.

### 2.3 Design e componentes

O admin usa a identidade Verde Vibrante, mas ainda não possui o mesmo sistema de
tokens e componentes base documentado no app principal. Cores, bordas, cards,
botões, tabelas, badges, modais e estados vazios são construídos diretamente com
classes Tailwind em cada página.

Componentes reutilizáveis existentes no admin:

- `AdminLayout`;
- `LogoMark`;
- `NotificationBell`;
- `Avatar`;
- `MentionTextarea`;
- `SecaoInfo`;
- `TecBreadcrumb`;
- `MiniChart`;
- componentes específicos do planejamento financeiro.

Não há biblioteca interna consolidada para `Button`, `Card`, `Input`, `Modal`,
`Table`, `StatusBadge`, filtros ou estados de carregamento/erro. O IOS deve
reutilizar o visual atual no primeiro recorte e extrair componentes apenas quando
houver repetição real. Uma migração visual total não faz parte do IOS.

### 2.4 Autenticação, autorização e permissões

- Login é feito no core e encaminhado pelo BFF.
- O JWT contém identidade e `role`.
- Frontend protege rotas verificando token e `role === "ADMIN"` no
  `localStorage`.
- BFF confirma `ADMIN` no login.
- Core aplica `authMiddleware` e depois `requireAdmin`.
- Não existe matriz de permissões por área ou ação.
- Exclusão de clínica é protegida por e-mail de proprietário fixado em código.

Esse modelo serve para o painel atual, mas é insuficiente para Financeiro,
Estratégia, Pessoas e decisões sensíveis. O IOS precisa de capacidades explícitas,
por exemplo `strategy.write`, `finance.approve`, `people.read` e `ai.execute`.

### 2.5 ORM, banco, entidades e relações existentes

Entidades internas já disponíveis:

- `AdminTask` e `AdminTaskComment`;
- `Lead`;
- `AdminFinancialEntry`;
- `AdminAuditLog`;
- `AdminNotification`;
- `CsNote`;
- `FinancialEstimate`;
- `AdminSetting`.

Fontes do produto que alimentam inteligência:

- `User` como tenant/clínica;
- assinaturas e estado de cobrança no próprio `User`;
- `UsageCounter` e `UsageEvent`;
- pacientes, agendamentos, transações e demais entidades clínicas;
- dados de Asaas e infraestrutura.

Limitações relevantes:

- dados internos da empresa não possuem `organizationId`;
- colaboradores/fundadores são registros `User` com papel `ADMIN`, misturados
  conceitualmente aos tenants;
- várias referências são strings/JSON sem chave estrangeira;
- valores monetários internos usam `Float`;
- muitos estados e tipos são strings livres;
- cancelamento é apenas `User.canceledAt`; reativar apaga a evidência do
  cancelamento anterior;
- estimativas e premissas são JSON, sem schema ou versão formal.

### 2.6 Migrations

O repositório possui histórico de migrations incompleto e opera com `prisma db
push`. Local e produção usam bancos diferentes. Qualquer alteração no schema de
produção exige:

1. explicação e aprovação;
2. snapshot manual do RDS;
3. aplicação coordenada do schema;
4. deploy e verificação.

Nenhuma modelagem deste documento autoriza alteração no banco.

### 2.7 Validação, serviços e acesso a dados

- Não há biblioteca de validação declarativa no core ou no BFF.
- As rotas fazem validações manuais e heterogêneas.
- O módulo admin do core acessa Prisma diretamente.
- Não há camada de serviço ou repositório para o admin.
- O arquivo de rotas do admin no core já concentra clínicas, auditoria, consumo,
  infraestrutura, dashboard, equipe, tasks, notificações, leads, financeiro e CS.
- O BFF repete manualmente cada endpoint que precisa encaminhar.

O IOS não deve ser acrescentado ao arquivo monolítico. Deve nascer como módulo
próprio no core, mantendo o mesmo Express/Prisma e sem introduzir framework novo.

### 2.8 Rotas, erros e notificações

- Padrão de API: REST em `/admin/*`.
- BFF preserva método, corpo, autorização e status do core.
- Erro de conectividade vira `502`.
- Core retorna predominantemente `400` com `error: e.message`.
- Frontend exibe erros com toast ou mensagens locais.
- Não existe contrato padronizado de erro (`code`, `message`, `details`,
  `correlationId`).
- Notificações internas suportam menção em task e polling a cada 20 segundos.

### 2.9 Logs, auditoria e observabilidade

- `AdminAuditLog` registra apenas algumas ações administrativas.
- A auditoria atual é `best-effort`: uma falha ao gravar não bloqueia a ação.
- Não há garantia transacional entre mudança e auditoria.
- Não há trilha abrangente para premissas, projeções, aprovações, leads, tasks,
  cancelamentos ou decisões.
- Há health check de API/banco e integração com métricas, custos e backups AWS.
- Não há correlação de requisição nem telemetria de domínio para o IOS.

### 2.10 Dashboards e padrões de interface

O admin já possui:

- dashboard executivo;
- cards de KPI;
- tabelas;
- filtros;
- kanban para Tasks e Comercial;
- drawers e formulários;
- modais baseados em composição local;
- gráficos SVG;
- projeções e simulações financeiras puras no frontend.

Esses padrões devem ser reutilizados. O Cockpit do IOS não deve duplicar o
Dashboard atual: ele deve evoluir para uma visão de decisão, mostrando meta,
realizado, tendência, confiança e origem de cada indicador.

## 3. Divergências encontradas

### 3.1 Planos e preços

Há múltiplas fontes:

- configuração atual do produto: Solo 99, Clínica 139, Pro 159;
- cálculo financeiro do core admin: 99, 139, 159;
- página Financeiro do admin ainda contém 97, 197 e 497;
- contratação no billing contém outro mapa de preços;
- configuração de features do backend não possui entrada explícita para `pro`.

Antes de usar MRR, ARR, LTV, margem ou projeções como inteligência oficial, os
planos precisam de uma fonte canônica consumível pelo produto, billing e admin.

### 3.2 Churn

O termo possui definições concorrentes:

- Customer Success calcula cancelamentos efetivos usando `canceledAt`;
- uma métrica chamada `churnedThisMonth` no financeiro conta clínicas antigas sem
  agendamento recente;
- risco de churn é calculado por score de atividade;
- reativação remove `canceledAt`, apagando o histórico anterior.

“Churn realizado”, “risco de churn” e “inatividade” devem ser métricas distintas.

### 3.3 MRR e ARR

As rotas não aplicam exatamente a mesma população e semântica:

- uma visão exclui canceladas;
- outra não carrega `canceledAt`;
- mensalistas e anualistas são separados de maneiras diferentes;
- ARR às vezes significa valor contratado anual e, em outros contextos,
  `MRR × 12`.

Cada indicador deve possuir definição oficial, janela, população, fórmula e versão.

### 3.4 Projeções e premissas

O planejamento financeiro possui boas funções puras, mas:

- premissas oficiais ficam em JSON sem schema/versionamento;
- fórmulas vivem apenas no frontend;
- não há identificação da versão da fórmula em cada estimativa;
- não há intervalo de confiança;
- não há trilha transacional de alteração;
- cenários carregados podem ser alterados sem preservar uma execução imutável.

O motor pode ser reaproveitado, mas deve migrar para um serviço de domínio
testável no core antes de sustentar decisões oficiais ou IA.

## 4. Modelo de domínio conceitual

Esta seção identifica o domínio antes de propor tabelas Prisma.

### 4.1 Agregados principais

#### Organização operacional

Representa a empresa administrada pelo IOS.

- organização;
- membros;
- papéis e capacidades;
- estrutura/cargos;
- responsáveis por áreas;
- vigência de vínculos.

Mesmo existindo uma única Iaso hoje, os dados internos devem carregar contexto de
organização desde o início para não depender de um singleton implícito.

#### Ciclo estratégico

Representa um período coerente de planejamento.

- ciclo;
- missão, visão e valores vigentes;
- pilares estratégicos;
- objetivos;
- resultados-chave;
- iniciativas;
- marcos;
- responsáveis;
- status e progresso.

Um resultado-chave referencia uma métrica, não uma string solta. Uma iniciativa
pode se relacionar a tasks existentes sem duplicar o backlog operacional.

#### Catálogo de métricas

Define o significado oficial de cada indicador.

- definição;
- código estável;
- unidade;
- direção desejada;
- frequência;
- população;
- fonte;
- fórmula e versão;
- responsável;
- thresholds;
- observações por período;
- qualidade, completude e horário de cálculo.

Exemplos: `growth.mrr`, `growth.logo_churn`, `sales.win_rate`,
`product.feature_adoption`, `finance.runway_months`.

#### Cenário e projeção

Separa hipóteses de fatos observados.

- conjunto de premissas;
- cenário;
- modelo de projeção;
- versão do modelo;
- execução da projeção;
- valores de entrada;
- resultados;
- horizonte;
- intervalo de confiança;
- autor e data.

Uma execução publicada é imutável. Uma nova simulação cria nova versão.

#### Registro de decisão

Preserva por que uma decisão foi tomada.

- pergunta/decisão;
- contexto;
- alternativas;
- critérios;
- métricas e projeções consultadas;
- premissas;
- decisão;
- responsáveis;
- data de revisão;
- resultado posterior.

#### Evento de negócio

Registra fatos que alimentam métricas e histórico:

- assinatura iniciada;
- plano alterado;
- pagamento confirmado;
- atraso;
- cancelamento;
- reativação;
- lead movido;
- negócio ganho/perdido;
- release publicada;
- contratação iniciada/concluída.

Eventos não substituem as entidades operacionais; preservam a linha do tempo
necessária para coortes e auditoria.

#### Insight e recomendação

Representa uma análise gerada por regra ou IA.

- pergunta;
- conclusão;
- evidências;
- métricas usadas e seus períodos;
- premissas;
- nível de confiança;
- autor humano/modelo;
- feedback;
- estado (`rascunho`, `aceito`, `descartado`);
- eventual decisão ou iniciativa criada a partir dele.

### 4.2 Objetos de valor

- `Money`: valor decimal e moeda;
- `Percentage`: valor normalizado e regra de arredondamento;
- `Period`: início, fim, granularidade e timezone;
- `MetricValue`: valor, unidade, período e qualidade;
- `MetricSource`: tipo, referência, horário de extração e versão;
- `FormulaVersion`: identificador imutável da lógica usada;
- `Target`: baseline, alvo, prazo e direção;
- `Ownership`: pessoa responsável e papel no contexto;
- `ConfidenceRange`: valor central, mínimo, máximo e método;
- `Assumption`: chave, valor, unidade, justificativa e fonte;
- `SourceReference`: entidade/consulta/evento que comprova um dado.

### 4.3 Serviços de domínio

- `MetricCalculationService`: calcula indicadores a partir de fontes oficiais;
- `MetricCatalogService`: resolve definição e versão;
- `ProjectionService`: executa modelos usando premissas versionadas;
- `StrategyAlignmentService`: liga objetivos, KRs, iniciativas, tasks e métricas;
- `BusinessEventService`: registra fatos relevantes;
- `DecisionService`: publica e revisa decisões;
- `AuditService`: grava ator, ação, antes/depois e contexto;
- `ExecutiveInsightService`: gera análises com evidências;
- `AuthorizationService`: verifica capacidades por domínio e ação.

### 4.4 Regras invariantes

1. Métrica derivada não pode ser editada manualmente.
2. Métrica manual exige responsável, fonte/justificativa e período.
3. Fórmula alterada cria nova versão; não reinterpreta silenciosamente o passado.
4. Projeção publicada é imutável.
5. Toda projeção registra suas premissas.
6. Toda decisão pode apontar para métricas, projeções e evidências usadas.
7. Exclusão de artefato estratégico deve ser arquivamento, salvo dado temporário.
8. Valores monetários oficiais não usam ponto flutuante binário.
9. Eventos de cancelamento e reativação não podem ser apagados ao mudar o estado
   atual do cliente.
10. Escritas sensíveis e auditoria devem pertencer à mesma transação.
11. IA não altera meta, premissa, decisão ou lançamento sem ação humana explícita.
12. Toda resposta analítica da IA mostra período, fonte e data de atualização.

## 5. Relação entre os submódulos

```text
                    Catálogo de Métricas
                     /       |        \
                    v        v         v
Estratégia --> Crescimento  Financeiro  Comercial
    |              |           |          |
    +----------> Iniciativas / Produto <---+
                       |
                       v
                     Tasks

Pessoas fornece responsáveis e capacidade para todos os domínios.
Eventos de Negócio alimentam métricas e histórico.
Decisões conectam métricas, cenários, iniciativas e resultados.
IA consulta essa malha e sempre devolve evidências.
```

### Reutilização por domínio

| Submódulo | Reutiliza hoje | Evolução necessária |
|---|---|---|
| Estratégia | Tasks e equipe admin | ciclos, objetivos, KRs, iniciativas, marcos e decisões |
| Crescimento | clínicas, billing, cancelamentos, leads, uso | catálogo de métricas, eventos de ciclo de vida e coortes |
| Financeiro | lançamentos, billing, premissas, calculadora | dinheiro decimal, fonte, competência, versões e projeções no core |
| Comercial | Leads e kanban | histórico de estágio, canais, campanhas, parceiros, comissões e metas |
| Produto | Tasks, uso, auditoria e releases via Git | roadmap, iniciativas, entregas e adoção mensurável |
| Pessoas | usuários `ADMIN` | membros, cargos, vigências, capacidade, custo e plano de contratação |
| IA | SDK/configuração de IA já existente | contexto executivo separado, ferramentas somente leitura e evidências |

## 6. Arquitetura proposta

### 6.1 Core

Criar um módulo isolado no core, sem novo framework:

```text
backend/src/modules/operating-system/
  operating-system.routes.js
  strategy/
  metrics/
  projections/
  decisions/
  events/
  authorization/
  shared/
```

Responsabilidades:

- regras e validação de domínio;
- persistência Prisma;
- cálculos e projeções;
- auditoria transacional;
- consultas agregadas para o Cockpit;
- contratos REST sob `/admin/ios/*`.

O arquivo existente `admin.routes.js` continua atendendo módulos legados. O IOS não
deve aumentar esse arquivo.

### 6.2 BFF

Criar módulo próprio de encaminhamento para `/admin/ios/*`, mantendo autenticação e
sem lógica de negócio. O encaminhamento deve preservar query string, método, corpo,
status e um identificador de correlação.

### 6.3 Frontend

```text
frontend/src/modules/ios/
  components/
  pages/
  strategy/
  metrics/
  projections/
  decisions/
  services/
```

O IOS entra no `AdminLayout` existente e reaproveita identidade, autenticação,
notificações, padrões de tabela, cards e gráficos. Componentes compartilhados
devem ser extraídos por uso real, não por antecipação.

### 6.4 Métricas

Separar:

- metadados configuráveis no banco;
- implementações de fórmulas em um registro de código versionado;
- observações/snapshots com procedência;
- consultas em tempo real apenas onde o custo for baixo.

Não executar SQL, JavaScript ou fórmulas arbitrárias vindas do banco. A configuração
seleciona implementações conhecidas e testadas.

### 6.5 IA

A IA executiva deve ser a última camada, não a fundação.

Primeira versão:

- ferramentas somente leitura para métricas, objetivos, cenários e decisões;
- respostas com fontes e períodos;
- simulações criadas como rascunho;
- nenhuma escrita autônoma;
- registro do modelo, prompt/versionamento, ferramentas usadas e evidências.

É possível reutilizar o provedor e a configuração existentes, mantendo prompts,
limites e autorização separados do assistente clínico.

## 7. Primeiro recorte implementável

### Fundação IOS + Cockpit Executivo + Estratégia

Capacidades:

1. criar e publicar um ciclo estratégico;
2. cadastrar missão, visão, valores e pilares;
3. criar objetivos;
4. criar KRs ligados a métricas oficiais;
5. criar iniciativas, responsáveis e marcos;
6. vincular tasks existentes a iniciativas;
7. visualizar no Cockpit realizado, alvo, tendência e status;
8. abrir qualquer métrica e ver definição, fórmula, fonte, período e atualização;
9. registrar uma decisão ligada a objetivo/métrica;
10. auditar todas as alterações.

### Critérios de aceite

- nenhuma fórmula de KPI duplicada no frontend;
- todos os KPIs exibem origem e período;
- permissões de leitura/escrita são verificadas no backend;
- valores, percentuais e períodos são validados;
- alterações sensíveis geram auditoria transacional;
- rotas possuem testes de autorização e regras;
- cálculos de métricas possuem testes unitários;
- UI reutiliza o layout e padrões atuais;
- loading, vazio, erro e sucesso são tratados;
- nenhuma alteração estrutural é aplicada em produção sem aprovação e snapshot.

## 8. Fases recomendadas

### Fase 0 — Correção semântica

- definir fonte canônica de planos/preços;
- separar churn realizado, risco e inatividade;
- registrar eventos de cancelamento/reativação;
- definir dicionário inicial de métricas;
- padronizar período, moeda e arredondamento;
- criar baseline de testes para os cálculos atuais.

### Fase 1 — Fundação e Estratégia

- organização, membros/capacidades;
- ciclos, objetivos, KRs, iniciativas e marcos;
- catálogo de métricas;
- decisões;
- Cockpit inicial;
- auditoria transacional.

### Fase 2 — Crescimento e Financeiro

- MRR, ARR, churn, retenção e coortes;
- CAC e LTV somente após fontes suficientes;
- competência, caixa, margem, burn, runway e break-even;
- cenários, premissas e projeções versionadas.

### Fase 3 — Comercial, Produto e Pessoas

- histórico de funil, canais, campanhas, parceiros e comissões;
- roadmap, releases e adoção;
- estrutura, capacidade, custos e plano de contratação.

### Fase 4 — Assistente executivo

- consultas com evidências;
- explicação de variações;
- recomendações;
- simulações;
- acompanhamento do resultado de decisões.

## 9. Decisões aprovadas para o primeiro release

1. A área se chamará **IOS**.
2. Os dados serão preparados com `organizationId` desde o início.
3. O acesso inicial será exclusivo ao usuário proprietário
   `enzo.silva@codebit.com.br`. A autorização será aplicada no core; ocultar a
   navegação no frontend não será tratado como controle de segurança.
4. A fonte vigente de planos/preços será consolidada a partir da configuração
   atual do produto antes de alimentar métricas oficiais.
5. MRR e ARR receberão definições explícitas no catálogo de métricas; conceitos
   diferentes não compartilharão o mesmo código.
6. Cancelamento realizado, risco de churn e inatividade serão fatos/métricas
   distintos.
7. O ciclo estratégico inicial será trimestral, sem impedir outros períodos.
8. O primeiro Cockpit começará com um conjunto pequeno de métricas oficiais e
   extensível pelo catálogo.
9. O primeiro release será **Fundação IOS + Cockpit Executivo + Estratégia**.
10. A IA fica fora do primeiro release. Quando implementada, reutilizará
    inicialmente o provedor do produto, com contexto e autorização próprios.

## 10. Fora de escopo até aprovação

- alteração de schema Prisma;
- `db push` local ou em produção;
- mudança direta em EC2/RDS;
- troca de biblioteca/framework;
- migração completa do design system;
- separação do banco do admin;
- refatoração geral dos módulos legados;
- agente de IA com escrita autônoma.
