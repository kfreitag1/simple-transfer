import { expect, test } from "bun:test";
import { createTestApp } from "./harness.ts";

test("the first user to sign in is admin, later users are not, and anonymous requests are rejected", async () => {
  const { request, signIn } = createTestApp();
  const me = async (headers?: Headers) => (await request("/api/me", { headers })).json();

  expect(await me((await signIn()).headers)).toMatchObject({ role: "admin" });
  expect(await me((await signIn()).headers)).toMatchObject({ role: "user" });
  expect(await me()).toMatchObject({ code: "unauthorized", status: 401 });
});
