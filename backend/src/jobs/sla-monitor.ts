import cron from "node-cron";
import { env } from "../config/env";
import { monitorSlaOnce } from "../services/sla";

export function startSlaMonitor() {
  if (env.SLA_MONITOR_ENABLED.toLowerCase() !== "true") return;
  cron.schedule("* * * * *", () => {
    void monitorSlaOnce().catch((error: unknown) => {
      console.error("SLA monitor run failed", error);
    });
  });
}
