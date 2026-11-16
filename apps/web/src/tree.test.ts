import { expect, test } from "bun:test";
import type { TransferFile } from "@st/shared/contract";
import { buildTree, groupByPackage } from "./tree.ts";

const file = (path: string, size = 1): TransferFile => ({ id: path, path, size, offset: size });

test("the tree collapses a package to one leaf wherever it is", () => {
  const tree = buildTree([
    file("MyApp.app/Contents/Info.plist", 2),
    file("MyApp.app/Contents/MacOS/MyApp", 3),
    file("Projects/Other.app/Contents/Info.plist", 5),
    file("notes.txt", 7),
    file("foo.app", 11),
  ]);

  expect(tree.packages.get("MyApp.app")).toEqual({ name: "MyApp.app", path: "MyApp.app", size: 5 });
  expect(tree.files.map((entry) => entry.path)).toEqual(["notes.txt", "foo.app"]);
  expect(tree.folders.get("Projects")!.packages.get("Other.app")).toEqual({
    name: "Other.app",
    path: "Projects/Other.app",
    size: 5,
  });
});

test("grouping makes every package one entry and sums only the files in it", () => {
  expect(groupByPackage([file("MyApp.app/a", 2), file("MyApp.app/b", 3), file("notes.txt", 4)])).toEqual([
    { path: "MyApp.app", size: 5 },
    { path: "notes.txt", size: 4 },
  ]);
});
