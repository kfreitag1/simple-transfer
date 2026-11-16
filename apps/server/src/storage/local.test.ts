import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "./local.ts";
import { storageContract } from "./storage.contract.ts";

storageContract("local", async () => createLocalStorage(await mkdtemp(join(tmpdir(), "st-storage-"))));

test("local storage health rejects a path that cannot hold blobs", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "st-storage-")), "file");
  await writeFile(root, "");
  await expect(createLocalStorage(root).health()).rejects.toThrow();
});
