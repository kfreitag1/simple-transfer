import type { TestHelpers } from "better-auth/plugins";
import { type Context, createApp, createContext } from "../src/app.ts";
import { loadEnv } from "../src/env.ts";

/** A fresh app on an in-memory database. Integration tests talk to it through `request`. */
export function createTestApp() {
  const env = {
    ...loadEnv({
      BASE_URL: "http://localhost",
      AUTH_SECRET: "test-secret-test-secret-test-secret",
      OIDC_ISSUER: "http://idp.invalid",
      OIDC_CLIENT_ID: "test",
      OIDC_CLIENT_SECRET: "test",
    }),
    dbPath: ":memory:",
  };
  const ctx: Context = createContext(env, { test: true });
  const app = createApp(ctx);
  let users = 0;

  return {
    ctx,
    /** `app.handle` with a `fetch`-like signature. */
    request: (path: string, init?: RequestInit) => app.handle(new Request(new URL(path, env.baseUrl).href, init)),
    /** Creates a user the way a first OIDC sign-in does. `headers` carry their session. */
    async signIn() {
      const { test } = (await ctx.auth.$context) as unknown as { test: TestHelpers };
      const n = ++users;
      const user = await test.saveUser(test.createUser({ name: `User ${n}`, email: `user${n}@example.com` }));
      return { user, headers: await test.getAuthHeaders({ userId: user.id }) };
    },
  };
}
