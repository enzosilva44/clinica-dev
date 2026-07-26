# IASO Operating System — Fases 2 e 3

Data: 2026-07-26  
Ambiente aplicado: Neon de desenvolvimento  
Produção: RDS inalterado

## Resultado

As fases 2 e 3 transformam a fundação estratégica do IOS em uma primeira camada
operacional integrada aos dados já existentes do admin. O core `clinica-app`
continua sendo a fonte de verdade; o backend do `clinica-admin-app` funciona
somente como gateway autenticado.

O acesso permanece restrito ao proprietário:

```text
enzo.silva@codebit.com.br
```

O backend valida JWT, papel `ADMIN`, e-mail permitido e membership ativa. A
ocultação no frontend não é usada como controle de segurança.

## Fase 2 — Performance e projeções

### Crescimento

- MRR contratado normalizado;
- ARR;
- clínicas ativas;
- novas clínicas;
- cancelamentos;
- logo churn;
- retenção de logos.

Contratos anuais são convertidos para competência mensal com o desconto anual
canônico. Planos `dev`, `demo` e e-mails explicitamente isentos não entram na
base pagante.

### Financeiro

- receitas realizadas;
- custos realizados;
- resultado;
- margem operacional;
- burn rate líquido;
- caixa registrado;
- runway.

Somente lançamentos não recorrentes, aprovados e pagos — ou aprovados sem
`paidAt`, usando `approvedAt` — entram no realizado. O caixa é o resultado
acumulado do que está registrado no admin e não representa conciliação bancária.

### Comercial agregado

- quantidade e valor do pipeline;
- valor ganho;
- negócios ganhos e perdidos;
- taxa de conversão sobre oportunidades resolvidas;
- desempenho por origem.

### Catálogo oficial

Foram cadastradas 16 definições calculadas:

```text
growth.mrr
growth.arr
growth.active_clinics
growth.new_clinics
growth.canceled_clinics
growth.logo_churn
growth.retention
sales.win_rate
sales.pipeline_value
finance.revenue
finance.costs
finance.result
finance.margin
finance.burn_rate
finance.cash_balance
finance.runway
```

Cada observação sincronizada registra período, versão da fórmula, fonte,
qualidade e autor. A sincronização é idempotente por período, métrica, origem e
versão da fórmula.

### Cenários

O primeiro modelo de projeção é determinístico e versionado como
`finance.operating@1`. Ele exige:

- caixa inicial;
- MRR inicial;
- crescimento mensal;
- churn mensal;
- custos fixos;
- percentual de custos variáveis.

A execução gera uma curva mensal de receita, custos, resultado e caixa, além de
MRR final, caixa final, break-even e primeiro mês de caixa negativo. Um cenário
publicado fica imutável; mudanças exigem uma nova versão ligada à anterior.

Não há IA tomando decisões ou inventando premissas nessa fase.

## Fase 3 — Funções operacionais

### Comercial

- histórico de futuras mudanças de etapa dos leads;
- canais e orçamento mensal;
- campanhas e seus canais;
- parceiros e regra de comissão;
- comissões vinculáveis a parceiro e lead;
- mudança de estados sem exclusão destrutiva;
- auditoria de todas as escritas IOS.

Os leads existentes não foram retroativamente reconstruídos. Fazer isso
fabricaria etapas históricas que o sistema nunca registrou.

### Produto

- releases e estados do roadmap;
- vínculo muitos-para-muitos entre releases e Tasks;
- data planejada e data efetiva de publicação;
- snapshots de adoção por funcionalidade;
- origem obrigatória para cada snapshot;
- agregação do backlog por área e estado.

Tasks permanecem no módulo operacional atual. O IOS organiza entregas e resultados
sem criar um segundo backlog concorrente.

### Pessoas

- posições atuais e planejadas;
- área, ocupante, estado e capacidade alocada;
- custo mensal atual e planejado;
- data-alvo de contratação;
- capacidade agregada por área;
- vínculo opcional com usuários administradores existentes.

## Qualidade e limites conhecidos

- MRR é receita contratada normalizada, não confirmação de recebimento.
- O ledger de cancelamentos e reativações começa nesta implementação.
- Para períodos anteriores, `User.canceledAt` fornece apenas histórico parcial.
- Caixa e runway dependem da completude dos lançamentos do admin.
- CAC, LTV e coortes não foram oficializados porque ainda não existe uma fonte
  histórica confiável de custo de aquisição e ciclo de vida por cliente.
- Adoção de produto é rastreável, mas inicialmente informada por snapshot; uma
  integração automática deve ser feita quando os eventos de uso estiverem
  definidos.
- IA operacional e recomendações assistidas pertencem a uma fase posterior.

## Validação executada

- schema Prisma formatado, validado e gerado;
- diff do schema revisado como aditivo;
- `prisma db push --skip-generate` no Neon;
- diff posterior sem diferenças;
- 12 testes unitários IOS aprovados;
- importação do core e do BFF aprovada;
- build de produção do frontend aprovado;
- leitura real de Cockpit, Performance, Cenários, Comercial, Produto e Pessoas;
- sincronização real das métricas oficiais;
- smoke de escrita cobrindo histórico de lead, canal, campanha, parceiro,
  comissão, release, adoção, posição e cenário;
- execução e publicação de uma projeção temporária;
- acesso de outro administrador negado com HTTP 403;
- limpeza dos dados temporários confirmada pelo processo de smoke;
- `git diff --check` nos dois repositórios.

## Próximos gates

Antes de produção:

1. validação visual e funcional pelo proprietário em desenvolvimento;
2. revisão das fontes financeiras e da lista de isenções;
3. aprovação explícita para produção;
4. snapshot manual do RDS;
5. aplicação coordenada do schema e deploy;
6. smoke e monitoramento pós-deploy.
