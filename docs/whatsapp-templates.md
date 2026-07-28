# Templates de Mensagem — WhatsApp Cloud API (Meta)

Estado atual: **5 templates criados via API** na WABA `3190337364500896` ("Iaso Tecnologia"),
todos em análise (PENDING). Criados/recriados pelo script `backend/scripts/create-templates.js`.

Idioma: **Português (BR)** → `pt_BR`. Variáveis posicionais `{{1}}`, `{{2}}`...

## Modelo de envio (importante)
Um **número único** (o da plataforma, do `.env`) envia por **todas as clínicas**.
Por isso **toda mensagem abre identificando de quem é**: *"Olá Maria! Aqui é do
consultório Dra. Fernanda..."*. Essa apresentação é a variável `{{2}}` (clinica)
na maioria dos templates, resolvida em runtime por `apresentacaoClinica()` no
`automation.service.js` (prioridade: nickname → name do dono → clinicName).

Se uma clínica conectar o próprio WhatsApp (Embedded Signup), o envio passa a usar
o número dela automaticamente (o `logAndSend` já trata esse fallback).

Recriar / re-submeter todos:
```
cd backend && node scripts/create-templates.js 3190337364500896
```
Criar só um: `node scripts/create-templates.js 3190337364500896 <nome>`

---

## 1. Lembrete de consulta  →  `lembrete_consulta_iaso`
**Categoria: UTILITY** · mapeado no service como automação `reminder`
Nome com sufixo `_iaso` porque já existe um `lembrete_consulta` (MARKETING) na WABA.

**Corpo:**
```
Olá {{1}}! 🔔 Aqui é {{2}}. Passando pra lembrar da sua consulta em {{3}} às {{4}}.

Qualquer imprevisto, é só nos avisar por aqui. Te esperamos!
```
**Variáveis:** `{{1}}` nome · `{{2}}` clinica (apresentação) · `{{3}}` data · `{{4}}` hora

---

## 2. Confirmação / reagendamento  →  `confirmacao_consulta_iaso`
**Categoria: UTILITY** · botões Quick Reply · automação `confirmation`

**Corpo:**
```
Olá {{1}}! Aqui é {{2}}. ✅ Sua consulta está marcada para {{3}} às {{4}}.

Pode confirmar pra gente? Se precisar remarcar, é só tocar abaixo que a gente ajeita.
```
**Botões (Quick Reply):** `Confirmar presença` · `Preciso remarcar`
**Variáveis:** `{{1}}` nome · `{{2}}` clinica · `{{3}}` data · `{{4}}` hora

> Os cliques chegam no webhook como `button` reply — dá pra tratar em
> `whatsappWebhook.js` pra atualizar o status do agendamento.

---

## 3a. Retorno / pós-atendimento (UTILITY-safe)  →  `retorno_paciente_iaso`
**Categoria: UTILITY**
Foco em "acompanhamento do tratamento" (não promoção) pra manter como UTILITY.

**Corpo:**
```
Olá {{1}}! Aqui é {{2}}. Como parte do seu acompanhamento, chegou o momento do seu retorno.

Recomendação: {{3}}

Quer que a gente já reserve um horário pra você? É só responder por aqui.
```
**Variáveis:** `{{1}}` nome · `{{2}}` clinica · `{{3}}` recomendação/motivo

---

## 3b. Reativação / novidades (MARKETING)  →  `reativacao_paciente_iaso`
**Categoria: MARKETING** — com opt-out. Use pra reengajar/oferta.

**Corpo:**
```
Olá {{1}}! Aqui é {{2}} e sentimos sua falta. 💚

{{3}}

Se quiser agendar, é só responder esta mensagem.
Se preferir não receber mais estes avisos, responda SAIR.
```
**Variáveis:** `{{1}}` nome · `{{2}}` clinica · `{{3}}` mensagem/oferta

---

## 4. Cobrança / financeiro  →  `aviso_fatura_iaso`
**Categoria: UTILITY** · botão de URL dinâmica

**Corpo:**
```
Olá {{1}}! Aqui é {{2}}. Passando pra avisar sobre um valor em aberto.

💰 Valor: {{3}}
📅 Vencimento: {{4}}

Você pode pagar pelo link abaixo. Se já pagou, pode ignorar — pode levar até 1 dia útil pra compensar. Qualquer dúvida, é só chamar.
```
**Botão (URL dinâmica):** texto `Pagar agora` · URL `https://www.asaas.com/i/{{1}}`
(o `{{1}}` do botão é próprio, separado das variáveis do corpo)
**Variáveis do CORPO:** `{{1}}` nome · `{{2}}` clinica · `{{3}}` valor · `{{4}}` vencimento

> ⚠️ Financeiro é sensível na Meta. Mantenha factual, sem pressão/ameaça.

---

## Dicas para NÃO ser rejeitado
- Sem CAIXA ALTA excessiva, sem `!!!`, 1–2 emojis no máximo.
- Toda `{{n}}` precisa de um exemplo (sample), senão rejeita — o script já manda.
- Não comece nem termine o corpo com uma variável.
- Nada fora do escopo transacional em UTILITY.
- Se um UTILITY virar MARKETING, é reclassificação normal, não rejeição.
