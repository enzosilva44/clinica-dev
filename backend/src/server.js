import { app } from "./app.js";
import { startAutomationCrons } from "./modules/automations/automation.cron.js";
import { startWebhookWorker } from "./modules/conversations/webhook/webhookWorker.js";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startAutomationCrons();
  // O worker drena a fila do Iaso Conversas, cujos models ainda não estão no
  // schema — sem eles cada ciclo falha em loop (era o que acontecia em prod).
  // Fica desligado até o módulo ser restaurado; então é só definir a env.
  if (process.env.WEBHOOK_WORKER_ENABLED === "true") startWebhookWorker();
});
