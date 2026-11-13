import { type LimitOverride, type Limits, resolveLimits } from "@st/shared/limits";
import { and, eq, or, sql } from "drizzle-orm";
import type { Context } from "./app.ts";
import type { User } from "./auth.ts";
import type { Db, Tx } from "./db/index.ts";
import { limitOverride, transfer } from "./db/schema.ts";

export function limitsFor(db: Db, user: User): Limits {
  const rows = db
    .select()
    .from(limitOverride)
    .where(
      or(
        eq(limitOverride.scope, "global"),
        and(eq(limitOverride.scope, "role"), eq(limitOverride.subject, user.role ?? "user")),
        and(eq(limitOverride.scope, "user"), eq(limitOverride.subject, user.id)),
      ),
    )
    .all();
  const layer = (scope: string) => rows.find((row) => row.scope === scope)?.values;
  return resolveLimits(layer("global"), layer("role"), layer("user"));
}

export function usedBytes(db: Db | Tx, userId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${transfer.size}), 0)` })
    .from(transfer)
    .where(eq(transfer.ownerId, userId))
    .get();
  return row!.total;
}

export const listLimitOverrides = (ctx: Context): LimitOverride[] => ctx.db.select().from(limitOverride).all();

export function setLimitOverride(ctx: Context, { scope, subject, values }: LimitOverride): void {
  const key = { scope, subject: scope === "global" ? "" : subject };
  if (Object.keys(values).length === 0) {
    ctx.db
      .delete(limitOverride)
      .where(and(eq(limitOverride.scope, key.scope), eq(limitOverride.subject, key.subject)))
      .run();
  } else {
    ctx.db
      .insert(limitOverride)
      .values({ ...key, values })
      .onConflictDoUpdate({ target: [limitOverride.scope, limitOverride.subject], set: { values } })
      .run();
  }
}
