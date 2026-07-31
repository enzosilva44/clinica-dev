// Formatação de data/hora no fuso do Brasil.
//
// A EC2 de produção roda em UTC. Um toLocaleString("pt-BR") sem timeZone usa o
// fuso do PROCESSO, então em produção uma consulta às 18:15 saía como 21:15 nas
// mensagens de WhatsApp — 3h adiantada. Na máquina do dev não aparecia, porque
// o relógio local já está em Brasília: o bug só existia em produção.
//
// Todo texto que vai para o paciente deve usar estas funções, nunca
// toLocaleDateString/toLocaleTimeString direto.
const TZ = "America/Sao_Paulo";

export function dataBR(valor) {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function horaBR(valor) {
  return new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

export function dataHoraBR(valor) {
  return `${dataBR(valor)} às ${horaBR(valor)}`;
}
