import { resolve } from "node:path";

export interface Env {
  /** Public origin, no trailing slash. The OIDC redirect URI is `${baseUrl}/api/auth/callback/oidc`. */
  baseUrl: string;
  /** Signs sessions and unlock cookies. */
  authSecret: string;
  oidc: { issuer: string; clientId: string; clientSecret: string; scopes: string[] };
  port: number;
  /** SQLite file. May live on a different disk than `storageDir`. */
  dbPath: string;
  /** Root of the local storage adapter. */
  storageDir: string;
  /** Built web app served for non-API paths. */
  webDir: string;
  /** Take the client IP from the last `X-Forwarded-For` entry. Enable only behind a reverse proxy. */
  trustProxy: boolean;
}

/** Relative paths resolve against the repository root, whatever the working directory. */
const path = (value: string) => resolve(import.meta.dir, "../../..", value);

/** Parses and validates configuration. The only place that reads environment variables. */
export function loadEnv(source: Record<string, string | undefined> = Bun.env): Env {
  const required = (key: string) => {
    const value = source[key];
    if (!value) throw new Error(`Missing environment variable ${key}`);
    return value;
  };
  const authSecret = required("AUTH_SECRET");
  if (authSecret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return {
    baseUrl: new URL(required("BASE_URL")).origin,
    authSecret,
    oidc: {
      issuer: required("OIDC_ISSUER").replace(/\/$/, ""),
      clientId: required("OIDC_CLIENT_ID"),
      clientSecret: required("OIDC_CLIENT_SECRET"),
      scopes: (source.OIDC_SCOPES ?? "openid profile email").split(/\s+/),
    },
    port: Number(source.PORT ?? 3000),
    dbPath: path(source.DB_PATH ?? "data/db/app.sqlite"),
    storageDir: path(source.STORAGE_DIR ?? "data/files"),
    webDir: path(source.WEB_DIR ?? "apps/web/dist"),
    trustProxy: source.TRUST_PROXY === "true",
  };
}
