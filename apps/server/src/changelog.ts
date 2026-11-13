import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ChangeGroup } from "@st/shared/contract";

export type Release = { version: string; changes: ChangeGroup[] };

const VERSION_HEADING = /^##\s+\[?([0-9]+\.[0-9]+\.[0-9]+[^\]]*?)\]?(?:\s|$)/;
const GROUP_HEADING = /^###\s+(.+?)\s*$/;
const ITEM = /^[-*]\s+(.+?)\s*$/;

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let group: ChangeGroup | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const version = VERSION_HEADING.exec(line);
    if (version) {
      release = { version: version[1]!, changes: [] };
      releases.push(release);
      group = undefined;
      continue;
    }
    if (/^##\s/.test(line)) {
      release = undefined;
      continue;
    }
    const heading = GROUP_HEADING.exec(line);
    if (heading && release) {
      group = { title: heading[1]!, items: [] };
      release.changes.push(group);
      continue;
    }
    const item = ITEM.exec(line);
    if (item && group) group.items.push(item[1]!);
  }
  return releases.filter((entry) => entry.changes.length > 0);
}

export const readChangelog = (): Release[] =>
  parseChangelog(readFileSync(resolve(import.meta.dir, "../../../CHANGELOG.md"), "utf8"));
