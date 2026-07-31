import cron from "node-cron";
import { runBirthdayCron, runReminderCron } from "./automation.service.js";
import { cleanupExpiredDemos } from "../auth/demoCleanup.service.js";
import { syncWhatsappCost } from "../whatsapp/whatsappCost.service.js";

export function startAutomationCrons() {
  // Every day at 09:00 — birthday messages
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Running birthday automation…");
    try { await runBirthdayCron(); }
    catch (e) { console.error("[Cron] birthday error:", e.message); }
  });

  // Every 30 minutes — appointment reminders
  cron.schedule("*/30 * * * *", async () => {
    console.log("[Cron] Running reminder automation…");
    try { await runReminderCron(); }
    catch (e) { console.error("[Cron] reminder error:", e.message); }
  });

  // Every hour — remove expired demo accounts (TTL 48h)
  cron.schedule("15 * * * *", async () => {
    console.log("[Cron] Cleaning expired demo accounts…");
    try { await cleanupExpiredDemos(); }
    catch (e) { console.error("[Cron] demo cleanup error:", e.message); }
  });

  // Todo dia às 05:00 — espelha o custo do WhatsApp cobrado pela Meta.
  // Roda de madrugada porque a Graph API responde melhor fora de pico e o dado
  // do dia anterior já fechou. Falha aqui NÃO afeta envio: o painel só fica
  // desatualizado, e a próxima rodada regrava a janela inteira.
  cron.schedule("0 5 * * *", async () => {
    console.log("[Cron] Sincronizando custo do WhatsApp (Meta)…");
    try {
      const r = await syncWhatsappCost({ forcar: true });
      console.log(`[Cron] custo WhatsApp: ${r.linhas} linha(s) atualizada(s).`);
    } catch (e) { console.error("[Cron] whatsapp cost error:", e.message); }
  });

  console.log("[Cron] Automation crons scheduled.");
}
