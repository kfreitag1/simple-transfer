import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Update } from "@st/shared/contract";
import type { Context } from "./app.ts";
import { getSettings } from "./settings.ts";

const RELEASES_URL = "https://api.github.com/repos/kfreitag1/simple-transfer/releases/latest";
const INTERVAL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

export const readVersion = (): string =>
  JSON.parse(readFileSync(resolve(import.meta.dir, "../../../package.json"), "utf8")).version;

/** Asks GitHub for the latest release a few times a day and remembers it in memory */
export function createUpdates(ctx: Context, version: string) {
  let latest: Update | null = null;

  async function check(): Promise<void> {
    if (!getSettings(ctx).updateCheck) return;
    try {
      const response = await fetch(RELEASES_URL, {
        headers: { accept: "application/vnd.github+json", "user-agent": `simple-transfer/${version}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return;
      const release = (await response.json()) as { tag_name: string; html_url: string };
      latest = { latest: release.tag_name.replace(/^v/, ""), url: release.html_url };
    } catch {
      // Offline or blocked: try again next interval
    }
  }

  return {
    check,
    available: (): Update | null =>
      latest && getSettings(ctx).updateCheck && Bun.semver.order(latest.latest, version) > 0 ? latest : null,
    start(): void {
      void check();
      setInterval(check, INTERVAL_MS).unref();
    },
  };
}

export type Updates = ReturnType<typeof createUpdates>;
