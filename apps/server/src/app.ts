import { Elysia, NotFound } from "elysia";
import { type Auth, createAuth } from "./auth.ts";
import { createDb, type Db } from "./db/index.ts";
import type { Env } from "./env.ts";
import { limitsFor, usedBytes } from "./limits.ts";
import { authPlugin } from "./plugins/auth.ts";
import { blobLength } from "./serve.ts";
import { createLocalStorage } from "./storage/local.ts";
import type { Storage } from "./storage/storage.ts";

/** Everything with state. Built once in `index.ts`; tests build their own (see `test/harness.ts`). */
export interface Context {
  env: Env;
  db: Db;
  auth: Auth;
  storage: Storage;
}

export function createContext(env: Env, options: { test?: boolean } = {}): Context {
  const db = createDb(env.dbPath);
  return { env, db, auth: createAuth(env, db, options), storage: createLocalStorage(env.storageDir) };
}

export function createApp(ctx: Context) {
  return (
    new Elysia({ prefix: "/api" })
      .use(blobLength())
      .use(authPlugin(ctx.auth))
      .get("/auth/*", ({ request }) => ctx.auth.handler(request))
      .post("/auth/*", { parse: "none" }, ({ request }) => ctx.auth.handler(request))
      .get("/health", () => ({ ok: true }))
      .get("/me", { auth: true }, ({ user }) => ({
        limits: limitsFor(ctx.db, user),
        usedBytes: usedBytes(ctx.db, user.id),
      }))
      // Keeps unknown API paths a JSON 404 instead of falling through to the web app's index.html.
      .get("/*", () => {
        throw new NotFound();
      })
  );
}

/** Consumed by the web app through Eden. */
export type App = ReturnType<typeof createApp>;
