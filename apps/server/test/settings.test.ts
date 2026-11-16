import { expect, test } from "bun:test";
import { createTestApp } from "./harness.ts";

test("only an admin can save branding, and config exposes both accent sides", async () => {
  const { request, signIn } = createTestApp();
  const admin = await signIn();
  const member = await signIn();
  const settings = {
    branding: { name: "Files", accent: { light: "#112233", dark: null }, logo: null },
    updateCheck: false,
  };
  const put = (headers: Headers) =>
    request("/api/admin/settings", {
      method: "PUT",
      headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
      body: JSON.stringify(settings),
    });

  expect((await put(member.headers)).status).toBe(403);
  expect((await put(admin.headers)).status).toBe(204);

  const config = (await (await request("/api/config")).json()) as { settings: typeof settings };
  expect(config.settings).toEqual(settings);
});
