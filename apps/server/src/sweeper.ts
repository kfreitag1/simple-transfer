import { UPLOAD_TTL_SECONDS } from "@st/shared/constants";
import { and, eq, lt, lte, or } from "drizzle-orm";
import type { Context } from "./app.ts";
import type { Db } from "./db/index.ts";
import { transfer } from "./db/schema.ts";
import { deleteTransfer } from "./transfers/service.ts";

const INTERVAL_MS = 5 * 60 * 1000;

export function sweepable(db: Db, now: Date): string[] {
  const stalledBefore = new Date(now.getTime() - UPLOAD_TTL_SECONDS * 1000);
  return db
    .select({ id: transfer.id })
    .from(transfer)
    .where(
      or(lte(transfer.expiresAt, now), and(eq(transfer.status, "uploading"), lt(transfer.touchedAt, stalledBefore))),
    )
    .all()
    .map((row) => row.id);
}

export async function sweep(ctx: Context, now = new Date()): Promise<void> {
  for (const id of sweepable(ctx.db, now)) await deleteTransfer(ctx, id);
}

export function startSweeper(ctx: Context): void {
  const run = () => sweep(ctx).catch((error) => console.error("sweep failed", error));
  run();
  setInterval(run, INTERVAL_MS);
}
