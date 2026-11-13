import { CHUNK_BYTES } from "@st/shared/constants";
import { Elysia } from "elysia";
import { createApp, createContext } from "./app.ts";
import { loadEnv } from "./env.ts";
import { serve } from "./serve.ts";
import { startSweeper } from "./sweeper.ts";
import { webPlugin } from "./web.ts";

const env = loadEnv();
const ctx = createContext(env);
const app = new Elysia().use(createApp(ctx)).use(await webPlugin(env.webDir));
serve((request) => app.handle(request), {
  port: env.port,
  trustProxy: env.trustProxy,
  maxBodyBytes: CHUNK_BYTES + 1024,
});
startSweeper(ctx);

console.log(`simple-transfer listening on http://localhost:${env.port}`);
