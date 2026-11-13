import { expect, test } from "bun:test";
import { DEFAULT_LIMITS, resolveLimits } from "./limits.ts";

test("more specific layers win key by key, and null means unlimited rather than inherit", () => {
  const limits = resolveLimits(
    { quotaBytes: 100, maxTransferBytes: 10 },
    { quotaBytes: 200 },
    { maxTransferBytes: null },
  );
  expect(limits).toEqual({ ...DEFAULT_LIMITS, quotaBytes: 200, maxTransferBytes: null });
});

test("default expiry is clamped to an overridden max expiry", () => {
  expect(resolveLimits({ maxExpirySeconds: 60 }).defaultExpirySeconds).toBe(60);
  expect(resolveLimits({ defaultExpirySeconds: null }, { maxExpirySeconds: 60 }).defaultExpirySeconds).toBe(60);
  expect(resolveLimits({ maxExpirySeconds: null, defaultExpirySeconds: null }).defaultExpirySeconds).toBeNull();
});
