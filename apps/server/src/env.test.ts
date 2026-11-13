import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "./env.ts";

const base = {
  BASE_URL: "http://localhost",
  AUTH_SECRET: "test-secret-test-secret-test-secret",
  OIDC_ISSUER: "http://idp.invalid",
  OIDC_CLIENT_ID: "test",
};

test("any variable can be read from <NAME>_FILE without its trailing newline, but not set both ways", () => {
  const dir = mkdtempSync(join(tmpdir(), "st-env-"));
  writeFileSync(join(dir, "secret"), "s3cret\n");
  writeFileSync(join(dir, "port"), "4000");
  const env = loadEnv({ ...base, OIDC_CLIENT_SECRET_FILE: join(dir, "secret"), PORT_FILE: join(dir, "port") });
  expect(env.oidc.clientSecret).toBe("s3cret");
  expect(env.port).toBe(4000);
  expect(() => loadEnv({ ...base, OIDC_CLIENT_SECRET: "x", OIDC_CLIENT_SECRET_FILE: join(dir, "secret") })).toThrow(
    "not both",
  );
});

test("origin-checked auth calls may come from origins other than the base URL", () => {
  const complete = { ...base, OIDC_CLIENT_SECRET: "secret" };
  const env = loadEnv({ ...complete, TRUSTED_ORIGINS: "http://localhost:5173, https://app.example/some/path" });
  expect(env.trustedOrigins).toEqual(["http://localhost:5173", "https://app.example"]);
  expect(loadEnv(complete).trustedOrigins).toEqual([]);
  expect(() => loadEnv({ ...complete, TRUSTED_ORIGINS: "nothing useful" })).toThrow();
});
