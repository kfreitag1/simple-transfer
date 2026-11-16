import { expect, test } from "bun:test";
import { matchFiles, missingFiles, type NeededFile } from "./files.ts";

const picked = (path: string, size: number) => ({ path, file: new File([new Uint8Array(size)], path) });

test("needed files match by both path and size, and only the unmatched ones remain missing", () => {
  const needed: NeededFile[] = [
    { path: "notes.txt", size: 3 },
    { path: "MyApp.app/Contents/Info.plist", size: 0 },
    { path: "MyApp.app/Contents/MacOS/MyApp", size: 5 },
  ];
  const matched = matchFiles(needed, [
    picked("notes.txt", 3),
    picked("notes.txt", 4), // same path, wrong size
    picked("MyApp.app/Contents/Info.plist", 0),
    picked("extra.bin", 1),
  ]);

  expect([...matched.keys()]).toEqual(["notes.txt", "MyApp.app/Contents/Info.plist"]);
  expect(missingFiles(needed, matched)).toEqual([{ path: "MyApp.app/Contents/MacOS/MyApp", size: 5 }]);
});

test("nothing chosen means everything is still missing", () => {
  const needed: NeededFile[] = [{ path: "a", size: 0 }];
  expect(missingFiles(needed, matchFiles(needed, []))).toEqual(needed);
});
