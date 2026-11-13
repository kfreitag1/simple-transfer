import { Elysia } from "elysia";
import { createApp, createContext } from "./app.ts";
import { loadEnv } from "./env.ts";
import { webPlugin } from "./web.ts";

const env = loadEnv();
const server = new Elysia()
  .use(createApp(createContext(env)))
  .use(await webPlugin(env.webDir))
  .listen(env.port);

console.log(`simple-transfer listening on ${server.server?.url}`);
