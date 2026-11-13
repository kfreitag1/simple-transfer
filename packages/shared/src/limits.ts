import { type Static, Type } from "typebox";
import type { Me, TransferCreate } from "./contract.ts";
import type { ErrorCode } from "./errors.ts";

const Limit = Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]);

/** Effective limits of one user. `null` always means unlimited */
export const Limits = Type.Object({
  /** Sum of file sizes in a single transfer */
  maxTransferBytes: Limit,
  /** Sum of `size` over all of the user's existing transfers, uploading or ready */
  quotaBytes: Limit,
  /** Longest allowed lifetime. `null` allows transfers that never expire */
  maxExpirySeconds: Limit,
  /** Lifetime used when a transfer does not specify one. `null` is never. Clamped to `maxExpirySeconds` */
  defaultExpirySeconds: Limit,
});
export type Limits = Static<typeof Limits>;

export const LimitScope = Type.Union([Type.Literal("global"), Type.Literal("role"), Type.Literal("user")]);
export type LimitScope = Static<typeof LimitScope>;

/**
 * Stored limits: the `global` row applies to everyone, `role` and `user` rows override it (user wins)
 * An absent key inherits; `null` sets unlimited
 */
export const LimitOverride = Type.Object({
  scope: LimitScope,
  /** `""` for global, a role for `role`, a user id for `user` */
  subject: Type.String(),
  values: Type.Partial(Limits),
});
export type LimitOverride = Static<typeof LimitOverride>;

/** What applies where nothing is stored: no limits, and transfers never expire */
export const DEFAULT_LIMITS: Limits = {
  maxTransferBytes: null,
  quotaBytes: null,
  maxExpirySeconds: null,
  defaultExpirySeconds: null,
};

/** Merges stored limits over `DEFAULT_LIMITS`, most specific last (global, role, user), then clamps the default expiry to the max */
export function resolveLimits(...layers: (Partial<Limits> | undefined)[]): Limits {
  const limits: Limits = Object.assign({}, DEFAULT_LIMITS, ...layers);
  const { maxExpirySeconds: max, defaultExpirySeconds: def } = limits;
  if (max !== null && (def === null || def > max)) limits.defaultExpirySeconds = max;
  return limits;
}

export function checkTransfer(
  input: TransferCreate,
  me: Me,
): Extract<ErrorCode, "transfer-too-large" | "quota-exceeded" | "expiry-too-long"> | undefined {
  const { maxTransferBytes, quotaBytes, maxExpirySeconds } = me.limits;
  const total = input.files.reduce((sum, file) => sum + file.size, 0);
  if (maxTransferBytes !== null && total > maxTransferBytes) return "transfer-too-large";
  if (quotaBytes !== null && me.usedBytes + total > quotaBytes) return "quota-exceeded";
  if (maxExpirySeconds !== null && (input.expiresIn === null || (input.expiresIn ?? 0) > maxExpirySeconds)) {
    return "expiry-too-long";
  }
  return undefined;
}
