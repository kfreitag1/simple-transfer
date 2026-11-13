import { expect, test } from "bun:test";
import { parseChangelog } from "./changelog.ts";

const markdown = `# Changelog

Intro prose that is not part of any release.

## [Unreleased]

- Not released yet

## [0.2.0] - 2026-02-01

Paragraph about the release.

### Added

- Background uploads
- Update checks

### Fixed
- A bug

## [0.1.0]

### Added

- First release
`;

test("groups notes under their release, skipping unreleased work and prose", () => {
  expect(parseChangelog(markdown)).toEqual([
    {
      version: "0.2.0",
      changes: [
        { title: "Added", items: ["Background uploads", "Update checks"] },
        { title: "Fixed", items: ["A bug"] },
      ],
    },
    { version: "0.1.0", changes: [{ title: "Added", items: ["First release"] }] },
  ]);
});

test("a release without notes is left out", () => {
  expect(parseChangelog("## [0.3.0]\n\nNothing yet\n## [0.4.0]\n\n### Changed\n- Something")).toEqual([
    { version: "0.4.0", changes: [{ title: "Changed", items: ["Something"] }] },
  ]);
});
