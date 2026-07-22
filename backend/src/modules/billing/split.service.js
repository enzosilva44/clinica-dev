import { prisma } from "../../config/prisma.js";
import { getIasopayWalletId } from "./billing.service.js";

// AsaasSplitService
// ─────────────────────────────────────────────────────────────────────────────
// Responsável por: ler a configuração de split (parametrizada no banco), validar
// as regras, calcular a comissão IASOPay e montar o payload `split` que o Asaas
// espera no POST /payments.
//
// Contrato do Asaas (docs/split-de-pagamentos):
//   split: [{ walletId, percentualValue }]   // quando PERCENTAGE
//   split: [{ walletId, fixedValue }]         // quando FIXED
// O walletId é o DESTINO da comissão (conta root IASOPay). A cobrança nasce na
// subconta da clínica; o Asaas retém a comissão e credita na wallet informada.

const round2 = (n) => Math.round(n * 100) / 100;

// Lê a config ativa de um método. Retorna null se inexistente ou desativada
// (nesse caso a cobrança segue SEM split — comportamento seguro/compatível).
export async function getSplitConfig(paymentMethod) {
  const cfg = await prisma.splitConfig.findUnique({ where: { paymentMethod } });
  if (!cfg || !cfg.active) return null;
  return cfg;
}

// Estima a comissão IASOPay em R$ para exibição/registro no Transaction.
//   PERCENTAGE: splitValue é % (0.20 = 0,20%) → amount * value / 100
//   FIXED:      splitValue já é R$
export function estimateIasoRevenue(cfg, amount) {
  if (!cfg) return 0;
  if (cfg.splitType === "PERCENTAGE") return round2((amount * cfg.splitValue) / 100);
  return round2(cfg.splitValue); // FIXED
}

// Monta o resultado de split para uma cobrança. Retorna:
//   { split: [...], applied: true, config }   — quando há split a aplicar
//   { split: undefined, applied: false, reason } — quando NÃO se aplica
//
// Não aplica split (sem quebrar a cobrança) quando:
//   - método sem config ativa
//   - walletId root não configurada (rodar POST /billing/iasopay-wallet/sync)
//   - destino = origem (clínica não divide consigo mesma)
//   - FIXED cujo valor excede a própria cobrança (Asaas rejeitaria)
export async function buildSplit({ paymentMethod, amount, clinicWalletId }) {
  const value = Number(amount);
  const cfg = await getSplitConfig(paymentMethod);
  if (!cfg) return { split: undefined, applied: false, reason: "sem config ativa" };

  const destWalletId = await getIasopayWalletId();
  if (!destWalletId) {
    return { split: undefined, applied: false, reason: "walletId IASOPay não configurada" };
  }

  // Clínica não pode dividir para a própria wallet (Asaas rejeita e não faz sentido).
  if (clinicWalletId && clinicWalletId === destWalletId) {
    return { split: undefined, applied: false, reason: "wallet destino = wallet origem" };
  }

  if (cfg.splitType === "FIXED") {
    if (cfg.splitValue >= value) {
      // Split fixo não pode consumir toda (ou mais que) a cobrança.
      return { split: undefined, applied: false, reason: "split fixo ≥ valor da cobrança" };
    }
    return {
      split: [{ walletId: destWalletId, fixedValue: round2(cfg.splitValue) }],
      applied: true,
      config: cfg,
      iasoRevenue: estimateIasoRevenue(cfg, value),
    };
  }

  // PERCENTAGE
  return {
    split: [{ walletId: destWalletId, percentualValue: cfg.splitValue }],
    applied: true,
    config: cfg,
    iasoRevenue: estimateIasoRevenue(cfg, value),
  };
}
