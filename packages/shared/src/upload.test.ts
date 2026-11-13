import { afterEach, expect, jest, test } from "bun:test";
import { CHUNK_BYTES } from "./constants.ts";
import type { Transfer } from "./contract.ts";
import { ApiError } from "./errors.ts";
import { uploadTransfer } from "./upload.ts";

afterEach(() => jest.useRealTimers());

const transferOf = (files: { path: string; size: number; offset?: number }[]): Transfer => ({
  id: "t",
  title: null,
  message: null,
  status: "uploading",
  owned: true,
  size: files.reduce((sum, file) => sum + file.size, 0),
  fileCount: files.length,
  downloads: 0,
  hasPassword: false,
  createdAt: 0,
  expiresAt: null,
  files: files.map((file) => ({ id: file.path, offset: 0, ...file })),
});
const blobsOf = (transfer: Transfer) =>
  new Map(transfer.files.map((file) => [file.path, new Blob([new Uint8Array(file.size)])]));
const json = (body: unknown, status = 200) => Response.json(body, { status });

/** A server that stores only sizes, starting from `stored`. Records `<fileId>@<offset>` per PATCH */
function fakeServer(transfer: Transfer, stored: Record<string, number> = {}) {
  const calls: string[] = [];
  const fetch = (async (input: string, init: RequestInit) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/finalize")) return json({ ...transfer, status: "ready" });
    const fileId = url.pathname.split("/").at(-1)!;
    const offset = Number(url.searchParams.get("offset"));
    calls.push(`${fileId}@${offset}`);
    const size = stored[fileId] ?? 0;
    if (offset !== size) return json({ code: "offset-mismatch", status: 409, offset: size }, 409);
    stored[fileId] = size + (init.body as Blob).size;
    return json({ offset: stored[fileId] });
  }) as typeof globalThis.fetch;
  return { fetch, calls, stored };
}

/** Runs `promise` to completion under fake timers, firing each pending timer once microtasks settle */
async function drive<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  while (!settled) {
    for (let i = 0; i < 50; i++) await Promise.resolve();
    jest.advanceTimersToNextTimer();
  }
  return promise;
}

test("starts each file at its offset, skips complete ones and follows the server's offset on a mismatch", async () => {
  const transfer = transferOf([
    { path: "resumed", size: 2 * CHUNK_BYTES + 1, offset: CHUNK_BYTES },
    { path: "lost-response", size: CHUNK_BYTES + 1 },
    { path: "done", size: 5, offset: 5 },
  ]);
  const server = fakeServer(transfer, { resumed: CHUNK_BYTES, "lost-response": CHUNK_BYTES, done: 5 });
  const progress: number[] = [];
  const result = await uploadTransfer(transfer, blobsOf(transfer), {
    fetch: server.fetch,
    onProgress: (p) => progress.push(p.uploadedBytes),
  });

  expect(result.status).toBe("ready");
  expect(server.calls.sort()).toEqual([
    "lost-response@0",
    `lost-response@${CHUNK_BYTES}`,
    `resumed@${CHUNK_BYTES}`,
    `resumed@${2 * CHUNK_BYTES}`,
  ]);
  expect(server.stored).toEqual({ resumed: 2 * CHUNK_BYTES + 1, "lost-response": CHUNK_BYTES + 1, done: 5 });
  expect(progress.at(-1)).toBe(transfer.size);
});

test("retries network errors, 5xx and 429 with backoff, and gives up after five consecutive failures", async () => {
  jest.useFakeTimers();
  const transfer = transferOf([{ path: "a", size: 1 }]);
  const server = fakeServer(transfer);
  const failures = [() => Promise.reject(new TypeError("offline")), () => json({}, 503), () => json({}, 429)];
  let calls = 0;
  const flaky = (input: string, init: RequestInit) =>
    calls++ < 4 ? failures[calls % 3]!() : server.fetch(input, init);
  expect((await drive(uploadTransfer(transfer, blobsOf(transfer), { fetch: flaky as typeof fetch }))).status).toBe(
    "ready",
  );

  calls = 0;
  const down = (() => {
    calls++;
    return Promise.reject(new TypeError("offline"));
  }) as unknown as typeof globalThis.fetch;
  const error = await drive(uploadTransfer(transfer, blobsOf(transfer), { fetch: down })).catch((e) => e);
  expect(error.message).toBe("offline");
  expect(calls).toBe(5);
});

test("other client errors reject at once with the problem", async () => {
  const transfer = transferOf([{ path: "a", size: 1 }]);
  let calls = 0;
  const fetch = (async () => {
    calls++;
    return json({ code: "not-found", status: 404 }, 404);
  }) as unknown as typeof globalThis.fetch;
  const error = await uploadTransfer(transfer, blobsOf(transfer), { fetch }).catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.problem.code).toBe("not-found");
  expect(calls).toBe(1);
});

test("aborting rejects with the abort reason, also while waiting to retry", async () => {
  jest.useFakeTimers();
  const transfer = transferOf([{ path: "a", size: 1 }]);
  const controller = new AbortController();
  let calls = 0;
  const fetch = (() => {
    calls++;
    return Promise.reject(new TypeError("offline"));
  }) as unknown as typeof globalThis.fetch;
  const upload = uploadTransfer(transfer, blobsOf(transfer), { fetch, signal: controller.signal }).catch((e) => e);
  for (let i = 0; i < 50; i++) await Promise.resolve();
  controller.abort("aborted");
  expect(await upload).toBe("aborted");
  expect(calls).toBe(1);
});

test("a missing or wrongly sized blob throws before any request", async () => {
  const transfer = transferOf([{ path: "a", size: 2 }]);
  const fetch = (() => {
    throw new Error("requested");
  }) as unknown as typeof globalThis.fetch;
  await expect(uploadTransfer(transfer, new Map([["a", new Blob(["x"])]]), { fetch })).rejects.toThrow("No blob");
  await expect(uploadTransfer(transfer, new Map(), { fetch })).rejects.toThrow("No blob");
});
