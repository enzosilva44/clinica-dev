# Params na ordem — para o script de teste

Depois que cada template for **aprovado**, edite o topo de
`backend/scripts/send-test-template.js` com estes valores e rode:

```
node scripts/send-test-template.js 5516999999999
```

---

### lembrete_consulta_v2
```js
const TEMPLATE_NAME = "lembrete_consulta_v2";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "Clínica Becari", "28/07/2026", "15:30", "Dra. Fernanda"];
```

### confirmacao_consulta
```js
const TEMPLATE_NAME = "confirmacao_consulta";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "Clínica Becari", "28/07/2026", "15:30"];
// botões (Quick Reply) não vão em PARAMS — são fixos no template
```

### retorno_paciente
```js
const TEMPLATE_NAME = "retorno_paciente";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "Clínica Becari", "retorno de 30 dias após o preenchimento"];
```

### reativacao_paciente
```js
const TEMPLATE_NAME = "reativacao_paciente";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "Clínica Becari", "Este mês, avaliação de skincare sem custo pra clientes que voltam."];
```

### aviso_fatura
```js
const TEMPLATE_NAME = "aviso_fatura";
const LANGUAGE = "pt_BR";
const PARAMS = ["Maria", "Clínica Becari", "R$ 199,00", "30/07/2026"];
// atenção: o botão de URL dinâmica usa uma variável PRÓPRIA (o {{1}} do botão),
// que precisa ir num component "type: button". Ver nota abaixo.
```

---

## Nota sobre o botão de URL dinâmica (aviso_fatura)
O script atual só manda `components: [{ type: "body", ... }]`.
Para o botão de URL dinâmica, adicione também:

```js
const components = [
  { type: "body", parameters: PARAMS.map((text) => ({ type: "text", text: String(text) })) },
  {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: "pay/abc123" }], // trecho dinâmico da URL
  },
];
```
(Só precisa disso pro `aviso_fatura`. Os outros funcionam com o script como está.)
