/** A file to be chosen again, identified the only way the browser can: by path and size */
export type NeededFile = { path: string; size: number };

const keyOf = (path: string, size: number) => `${path}\0${size}`;

/** The picked files that match `needed` by path and size. Files are keyed by path */
export function matchFiles(
  needed: readonly NeededFile[],
  picked: readonly { path: string; file: File }[],
): Map<string, File> {
  const byKey = new Map(picked.map((entry) => [keyOf(entry.path, entry.file.size), entry.file]));
  const matched = new Map<string, File>();
  for (const file of needed) {
    const blob = byKey.get(keyOf(file.path, file.size));
    if (blob) matched.set(file.path, blob);
  }
  return matched;
}

export const missingFiles = (needed: readonly NeededFile[], matched: ReadonlyMap<string, File>): NeededFile[] =>
  needed.filter((file) => !matched.has(file.path));
