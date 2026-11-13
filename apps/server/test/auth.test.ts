import { expect, test } from "bun:test";
import { createTestApp } from "./harness.ts";

test("the first user to sign in is admin, later users are not, and anonymous requests are rejected", async () => {
  const { request, signIn } = createTestApp();
  const role = async (headers: Headers) =>
    ((await (await request("/api/auth/get-session", { headers })).json()) as { user: { role: string } }).user.role;

  expect(await role((await signIn()).headers)).toBe("admin");
  expect(await role((await signIn()).headers)).toBe("user");
  expect(await (await request("/api/me")).json()).toMatchObject({ code: "unauthorized", status: 401 });
});
