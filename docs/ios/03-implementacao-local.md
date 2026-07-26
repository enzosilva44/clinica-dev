# IASO Operating System — Implementação local

Data: 2026-07-24  
Atualizado em: 2026-07-26  
Estado: fases 1, 2 e 3 implementadas e validadas; schema aplicado somente ao Neon de desenvolvimento

## Entregue

### Fase 1 — Core (`clinica-app`)

- namespace REST `/admin/ios`;
- autorização exclusiva ao proprietário;
- bootstrap idempotente do workspace e membership `OWNER`;
- fundação estratégica (missão, visão e valores);
- ciclos estratégicos;
- objetivos e resultados-chave;
- catálogo e observações de métricas;
- iniciativas, marcos e vínculo com Tasks;
- registro de decisões;
- Cockpit como read model;
- auditoria na mesma transação das escritas;
- validação defensiva de payloads;
- valores de métricas e alvos com `Decimal`;
- sanitização de erros;
- testes unitários de progresso, tendência, códigos, decimais e períodos.

Arquivos principais:

- `backend/src/modules/operating-system/ios.routes.js`;
- `backend/src/modules/operating-system/ios.service.js`;
- `backend/src/modules/operating-system/ios.access.js`;
- `backend/src/modules/operating-system/ios.validation.js`;
- `backend/src/modules/operating-system/ios.progress.js`;
- `backend/prisma/schema.prisma`.

### Fase 1 — BFF (`clinica-admin-app`)

- namespace `/admin/ios`;
- proxy dedicado que preserva método, body, query string e status;
- nenhuma lógica de negócio ou Prisma no admin.

### Fase 1 — Frontend (`clinica-admin-app`)

- navegação IOS visível apenas ao proprietário;
- proteção das quatro rotas;
- Cockpit Executivo;
- Estratégia;
- Métricas;
- Decisões;
- inicialização explícita do workspace;
- edição de missão, visão e valores;
- criação e acompanhamento de ciclos, objetivos, KRs e iniciativas;
- marcos e vínculo com Tasks;
- registro de métricas e medições;
- memória de decisões;
- loading, vazio, erro e confirmação contextual;
- carregamento sob demanda dos chunks IOS.

### Fases 2 e 3

Foram adicionados:

- performance oficial de crescimento, comercial e financeiro;
- sincronização mensal das métricas calculadas;
- cenários financeiros determinísticos, execução, publicação imutável e versões;
- canais, campanhas, parceiros e comissões;
- histórico das futuras mudanças de etapa dos leads;
- ledger dos futuros cancelamentos e reativações;
- roadmap de releases vinculado às Tasks;
- snapshots manuais e rastreáveis de adoção de produto;
- posições atuais e planejadas, ocupantes, capacidade e custo;
- pulso de MRR, clínicas, resultado e pipeline no Cockpit;
- páginas dedicadas de Performance, Comercial, Produto e Pessoas.

As definições, fontes e limites estão detalhados em
`docs/ios/04-fases-2-e-3.md`.

## Controle de acesso

O frontend usa `isOwner` apenas para visibilidade. O controle efetivo está no core:

1. JWT válido;
2. usuário ainda existente;
3. papel `ADMIN`;
4. e-mail presente em `IOS_OWNER_EMAIL`;
5. membership ativa após o bootstrap.

Valor padrão atual:

```text
enzo.silva@codebit.com.br
```

## Verificações executadas

- `prisma format`;
- `prisma validate`;
- geração local do Prisma Client;
- importação completa do app core;
- importação completa do BFF admin;
- 12 testes IOS com `node:test`;
- build de produção do frontend admin;
- separação do IOS em chunks carregados sob demanda;
- aplicação aditiva do schema no Neon de desenvolvimento;
- smoke test transacional real das relações IOS, com rollback confirmado;
- `git diff --check` nos dois repositórios.

O build final gerou chunks separados para Cockpit, Estratégia, Métricas,
Decisões, Performance, Comercial, Produto e Pessoas.

## Verificação visual

A automação visual não pôde abrir a aplicação porque nenhum navegador estava
disponível na sessão. O build de produção e os smokes reais de API foram
concluídos sem erro, mas a inspeção visual/interativa permanece como validação
manual no navegador do proprietário.

## Banco de dados

O destino foi conferido antes da alteração:

- host Neon: `ep-dawn-silence-anjn5q8g-pooler.c-6.us-east-1.aws.neon.tech`;
- database: `neondb`;
- RDS de produção: fora do escopo e inalterado.

Foi executado `npx prisma db push --skip-generate` contra o Neon de
desenvolvimento. O Prisma confirmou que o banco está sincronizado com o schema.

O workspace real `Iaso` está inicializado no Neon e a membership `OWNER` está
ativa para `enzo.silva@codebit.com.br`.

Os smokes da primeira fase e das fases 2 e 3 criaram registros temporários e
confirmaram suas relações, auditoria e remoção posterior. Também foi validado que
outro usuário administrador recebe HTTP 403.

As 16 definições oficiais de métricas foram sincronizadas no workspace. No
período validado, 13 possuíam base suficiente para gerar observação; métricas sem
denominador ou fonte suficiente permanecem sem valor, em vez de receber números
inventados.

### Produção futura

Continua bloqueada até uma autorização separada. O fluxo obrigatório é:

1. revisão final;
2. snapshot manual do RDS;
3. aplicação segura do schema;
4. deploy coordenado do core;
5. deploy do admin;
6. smoke tests;
7. monitoramento e plano de reversão.

## Mudanças locais preexistentes no admin

Foram preservadas:

- rota de consumo;
- página `CotasConsumo`;
- card de Cotas & Consumo em Tecnologia;
- alterações locais em `AppRoutes`.

O IOS foi integrado de maneira incremental sobre esse estado, sem restaurar,
apagar ou sobrescrever essas mudanças.
