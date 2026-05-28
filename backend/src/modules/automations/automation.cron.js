import cron from "node-cron";
import { runBirthdayCron, runReminderCron } from "./automation.service.js";

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

  console.log("[Cron] Automation crons scheduled.");
}
