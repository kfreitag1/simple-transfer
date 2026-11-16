import { expect, test } from "bun:test";
import { displayFileCount, displayName, packageIcon, packageRootOf } from "./packages.ts";

test("package roots are the outermost known package directory, never a file", () => {
  expect(packageRootOf("MyApp.app/Contents/MacOS/MyApp")).toBe("MyApp.app");
  expect(packageRootOf("Projects/MyApp.app/Contents/Info.plist")).toBe("Projects/MyApp.app");
  expect(packageRootOf("Outer.bundle/Inner.app/Contents/Info.plist")).toBe("Outer.bundle");
  expect(packageRootOf("Foo.APP/Contents/Info.plist")).toBe("Foo.APP");
  expect(packageRootOf("notes.app")).toBeUndefined();
  expect(packageRootOf("notes/README.txt")).toBeUndefined();
  expect(packageRootOf("Alcove.app.zip/Contents/Info.plist")).toBeUndefined();
  expect(packageRootOf(".app/Contents/Info.plist")).toBeUndefined();
  expect(packageIcon("MyApp.app.txt")).toBeUndefined();
});

test("a zipped package is presented as the package it archives", () => {
  expect(displayName("Projects/Alcove.app.zip")).toBe("Alcove.app");
  expect(displayName("Projects/Archive.zip")).toBe("Archive.zip");
  expect(displayName("Projects/.app.zip")).toBe(".app.zip");
});

test("display counts treat a package as one file", () => {
  expect(
    displayFileCount([
      { path: "MyApp.app/Contents/Info.plist" },
      { path: "MyApp.app/Contents/MacOS/MyApp" },
      { path: "notes.txt" },
      { path: "foo.app" },
    ]),
  ).toBe(3);
});
