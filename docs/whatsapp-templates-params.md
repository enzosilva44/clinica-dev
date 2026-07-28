# Params na ordem — para o script de teste

Depois que cada template for **aprovado**, edite o topo de
`backend/scripts/send-test-template.js` com estes valores e rode:

```
node scripts/send-test-template.js 5516999999999
```

A ordem dos PARAMS bate com os corpos reais criados na Meta. A 2ª variável é
sempre a **apresentação da clínica** (ex.: "do consultório Dra. Fernanda"), que
em produção é gerada por `apresentacaoClinica()` — aqui só um valor de exemplo.

---

### lembrete_consulta_iaso
```js
const TEMPLATE_NAME = "lembrete_consulta_iaso";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "do consultório Dra. Fernanda", "28/07/2026", "15:30"];
```

### confirmacao_consulta_iaso
```js
const TEMPLATE_NAME = "confirmacao_consulta_iaso";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "do consultório Dra. Fernanda", "28/07/2026", "15:30"];
// botões (Quick Reply) não vão em PARAMS — são fixos no template
```

### retorno_paciente_iaso
```js
const TEMPLATE_NAME = "retorno_paciente_iaso";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "do consultório Dra. Fernanda", "retorno de 30 dias após o preenchimento"];
```

### reativacao_paciente_iaso
```js
const TEMPLATE_NAME = "reativacao_paciente_iaso";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "do consultório Dra. Fernanda", "Este mês, avaliação de skincare sem custo pra clientes que voltam."];
```

### aviso_fatura_iaso
```js
const TEMPLATE_NAME = "aviso_fatura_iaso";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "do consultório Dra. Fernanda", "R$ 199,00", "30/07/2026"];
// o botão de URL dinâmica usa uma variável PRÓPRIA (o {{1}} do botão),
// num component "type: button" — ver nota abaixo.
```

---

## Nota sobre o botão de URL dinâmica (aviso_fatura_iaso)
O script atual só manda `components: [{ type: "body", ... }]`.
Para o botão de URL dinâmica, adicione também:

```js
const components = [
  { type: "body", parameters: PARAMS.map((text) => ({ type: "text", text: String(text) })) },
  {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: "abc123" }], // trecho dinâmico da URL (vira /i/abc123)
  },
];
```
(Só precisa disso pro `aviso_fatura_iaso`. Os outros funcionam com o script como está.)
