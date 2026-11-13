import { expect, test } from "bun:test";
import { UPLOAD_TTL_SECONDS } from "@st/shared/constants";
import { createTestApp } from "../test/harness.ts";
import { transfer } from "./db/schema.ts";
import { sweepable } from "./sweeper.ts";

test("sweeps transfers past their expiry and uploads stalled for the upload TTL, nothing else", async () => {
  const { ctx, signIn } = createTestApp();
  const { user } = await signIn();
  const now = new Date(1_000_000_000_000);
  const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  const insert = (id: string, values: Partial<typeof transfer.$inferInsert>) =>
    ctx.db
      .insert(transfer)
      .values({ id, ownerId: user.id, size: 0, status: "ready", touchedAt: at(-10 * UPLOAD_TTL_SECONDS), ...values })
      .run();

  insert("expired-now", { expiresAt: now });
  insert("expires-later", { expiresAt: at(1) });
  insert("never-expires", { expiresAt: null });
  insert("stalled", { status: "uploading", touchedAt: at(-UPLOAD_TTL_SECONDS - 1) });
  insert("uploading", { status: "uploading", touchedAt: at(-UPLOAD_TTL_SECONDS + 1) });

  expect(sweepable(ctx.db, now).sort()).toEqual(["expired-now", "stalled"]);
});
