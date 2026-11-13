import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, genericOAuth, testUtils } from "better-auth/plugins";
import type { Db } from "./db/index.ts";
import * as schema from "./db/schema.ts";
import type { Env } from "./env.ts";
import { CLIENT_IP_HEADER } from "./serve.ts";

export type Auth = ReturnType<typeof createAuth>;
export type User = Auth["$Infer"]["Session"]["user"];

/**
 * OIDC is the only way in. The first user to sign in becomes admin; everyone after is a `user`.
 * With `test`, OIDC is replaced by Better Auth's test utilities (see `test/harness.ts`).
 */
export function createAuth(env: Env, db: Db, options: { test?: boolean } = {}) {
  return betterAuth({
    baseURL: env.baseUrl,
    secret: env.authSecret,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    rateLimit: { enabled: !options.test },
    advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
    plugins: [
      admin(),
      options.test
        ? testUtils()
        : genericOAuth({
            config: [
              {
                providerId: "oidc",
                discoveryUrl: `${env.oidc.issuer}/.well-known/openid-configuration`,
                clientId: env.oidc.clientId,
                clientSecret: env.oidc.clientSecret,
                scopes: env.oidc.scopes,
                pkce: true,
              },
            ],
          }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, role: (await db.$count(schema.user)) === 0 ? "admin" : "user" },
          }),
        },
      },
    },
  });
}
