/**
 * Tom de voz Iaso — acolhedor, claro, confiante ("sócio, não login").
 * Fonte: "Iaso - Identidade Verbal".
 *
 * Uso:
 *   import { notify, vazio } from "../lib/tomDeVoz";
 *   notify.ok("Paciente salvo");            // sucesso no tom da marca
 *   notify.erro(e, "salvar o paciente");    // erro humanizado + mensagem do backend
 *   <EmptyState {...vazio.pacientes} />      // textos de estado vazio prontos
 *
 * Princípio: NÃO expor "Erro ao X" seco. Preferir "Não consegui X agora.
 * Tenta de novo?" — próximo, sem jargão, sem CAIXA ALTA/!!!.
 */
import toast from "react-hot-toast";

// Extrai a melhor mensagem de um erro (backend > genérica), sem vazar stack.
export function mensagemDeErro(err, acao) {
  const doBackend = err?.response?.data?.error;
  if (doBackend && typeof doBackend === "string") return doBackend;
  if (acao) return `Não consegui ${acao} agora. Pode tentar de novo?`;
  return "Algo não saiu como esperado. Pode tentar de novo?";
}

export const notify = {
  ok: (msg) => toast.success(msg),
  erro: (err, acao) => toast.error(mensagemDeErro(err, acao)),
  info: (msg) => toast(msg),
};

// Estados vazios prontos, no tom "a gente organiza pra você".
export const vazio = {
  lancamentos: {
    titulo: "Ainda não há lançamentos por aqui",
    descricao: "Quando houver, a gente organiza tudo pra você.",
  },
  pacientes: {
    titulo: "Nenhum paciente ainda",
    descricao: "Cadastre o primeiro e comece a acompanhar de perto.",
  },
  agendamentos: {
    titulo: "Agenda livre por enquanto",
    descricao: "Os próximos agendamentos aparecem aqui.",
  },
  documentos: {
    titulo: "Nenhum documento por aqui ainda",
    descricao: "Os documentos da clínica para assinar aparecem nesta pasta.",
  },
  generico: {
    titulo: "Nada por aqui ainda",
    descricao: "Quando houver, a gente mostra tudo organizado.",
  },
};

// Frases de apoio reutilizáveis (onboarding, confirmações).
export const frases = {
  boasVindas: "Bem-vinda. Nos próximos minutos, deixamos sua clínica pronta — com a gente junto.",
  salvoOk: "Tudo certo, salvamos pra você.",
  confirmacaoWhats: "Seu paciente confirmou pelo WhatsApp. Tudo pronto. ✓",
};
