import { expect, test } from "bun:test";
import { SHARE_ID_BITS } from "./share-id.ts";
import { SCENES, SUBJECTS, VERBS } from "./words.ts";

test("the word lists keep the id space large enough and every word usable", () => {
  const all = [...SCENES, ...SUBJECTS, ...VERBS];
  for (const word of all) expect(word).toMatch(/^[a-z]{3,12}$/);
  expect(new Set(all).size).toBe(all.length);
  expect(SHARE_ID_BITS).toBeGreaterThanOrEqual(28);
});
