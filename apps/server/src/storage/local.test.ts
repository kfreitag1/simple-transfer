import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "./local.ts";
import { storageContract } from "./storage.contract.ts";

storageContract("local", async () => createLocalStorage(await mkdtemp(join(tmpdir(), "st-storage-"))));
