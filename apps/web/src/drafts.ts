import { createContext, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import type { Picked } from "./file-drop.tsx";
import { matchFiles, type NeededFile } from "./files.ts";

const STORAGE_KEY = "draft";

/** A chosen file. Only after a reload is `file` missing, until the same file is chosen again */
type DraftFile = NeededFile & { file?: File };

interface StoredDraft {
  title: string;
  message: string;
  password: string;
  expiry: string | undefined;
  files: NeededFile[];
}

function load(): StoredDraft | undefined {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as StoredDraft | null;
    return stored?.files?.length ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The Send form, created in `Layout` above the routes so leaving the page never loses it. It exists
 * while at least one file is chosen. Text and the paths and sizes of the files survive a reload in
 * `sessionStorage`; the files themselves cannot, so after one they are `missing` until chosen again
 */
export function createDraft() {
  const stored = load();
  const [entries, setEntries] = createSignal<DraftFile[]>(stored?.files ?? []);
  const [title, setTitle] = createSignal(stored?.title ?? "");
  const [message, setMessage] = createSignal(stored?.message ?? "");
  const [password, setPassword] = createSignal(stored?.password ?? "");
  const [expiry, setExpiry] = createSignal<string | undefined>(stored?.expiry);

  const files = createMemo(() => entries().flatMap(({ path, file }) => (file ? [{ path, file }] : [])));
  const missing = createMemo(() => entries().filter((entry) => !entry.file));

  createEffect(
    (): StoredDraft | undefined =>
      entries().length === 0
        ? undefined
        : {
            title: title(),
            message: message(),
            password: password(),
            expiry: expiry(),
            files: entries().map(({ path, size }) => ({ path, size })),
          },
    (draft) => {
      try {
        if (draft) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage can be unavailable or full; the draft still lasts as long as the page
      }
    },
  );

  onSettled(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (files().length > 0) event.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  });

  const clear = () => {
    setEntries([]);
    setTitle("");
    setMessage("");
    setPassword("");
    setExpiry(undefined);
  };

  return {
    /** Every entry, chosen or still missing */
    entries,
    /** The chosen files. All of them, unless some are `missing` */
    files,
    missing,
    /** While files are missing, only those are taken, matched by path and size. Otherwise a path picked again is replaced */
    add(picked: Picked[]) {
      setEntries((list) => {
        if (list.some((entry) => !entry.file)) {
          const matched = matchFiles(list, picked);
          return list.map((entry) => ({ ...entry, file: entry.file ?? matched.get(entry.path) }));
        }
        const merged = new Map(list.map((entry) => [entry.path, entry]));
        for (const { path, file } of picked) merged.set(path, { path, size: file.size, file });
        return [...merged.values()];
      });
    },
    /** Removes a file, or a folder with everything in it. Removing the last one ends the draft, text included */
    remove(path: string) {
      const rest = entries().filter((entry) => entry.path !== path && !entry.path.startsWith(`${path}/`));
      if (rest.length === 0) clear();
      else setEntries(rest);
    },
    title,
    setTitle,
    message,
    setMessage,
    password,
    setPassword,
    expiry,
    setExpiry,
    clear,
  };
}

export type Draft = ReturnType<typeof createDraft>;

export const DraftContext = createContext<Draft>();
