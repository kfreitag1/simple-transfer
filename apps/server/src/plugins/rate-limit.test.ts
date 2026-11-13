import { expect, test } from "bun:test";
import { createWindows, POLICIES } from "./rate-limit.ts";

test("a window allows exactly its limit, reports the seconds left, and resets when it ends", () => {
  const hit = createWindows();
  const { limit, windowSeconds } = POLICIES.unlock;
  for (let i = 0; i < limit; i++) expect(hit("ip", "unlock", 1000)).toBeUndefined();
  expect(hit("ip", "unlock", 1000 + 1500)).toBe(windowSeconds - 1);
  expect(hit("other", "unlock", 1000)).toBeUndefined();
  expect(hit("ip", "public", 1000)).toBeUndefined();
  expect(hit("ip", "unlock", 1000 + windowSeconds * 1000)).toBeUndefined();
});
