import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHUNK_BYTES } from "@st/shared/constants";
import type { TestHelpers } from "better-auth/plugins";
import { type Context, createApp, createContext } from "../src/app.ts";
import { loadEnv } from "../src/env.ts";
import { serve } from "../src/serve.ts";

/** A fresh app on an in-memory database and a temporary storage directory */
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
    storageDir: mkdtempSync(join(tmpdir(), "st-test-")),
  };
  const ctx: Context = createContext(env, { test: true });
  const app = createApp(ctx);
  let users = 0;
  const request = (path: string, init?: RequestInit) => app.handle(new Request(new URL(path, env.baseUrl).href, init));

  return {
    ctx,
    request,
    /** Real HTTP, for what `app.handle` cannot show: headers on the wire */
    async listen() {
      const server = serve((r) => app.handle(r), { port: 0, trustProxy: false, maxBodyBytes: CHUNK_BYTES + 1024 });
      await new Promise((resolve) => server.once("listening", resolve));
      return { url: `http://localhost:${(server.address() as AddressInfo).port}`, close: () => server.close() };
    },
    /** A `fetch` for `uploadTransfer` that sends `headers` on every request */
    fetchAs: (headers: Headers) =>
      (async (path: string, init: RequestInit = {}) => {
        const merged = new Headers(init.headers);
        for (const [name, value] of headers) merged.set(name, value);
        // Bun 1.3 streams a sliced Blob past the end of the slice; browsers do not
        const body = init.body instanceof Blob ? await init.body.arrayBuffer() : init.body;
        return request(path, { ...init, headers: merged, body });
      }) as typeof fetch,
    /** Creates a user the way a first OIDC sign-in does. `headers` carry their session */
    async signIn() {
      const { test } = (await ctx.auth.$context) as unknown as { test: TestHelpers };
      const n = ++users;
      const user = await test.saveUser(test.createUser({ name: `User ${n}`, email: `user${n}@example.com` }));
      return { user, headers: await test.getAuthHeaders({ userId: user.id }) };
    },
  };
}
