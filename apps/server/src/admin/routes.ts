import { type AdminStats, type Releases, Settings } from "@st/shared/contract";
import { LimitOverride } from "@st/shared/limits";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import type { Context } from "../app.ts";
import { transfer, user } from "../db/schema.ts";
import { listLimitOverrides, setLimitOverride } from "../limits.ts";
import { authPlugin } from "../plugins/auth.ts";
import { setSettings } from "../settings.ts";
import { listAllTransfers } from "../transfers/service.ts";

async function stats(ctx: Context): Promise<AdminStats> {
  const totals = ctx.db
    .select({ transfers: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(${transfer.size}), 0)` })
    .from(transfer)
    .get()!;
  return { users: await ctx.db.$count(user), ...totals };
}

export const adminRoutes = (ctx: Context) =>
  new Elysia({ prefix: "/admin" })
    .use(authPlugin(ctx.auth))
    .get("/transfers", { admin: true }, () => listAllTransfers(ctx))
    .get("/limits", { admin: true }, () => listLimitOverrides(ctx))
    .put("/limits", { admin: true, body: LimitOverride }, ({ body, set }) => {
      setLimitOverride(ctx, body);
      set.status = 204;
    })
    .get("/stats", { admin: true }, () => stats(ctx))
    .get(
      "/releases",
      { admin: true },
      (): Releases => ({ current: ctx.version, releases: ctx.changelog, update: ctx.updates.available() }),
    )
    .put("/settings", { admin: true, body: Settings }, ({ body, set }) => {
      setSettings(ctx, body);
      set.status = 204;
      void ctx.updates.check();
    });
