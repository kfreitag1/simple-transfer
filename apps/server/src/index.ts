import { CHUNK_BYTES } from "@st/shared/constants";
import { Elysia } from "elysia";
import { createApp, createContext } from "./app.ts";
import { loadEnv } from "./env.ts";
import { serve } from "./serve.ts";
import { startSweeper } from "./sweeper.ts";
import { webPlugin } from "./web.ts";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
const ctx = createContext(env);
const app = new Elysia().use(createApp(ctx)).use(await webPlugin(env.webDir));
const server = serve((request) => app.handle(request), {
  port: env.port,
  trustProxy: env.trustProxy,
  maxBodyBytes: CHUNK_BYTES + 1024,
});
startSweeper(ctx);
ctx.updates.start();

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), SHUTDOWN_TIMEOUT_MS).unref();
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);

console.log(`simple-transfer listening on http://localhost:${env.port}`);
