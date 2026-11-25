import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { initSockets } from "./sockets";
import { startSlaMonitor } from "./jobs/sla-monitor";

async function main() {
  await prisma.$connect();
  const server = createServer(app);
  initSockets(server);
  startSlaMonitor();
  server.listen(env.PORT, () => {
    console.log(`SmartSLA API listening on http://localhost:${env.PORT}`);
  });
  const shutdown = async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});
