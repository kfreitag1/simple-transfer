import { expect, test } from "bun:test";
import { checkTransfer, DEFAULT_LIMITS, resolveLimits } from "./limits.ts";

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

test("checkTransfer allows exactly each limit and rejects one byte or second over it", () => {
  const limits = { maxTransferBytes: 100, quotaBytes: 150, maxExpirySeconds: 60, defaultExpirySeconds: 60 };
  const check = (size: number, expiresIn?: number | null, usedBytes = 50) =>
    checkTransfer(
      {
        files: [
          { path: "a", size: size - 1 },
          { path: "b", size: 1 },
        ],
        expiresIn,
      },
      { limits, usedBytes },
    );
  expect(check(100, 60)).toBeUndefined();
  expect(check(101)).toBe("transfer-too-large");
  expect(check(100, undefined, 51)).toBe("quota-exceeded");
  expect(check(10, 61)).toBe("expiry-too-long");
  expect(check(10, null)).toBe("expiry-too-long");
  const unlimited = { limits: { ...limits, maxExpirySeconds: null }, usedBytes: 0 };
  expect(checkTransfer({ files: [{ path: "a", size: 1 }], expiresIn: null }, unlimited)).toBeUndefined();
});
