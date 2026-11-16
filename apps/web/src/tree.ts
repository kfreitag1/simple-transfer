import type { TransferFile } from "@st/shared/contract";
import { packageRootOf } from "./packages.ts";

/** A package directory, shown as one file */
export interface PackageEntry {
  name: string;
  path: string;
  size: number;
}

export interface Folder {
  name: string;
  folders: Map<string, Folder>;
  packages: Map<string, PackageEntry>;
  files: TransferFile[];
}

const emptyFolder = (name: string): Folder => ({ name, folders: new Map(), packages: new Map(), files: [] });

/** The file tree as presented: package directories are leaves and their contents stay hidden */
export function buildTree(files: readonly TransferFile[]): Folder {
  const root = emptyFolder("");
  for (const file of files) {
    const path = packageRootOf(file.path) ?? file.path;
    const segments = path.split("/");
    const name = segments.pop()!;
    let folder = root;
    for (const segment of segments) {
      const child = folder.folders.get(segment) ?? emptyFolder(segment);
      folder.folders.set(segment, child);
      folder = child;
    }
    if (path === file.path) folder.files.push(file);
    else {
      const entry = folder.packages.get(name) ?? { name, path, size: 0 };
      entry.size += file.size;
      folder.packages.set(name, entry);
    }
  }
  return root;
}

/** One entry per loose file and per package, in the order of their first file */
export function groupByPackage(files: readonly { path: string; size: number }[]): { path: string; size: number }[] {
  const groups = new Map<string, { path: string; size: number }>();
  for (const file of files) {
    const path = packageRootOf(file.path) ?? file.path;
    const group = groups.get(path) ?? { path, size: 0 };
    group.size += file.size;
    groups.set(path, group);
  }
  return [...groups.values()];
}
