import type { Config } from "@st/shared/contract";
import { Elysia, NotFound } from "elysia";
import { adminRoutes } from "./admin/routes.ts";
import { type Auth, createAuth } from "./auth.ts";
import { type Release, readChangelog } from "./changelog.ts";
import { createDb, type Db } from "./db/index.ts";
import type { Env } from "./env.ts";
import { limitsFor, usedBytes } from "./limits.ts";
import { authPlugin } from "./plugins/auth.ts";
import { blobLength } from "./serve.ts";
import { getSettings } from "./settings.ts";
import { createLocalStorage } from "./storage/local.ts";
import type { Storage } from "./storage/storage.ts";
import { transferRoutes } from "./transfers/routes.ts";
import { createUpdates, readVersion, type Updates } from "./updates.ts";

export interface Context {
  env: Env;
  db: Db;
  auth: Auth;
  storage: Storage;
  version: string;
  changelog: Release[];
  updates: Updates;
}

export function createContext(env: Env, options: { test?: boolean } = {}): Context {
  const db = createDb(env.dbPath);
  const version = readVersion();
  const ctx = {
    env,
    db,
    auth: createAuth(env, db, options),
    storage: createLocalStorage(env.storageDir),
    version,
    changelog: readChangelog(),
  } as Context;
  ctx.updates = createUpdates(ctx, version);
  return ctx;
}

export function createApp(ctx: Context) {
  return (
    new Elysia({ prefix: "/api", cookie: { secrets: ctx.env.authSecret, sign: ["unlock"] } })
      .use(blobLength())
      .use(authPlugin(ctx.auth))
      .get("/auth/*", ({ request }) => ctx.auth.handler(request))
      .post("/auth/*", { parse: "none" }, ({ request }) => ctx.auth.handler(request))
      .get("/health", () => ({ ok: true }))
      .get("/config", (): Config => ({ providerName: ctx.env.oidc.providerName, settings: getSettings(ctx) }))
      .get("/me", { auth: true }, ({ user }) => ({
        limits: limitsFor(ctx.db, user),
        usedBytes: usedBytes(ctx.db, user.id),
      }))
      .use(transferRoutes(ctx))
      .use(adminRoutes(ctx))
      // Keeps unknown API paths a JSON 404 instead of falling through to the web app's index.html
      .get("/*", () => {
        throw new NotFound();
      })
  );
}

export type App = ReturnType<typeof createApp>;
