import { SCENES, SUBJECTS, VERBS } from "./words.ts";

export const SHARE_ID_WORDS = 3;
export const SHARE_ID_SPACE = SCENES.length * SUBJECTS.length * VERBS.length;
export const SHARE_ID_BITS = Math.log2(SHARE_ID_SPACE);

/** Uniform integer in `[0, max)`, by rejection sampling so no value is favoured. */
export function randomBelow(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0]! >= limit);
  return value[0]! % max;
}

/**
 * A share id, e.g. `quiet-heron-drifts`. It is the share link, so it trades cryptographic
 * unguessability for being copyable and memorable; the mitigation is rate limiting plus short
 * expiries (`ARCHITECTURE.md`, "Share ids")
 *
 * Ids collide (birthday bound at `2 ** (SHARE_ID_BITS / 2)` transfers), so inserting a transfer
 * retries with a fresh id on a primary-key conflict. `random` is injectable for tests
 */
export function createShareId(random: (max: number) => number = randomBelow): string {
  const pick = (list: readonly string[]) => list[random(list.length)]!;
  return [pick(SCENES), pick(SUBJECTS), pick(VERBS)].join("-");
}
