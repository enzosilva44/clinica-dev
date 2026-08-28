import { app } from "./app.js";
import { startAutomationCrons } from "./modules/automations/automation.cron.js";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startAutomationCrons();
});
