import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Env {
  /** Public origin. The OIDC redirect URI is `${baseUrl}/api/auth/callback/oidc` */
  baseUrl: string;
  authSecret: string;
  /**
   * Origins that may call the auth API in addition to `baseUrl`
   * Better Auth rejects a write whose `Origin` is not on the list (for dev)
   */
  trustedOrigins: string[];
  oidc: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    providerName: string | null;
  };
  port: number;
  dbPath: string;
  storageDir: string;
  webDir: string;
  /** Take the client IP from the last `X-Forwarded-For` entry. Enable only behind a reverse proxy */
  trustProxy: boolean;
}

const path = (value: string) => resolve(import.meta.dir, "../../..", value);

export function loadEnv(source: Record<string, string | undefined> = Bun.env): Env {
  // `*_FILE` may be used for any env variable
  const get = (key: string) => {
    const file = source[`${key}_FILE`];
    if (!file) return source[key];
    if (source[key]) throw new Error(`Set either ${key} or ${key}_FILE, not both`);
    return readFileSync(file, "utf8").replace(/\r?\n$/, "");
  };
  const required = (key: string) => {
    const value = get(key);
    if (!value) throw new Error(`Missing environment variable ${key}`);
    return value;
  };
  const authSecret = required("AUTH_SECRET");
  if (authSecret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return {
    baseUrl: new URL(required("BASE_URL")).origin,
    authSecret,
    trustedOrigins: (get("TRUSTED_ORIGINS") ?? "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
    oidc: {
      issuer: required("OIDC_ISSUER").replace(/\/$/, ""),
      clientId: required("OIDC_CLIENT_ID"),
      clientSecret: required("OIDC_CLIENT_SECRET"),
      scopes: (get("OIDC_SCOPES") ?? "openid profile email").split(/\s+/),
      providerName: get("OIDC_PROVIDER_NAME") || null,
    },
    port: Number(get("PORT") ?? 3000),
    dbPath: path(get("DB_PATH") ?? "data/db/app.sqlite"),
    storageDir: path(get("STORAGE_DIR") ?? "data/files"),
    webDir: path(get("WEB_DIR") ?? "apps/web/dist"),
    trustProxy: get("TRUST_PROXY") === "true",
  };
}
