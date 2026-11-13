import { expect, test } from "bun:test";
import { MAX_PATH_LENGTH } from "./constants.ts";
import { normalizePath } from "./paths.ts";

test("paths that could escape the transfer or confuse a file system are rejected", () => {
  for (const path of ["", "/etc/passwd", "a//b", "a/", "./a", "a/../b", "..", "a\\b", "a\u0000b", "a\nb", "a\u007fb"]) {
    expect(normalizePath(path)).toBeUndefined();
  }
  expect(normalizePath("a".repeat(MAX_PATH_LENGTH + 1))).toBeUndefined();
});

test("nested relative paths are kept, in NFC", () => {
  expect(normalizePath("photos/2024/..beach.jpg")).toBe("photos/2024/..beach.jpg");
  expect(normalizePath("cafe\u0301.txt")).toBe("caf\u00e9.txt");
});
