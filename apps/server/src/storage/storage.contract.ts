import { describe, expect, test } from "bun:test";
import { OffsetMismatch } from "../errors.ts";
import type { Storage } from "./storage.ts";

const stream = (text: string) => new Blob([text]).stream();

export function storageContract(name: string, create: () => Promise<Storage>) {
  describe(`${name} storage`, () => {
    test("appends accumulate, and an append at any offset but the current size fails with that size", async () => {
      const storage = await create();
      expect(await storage.size("t/f")).toBe(0);
      expect(await storage.append("t/f", 0, stream("hello "))).toBe(6);
      const error = await storage.append("t/f", 3, stream("x")).catch((e) => e);
      expect(error).toBeInstanceOf(OffsetMismatch);
      expect(error.offset).toBe(6);
      expect(await storage.append("t/f", 6, stream("world"))).toBe(11);
      expect(await storage.read("t/f").text()).toBe("hello world");
    });

    test("concurrent appends at the same offset: exactly one wins", async () => {
      const storage = await create();
      const results = await Promise.allSettled([
        storage.append("t/f", 0, stream("aaaa")),
        storage.append("t/f", 0, stream("bbbb")),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await storage.size("t/f")).toBe(4);
    });

    test("remove deletes the keys under a prefix and nothing else", async () => {
      const storage = await create();
      for (const key of ["a/1", "a/2", "ab/1", "b/1"]) await storage.append(key, 0, stream("x"));
      await storage.remove("a/");
      await storage.remove("missing/");
      expect(await Promise.all(["a/1", "a/2", "ab/1", "b/1"].map((key) => storage.size(key)))).toEqual([0, 0, 1, 1]);
    });
  });
}
