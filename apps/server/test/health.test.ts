import { expect, test } from "bun:test";
import { createTestApp } from "./harness.ts";

test("health is 200 only when the database and storage are both usable", async () => {
  const healthy = createTestApp();
  const response = await healthy.request("/api/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, db: true, storage: true });

  const noStorage = createTestApp();
  noStorage.ctx.storage.health = async () => {
    throw new Error("read-only");
  };
  const storage = await noStorage.request("/api/health");
  expect(storage.status).toBe(503);
  expect(await storage.json()).toEqual({ ok: false, db: true, storage: false });

  const noDb = createTestApp();
  noDb.ctx.db.$client.close();
  const db = await noDb.request("/api/health");
  expect(db.status).toBe(503);
  expect(await db.json()).toEqual({ ok: false, db: false, storage: true });
});
