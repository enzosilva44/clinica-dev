# Templates de Mensagem — WhatsApp Cloud API (Meta)

Lote para submeter no **WhatsApp Manager → Modelos de mensagem**.
Idioma de todos: **Português (BR)** → código `pt_BR`.
Variáveis são posicionais: `{{1}}`, `{{2}}`, `{{3}}`... (a Meta preenche na ordem que você envia).

Como submeter:
1. WhatsApp Manager → Account tools → Message templates → **Create template**.
2. Cole **Nome**, escolha **Categoria**, idioma **Portuguese (BR)**.
3. Cole o **Corpo**. Nos campos de **Sample** (exemplo), use os valores de amostra indicados — a Meta exige um exemplo para cada `{{n}}` senão rejeita.
4. Adicione os **Botões** quando indicado.
5. Enviar para revisão.

Testar depois de aprovado:
```
node scripts/send-test-template.js 5516999999999
```
(ajuste `TEMPLATE_NAME`, `LANGUAGE=pt_BR` e `PARAMS` no topo do script — ver `whatsapp-templates-params.md`).

---

## 1. Lembrete de consulta  →  `lembrete_consulta_v2`
**Categoria: UTILITY**
> Obs.: o nome é `_v2` porque já existe um `lembrete_consulta` APROVADO como
> MARKETING na WABA, e a Meta não deixa recriar o mesmo nome com outra categoria.

**Corpo:**
```
Oi, {{1}}! Passando pra lembrar da sua consulta na {{2}}.

📅 {{3}} às {{4}}
👩‍⚕️ {{5}}

Qualquer imprevisto, é só nos avisar por aqui. Até lá!
```

**Variáveis (samples p/ a Meta):**
- `{{1}}` nome do paciente — *Maria*
- `{{2}}` nome da clínica — *Clínica Becari*
- `{{3}}` data — *28/07/2026*
- `{{4}}` hora — *15:30*
- `{{5}}` profissional — *Dra. Fernanda*

---

## 2. Confirmação / reagendamento  →  `confirmacao_consulta`
**Categoria: UTILITY** — com botões de resposta rápida (Quick Reply)

**Corpo:**
```
Oi, {{1}}! Sua consulta na {{2}} está marcada para {{3}} às {{4}}.

Pode confirmar pra gente? Se precisar remarcar, é só tocar abaixo que a gente ajeita.
```

**Botões (Quick Reply):**
- `Confirmar presença`
- `Preciso remarcar`

**Variáveis (samples):**
- `{{1}}` *Maria* · `{{2}}` *Clínica Becari* · `{{3}}` *28/07/2026* · `{{4}}` *15:30*

> Os cliques nos botões chegam no webhook do WhatsApp como `button` reply —
> dá pra tratar em `whatsappWebhook.js` pra atualizar o status do agendamento.

---

## 3a. Retorno / pós-atendimento (versão UTILITY-safe)  →  `retorno_paciente`
**Categoria: UTILITY**
Use esta quando o retorno é uma etapa esperada do tratamento (protocolo, próxima sessão).
Foco em "acompanhamento do seu tratamento", NÃO em promoção — assim a Meta mantém como UTILITY.

**Corpo:**
```
Oi, {{1}}! Como parte do seu acompanhamento na {{2}}, chegou o momento do seu retorno.

Recomendação: {{3}}

Quer que a gente já reserve um horário pra você? É só responder por aqui.
```

**Variáveis (samples):**
- `{{1}}` *Maria* · `{{2}}` *Clínica Becari*
- `{{3}}` motivo/recomendação — *retorno de 30 dias após o preenchimento*

---

## 3b. Reativação / novidades (versão MARKETING)  →  `reativacao_paciente`
**Categoria: MARKETING** — exige rodapé de opt-out
Use esta quando for reengajar quem sumiu, avisar novidade ou oferta.

**Corpo:**
```
Oi, {{1}}! Sentimos sua falta na {{2}}. 💚

{{3}}

Se quiser agendar, é só responder esta mensagem.
Se preferir não receber mais estes avisos, responda SAIR.
```

**Variáveis (samples):**
- `{{1}}` *Maria* · `{{2}}` *Clínica Becari*
- `{{3}}` mensagem/oferta — *Este mês, avaliação de skincare sem custo pra clientes que voltam.*

---

## 4. Cobrança / financeiro  →  `aviso_fatura`
**Categoria: UTILITY**
Aviso de fatura em aberto de serviço já contratado (transacional). Sem tom de "promoção".

**Corpo:**
```
Oi, {{1}}! Passando pra avisar sobre um valor em aberto na {{2}}.

💰 Valor: {{3}}
📅 Vencimento: {{4}}

Você pode pagar pelo link abaixo. Se já pagou, pode ignorar — pode levar até 1 dia útil pra compensar. Qualquer dúvida, é só chamar.
```

**Botão (Call to Action → Visit website, URL dinâmica):**
- Texto: `Pagar agora`
- Tipo: URL dinâmica → `https://...{{1}}` (a Meta trata o trecho variável da URL como `{{1}}` do botão, separado das variáveis do corpo)
- Sample da URL: um link de pagamento real (ex.: link Asaas)

**Variáveis do CORPO (samples):**
- `{{1}}` *Maria* · `{{2}}` *Clínica Becari*
- `{{3}}` valor — *R$ 199,00* · `{{4}}` vencimento — *30/07/2026*

> ⚠️ Financeiro é sensível na política da Meta. Mantenha factual (você tem uma
> fatura), sem pressão/ameaça. Nada de "última chance", "bloqueio", CAIXA ALTA.

---

## Dicas para NÃO ser rejeitado
- **Sem CAIXA ALTA excessiva, sem `!!!`, sem emoji demais** (1–2 por mensagem tá ótimo).
- **Toda `{{n}}` precisa de um exemplo** no campo Sample, senão rejeita na hora.
- Não comece nem termine o corpo com uma variável (a Meta implica com isso).
- Não prometa nada fora do escopo transacional em templates UTILITY.
- Se um UTILITY for reclassificado pra MARKETING, é normal — só custa mais; não é rejeição.
- Nome do template: minúsculo, sem espaço, com `_` (já estão assim).
