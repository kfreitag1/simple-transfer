import { CHUNK_BYTES } from "@st/shared/constants";
import { Elysia } from "elysia";
import { createApp, createContext } from "./app.ts";
import { loadEnv } from "./env.ts";
import { serve } from "./serve.ts";
import { webPlugin } from "./web.ts";

const env = loadEnv();
const app = new Elysia().use(createApp(createContext(env))).use(await webPlugin(env.webDir));
serve((request) => app.handle(request), {
  port: env.port,
  trustProxy: env.trustProxy,
  maxBodyBytes: CHUNK_BYTES + 1024,
});

console.log(`simple-transfer listening on http://localhost:${env.port}`);
