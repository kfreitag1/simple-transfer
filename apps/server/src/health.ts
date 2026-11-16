import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname } from "node:path";
import type { Health } from "@st/shared/contract";
import type { Context } from "./app.ts";
import { transfer } from "./db/schema.ts";

const TTL_MS = 5_000;

const succeeds = (probe: () => unknown) =>
  Promise.resolve()
    .then(probe)
    .then(
      () => true,
      () => false,
    );

async function check(ctx: Context): Promise<Health> {
  const [db, storage] = await Promise.all([
    succeeds(async () => {
      ctx.db.select({ id: transfer.id }).from(transfer).limit(1).get();
      // SQLite writes beside the file too (journal, WAL), so the directory must be writable as well
      if (ctx.env.dbPath !== ":memory:") {
        await access(ctx.env.dbPath, constants.W_OK);
        await access(dirname(ctx.env.dbPath), constants.W_OK);
      }
    }),
    succeeds(() => ctx.storage.health()),
  ]);
  return { ok: db && storage, db, storage };
}

/** Readiness, as `/api/health` reports it. One probe answers for a few seconds, so a burst of checks does not write on each */
export function createHealthCheck(ctx: Context): () => Promise<Health> {
  let last: { at: number; result: Promise<Health> } | undefined;
  return () => {
    if (!last || Date.now() - last.at >= TTL_MS) last = { at: Date.now(), result: check(ctx) };
    return last.result;
  };
}
