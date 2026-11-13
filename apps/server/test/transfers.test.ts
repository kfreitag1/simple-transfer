import { expect, test } from "bun:test";
import { CHUNK_BYTES } from "@st/shared/constants";
import type { Transfer, TransferCreate } from "@st/shared/contract";
import { uploadTransfer } from "@st/shared/upload";
import { downloadZip } from "client-zip";
import { eq } from "drizzle-orm";
import { transfer as transferTable } from "../src/db/schema.ts";
import { sweep } from "../src/sweeper.ts";
import { createTestApp } from "./harness.ts";

/** Deterministic pseudo-random bytes, so a misplaced chunk cannot go unnoticed */
function bytes(size: number, seed = 1): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

// biome-ignore lint/suspicious/noExplicitAny: tests know the shape of each response
const body = async <T = any>(res: Response | Promise<Response>): Promise<T> => (await res).json() as Promise<T>;

const json = (value: unknown, headers?: Headers, method = "POST") => {
  const merged = new Headers(headers);
  merged.set("content-type", "application/json");
  return { method, headers: merged, body: JSON.stringify(value) };
};

async function setup() {
  const app = createTestApp();
  const owner = await app.signIn();
  const create = async (input: TransferCreate, headers = owner.headers) =>
    app.request("/api/transfers", json(input, headers));
  const send = async (files: Record<string, Uint8Array>, extra: Partial<TransferCreate> = {}) => {
    const entries = Object.entries(files).map(([path, data]) => ({ path, size: data.length }));
    const created: Transfer = await body(create({ files: entries, ...extra }));
    const blobs = new Map(Object.entries(files).map(([path, data]) => [path, new Blob([data])]));
    return { created, blobs, ready: await uploadTransfer(created, blobs, { fetch: app.fetchAs(owner.headers) }) };
  };
  return { ...app, owner, create, send };
}

