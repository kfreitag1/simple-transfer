import { type Static, Type } from "typebox";

const Limit = Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]);

/** Effective limits of one user. `null` always means unlimited. */
export const Limits = Type.Object({
  /** Sum of file sizes in a single transfer. */
  maxTransferBytes: Limit,
  /** Sum of `size` over all of the user's existing transfers, uploading or ready. */
  quotaBytes: Limit,
  /** Longest allowed lifetime. `null` allows transfers that never expire. */
  maxExpirySeconds: Limit,
  /** Lifetime used when a transfer does not specify one. `null` is never. Clamped to `maxExpirySeconds`. */
  defaultExpirySeconds: Limit,
});
export type Limits = Static<typeof Limits>;

export const LimitScope = Type.Union([Type.Literal("global"), Type.Literal("role"), Type.Literal("user")]);
export type LimitScope = Static<typeof LimitScope>;

/** A stored layer of limits. An absent key inherits from the layer below; `null` sets unlimited. */
export const LimitOverride = Type.Object({
  scope: LimitScope,
  /** `""` for global, a role for `role`, a user id for `user`. */
  subject: Type.String(),
  values: Type.Partial(Limits),
});
export type LimitOverride = Static<typeof LimitOverride>;

const GiB = 1024 ** 3;
const DAY = 24 * 60 * 60;

/** Built-in base layer, used until an admin stores a `global` override. */
export const DEFAULT_LIMITS: Limits = {
  maxTransferBytes: 5 * GiB,
  quotaBytes: 50 * GiB,
  maxExpirySeconds: 30 * DAY,
  defaultExpirySeconds: 7 * DAY,
};

/** Merges layers over `DEFAULT_LIMITS`, most specific last (global, role, user), then clamps the default expiry to the max. */
export function resolveLimits(...layers: (Partial<Limits> | undefined)[]): Limits {
  const limits: Limits = Object.assign({}, DEFAULT_LIMITS, ...layers);
  const { maxExpirySeconds: max, defaultExpirySeconds: def } = limits;
  if (max !== null && (def === null || def > max)) limits.defaultExpirySeconds = max;
  return limits;
}
