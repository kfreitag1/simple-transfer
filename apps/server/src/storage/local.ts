import { mkdir, open, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { OffsetMismatch } from "../errors.ts";
import type { Storage } from "./storage.ts";

export function createLocalStorage(root: string): Storage {
  const pathOf = (key: string) => join(root, key);
  /** Only a missing file or directory is expected; anything else (permissions, I/O) must surface */
  const ifMissing =
    <T>(value: T) =>
    (error: NodeJS.ErrnoException): T => {
      if (error.code === "ENOENT") return value;
      throw error;
    };
  const size = (key: string) => stat(pathOf(key)).then((stats) => stats.size, ifMissing(0));

  // Per-key queue, so a size check and its write never interleave with another append
  const queues = new Map<string, Promise<unknown>>();
  const serialize = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const result = (queues.get(key) ?? Promise.resolve()).then(task);
    const tail = result.catch(() => {});
    queues.set(key, tail);
    tail.then(() => queues.get(key) === tail && queues.delete(key));
    return result;
  };

  return {
    size,

    append: (key, offset, body) =>
      serialize(key, async () => {
        const actual = await size(key);
        if (offset !== actual) throw new OffsetMismatch(actual);
        await mkdir(dirname(pathOf(key)), { recursive: true });
        const handle = await open(pathOf(key), "a");
        let written = offset;
        try {
          for await (const chunk of body) {
            await handle.write(chunk);
            written += chunk.byteLength;
          }
        } finally {
          await handle.close();
        }
        return written;
      }),

    read: (key) => Bun.file(pathOf(key)),

    async remove(prefix) {
      const slash = prefix.lastIndexOf("/");
      const dir = pathOf(prefix.slice(0, slash + 1));
      const name = prefix.slice(slash + 1);
      if (!name) return rm(dir, { recursive: true, force: true });
      const entries = await readdir(dir).catch(ifMissing<string[]>([]));
      await Promise.all(
        entries
          .filter((entry) => entry.startsWith(name))
          .map((entry) => rm(join(dir, entry), { recursive: true, force: true })),
      );
    },
  };
}