test("an uploaded transfer downloads over HTTP byte for byte and with its length, as files, ranges and a zip", async () => {
  const { request, send, listen } = await setup();
  const files = { "big.bin": bytes(CHUNK_BYTES + 123), "folder/small.txt": bytes(10, 2), "folder/empty": bytes(0) };
  const { ready } = await send(files, { title: "Holiday" });
  expect(ready.status).toBe("ready");
  const server = await listen();
  const get = (path: string, init?: RequestInit) => fetch(`${server.url}/api/transfers/${ready.id}${path}`, init);
  const fileUrl = (path: string) => `/files/${ready.files.find((f) => f.path === path)!.id}`;

  try {
    const big = await get(fileUrl("big.bin"));
    expect(big.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''big.bin");
    expect(big.headers.get("x-content-type-options")).toBe("nosniff");
    expect(big.headers.get("content-length")).toBe(String(files["big.bin"].length));
    expect(new Uint8Array(await big.arrayBuffer())).toEqual(files["big.bin"]);
    expect((await (await get(fileUrl("folder/empty"))).arrayBuffer()).byteLength).toBe(0);
    const range = await get(fileUrl("big.bin"), { headers: { range: "bytes=100-199" } });
    expect(range.status).toBe(206);
    expect(range.headers.get("content-length")).toBe("100");
    expect(new Uint8Array(await range.arrayBuffer())).toEqual(files["big.bin"].slice(100, 200));

    const zip = await get("/zip");
    expect(zip.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''Holiday.zip");
    const archive = new Uint8Array(await zip.arrayBuffer());
    expect(zip.headers.get("content-length")).toBe(String(archive.length));
    const lastModified = new Date(ready.createdAt);
    const expected = downloadZip(
      ready.files.map((f) => ({ name: f.path, lastModified, input: files[f.path as keyof typeof files] })),
    );
    expect(archive).toEqual(new Uint8Array(await expected.arrayBuffer()));
  } finally {
    server.close();
  }

  const after: Transfer = await body(request(`/api/transfers/${ready.id}`));
  expect(after.downloads).toBe(3);
});

test("an interrupted upload resumes from the stored offsets and yields identical bytes", async () => {
  const { request, create, owner, fetchAs } = await setup();
  const data = bytes(2 * CHUNK_BYTES + 5);
  const created: Transfer = await body(create({ files: [{ path: "a", size: data.length }] }));
  const blobs = new Map([["a", new Blob([data])]]);
  const controller = new AbortController();
  const interrupted = await uploadTransfer(created, blobs, {
    fetch: fetchAs(owner.headers),
    signal: controller.signal,
    onProgress: (p) => p.uploadedBytes > 0 && controller.abort("interrupted"),
  }).catch((e) => e);
  expect(interrupted).toBe("interrupted");

  const resumed: Transfer = await body(request(`/api/transfers/${created.id}`, { headers: owner.headers }));
  expect(resumed.files[0]!.offset).toBe(CHUNK_BYTES);
  await uploadTransfer(resumed, blobs, { fetch: fetchAs(owner.headers) });
  const download = await request(`/api/transfers/${created.id}/files/${created.files[0]!.id}`);
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(data);
});

test("global limits and overrides set by an admin are enforced at creation, and deleting a transfer frees its quota", async () => {
  const { request, create, signIn, owner } = await setup();
  const member = await signIn();
  const MB = 1_000_000;
  const put = (values: object, scope = "global", subject = "") =>
    request("/api/admin/limits", json({ scope, subject, values }, owner.headers, "PUT"));
  expect(
    (await request("/api/admin/limits", json({ scope: "global", subject: "", values: {} }, member.headers, "PUT")))
      .status,
  ).toBe(403);
  await put({ quotaBytes: 10 * MB, maxTransferBytes: 1 * MB });
  await put({ maxTransferBytes: 6 * MB, maxExpirySeconds: 3600 }, "role", "user");
  await put({ quotaBytes: 8 * MB }, "user", member.user.id);
  await put({ maxTransferBytes: 1 }, "user", "someone-else");
  await put({}, "user", "someone-else");
  expect(await body(request("/api/admin/limits", { headers: owner.headers }))).toHaveLength(3);
  const code = async (size: number, extra: Partial<TransferCreate> = {}) =>
    (await body(create({ files: [{ path: "a", size }], ...extra }, member.headers))).code;

  expect(await code(6 * MB + 1)).toBe("transfer-too-large");
  expect(await code(1, { expiresIn: 3601 })).toBe("expiry-too-long");
  expect(await code(1, { expiresIn: null })).toBe("expiry-too-long");
  const first: Transfer = await body(create({ files: [{ path: "a", size: 5 * MB }] }, member.headers));
  expect(first.expiresAt! - first.createdAt).toBe(3600 * 1000);
  expect(await code(3 * MB + 1)).toBe("quota-exceeded");
  expect(await body(request("/api/me", { headers: member.headers }))).toMatchObject({ usedBytes: 5 * MB });

  await request(`/api/transfers/${first.id}`, { method: "DELETE", headers: member.headers });
  expect(await code(6 * MB)).toBeUndefined();
});

test("invalid or duplicate paths are rejected", async () => {
  const { create } = await setup();
  const status = async (paths: string[]) => (await create({ files: paths.map((path) => ({ path, size: 1 })) })).status;
  expect(await status(["../etc/passwd"])).toBe(422);
  expect(await status(["a/b", "a/b"])).toBe(422);
});

test("a password locks a transfer for everyone but its owner until it is unlocked", async () => {
  const { request, send, owner } = await setup();
  const { ready } = await send({ "secret.txt": bytes(5) }, { password: "hunter2" });
  const url = `/api/transfers/${ready.id}`;
  const code = async (res: Promise<Response>) => (await body(res)).code;

  expect(await code(request(url))).toBe("password-required");
  expect(await code(request(`${url}/zip`))).toBe("password-required");
  expect((await request(url, { headers: owner.headers })).status).toBe(200);
  expect(await code(request(`${url}/unlock`, json({ password: "wrong" })))).toBe("password-invalid");

  const unlocked = await request(`${url}/unlock`, json({ password: "hunter2" }));
  expect(unlocked.status).toBe(204);
  const cookie = unlocked.headers.get("set-cookie")!;
  expect(cookie).toContain(`Path=${url}`);
  expect(cookie).toContain("HttpOnly");
  const headers = { cookie: cookie.split(";")[0]! };
  expect((await request(url, { headers })).status).toBe(200);
  expect((await request(`${url}/files/${ready.files[0]!.id}`, { headers })).status).toBe(200);
  expect(await code(request(url, { headers: { cookie: `unlock=${ready.id}` } }))).toBe("invalid-cookie");
});

test("expired and unfinished transfers are invisible to others and swept with their blobs", async () => {
  const { ctx, request, create, send, owner } = await setup();
  const { ready: expired } = await send({ a: bytes(5) });
  ctx.db
    .update(transferTable)
    .set({ expiresAt: new Date(Date.now() - 1) })
    .where(eq(transferTable.id, expired.id))
    .run();
  const unfinished: Transfer = await body(create({ files: [{ path: "a", size: 5 }] }));
  await request(`/api/transfers/${unfinished.id}/files/${unfinished.files[0]!.id}?offset=0`, {
    method: "PATCH",
    headers: owner.headers,
    body: bytes(2),
  });

  expect((await request(`/api/transfers/${expired.id}`, { headers: owner.headers })).status).toBe(404);
  expect((await request(`/api/transfers/${unfinished.id}`)).status).toBe(404);
  expect((await request(`/api/transfers/${unfinished.id}`, { headers: owner.headers })).status).toBe(200);

  await sweep(ctx, new Date(Date.now() + 25 * 60 * 60 * 1000));
  expect(ctx.db.select().from(transferTable).all()).toEqual([]);
  expect(await ctx.storage.size(`${expired.id}/${expired.files[0]!.id}`)).toBe(0);
  expect(await ctx.storage.size(`${unfinished.id}/${unfinished.files[0]!.id}`)).toBe(0);
});

test("a non-owner cannot append, finalize or delete, an owner cannot overrun a file, and an admin can delete", async () => {
  const { request, create, signIn, owner } = await setup();
  const author = await signIn();
  const stranger = await signIn();
  const created: Transfer = await body(create({ files: [{ path: "a", size: 1 }] }, author.headers));
  const url = `/api/transfers/${created.id}`;
  const as = (headers: Headers, method: string, path = "") => request(`${url}${path}`, { method, headers });

  expect((await as(stranger.headers, "PATCH", `/files/${created.files[0]!.id}?offset=0`)).status).toBe(404);
  expect((await as(stranger.headers, "POST", "/finalize")).status).toBe(404);
  expect((await as(stranger.headers, "DELETE")).status).toBe(404);
  expect((await as(author.headers, "POST", "/finalize")).status).toBe(409);
  const tooLarge = { method: "PATCH", headers: author.headers, body: bytes(2) };
  expect((await request(`${url}/files/${created.files[0]!.id}?offset=0`, tooLarge)).status).toBe(413);
  expect((await as(owner.headers, "DELETE")).status).toBe(204);
  expect((await as(author.headers, "GET")).status).toBe(404);
});
