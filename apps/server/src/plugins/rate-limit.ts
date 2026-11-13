import { Elysia } from "elysia";
import { RateLimited } from "../errors.ts";
import { CLIENT_IP_HEADER } from "../serve.ts";

export const POLICIES = {
  unlock: { limit: 10, windowSeconds: 10 * 60 },
  public: { limit: 300, windowSeconds: 60 },
  create: { limit: 60, windowSeconds: 60 * 60 },
} as const;
export type Policy = keyof typeof POLICIES;

/** `hit` returns the seconds until the window resets once the limit is exceeded */
export function createWindows() {
  const windows = new Map<string, { resetAt: number; count: number }>();
  return function hit(key: string, policy: Policy, now = Date.now()): number | undefined {
    const { limit, windowSeconds } = POLICIES[policy];
    let window = windows.get(`${policy}:${key}`);
    if (!window || now >= window.resetAt) {
      if (windows.size > 100_000) for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
      window = { resetAt: now + windowSeconds * 1000, count: 0 };
      windows.set(`${policy}:${key}`, window);
    }
    return ++window.count > limit ? Math.ceil((window.resetAt - now) / 1000) : undefined;
  };
}

/** `create` keys by the user, so it must come after `auth: true` */
export const rateLimitPlugin = () => {
  const hit = createWindows();
  return new Elysia({ name: "rate-limit" }).macro({
    rateLimit: (policy: Policy) => ({
      beforeHandle(context) {
        const { request, params } = context;
        const ip = request.headers.get(CLIENT_IP_HEADER) ?? "unknown";
        const key =
          policy === "create"
            ? (context as unknown as { user: { id: string } }).user.id
            : policy === "unlock"
              ? `${ip}:${(params as { id: string }).id}`
              : ip;
        const retryAfter = hit(key, policy);
        if (retryAfter !== undefined) throw new RateLimited(retryAfter);
      },
    }),
  });
};
