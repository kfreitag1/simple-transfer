import { afterAll, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import { CLIENT_IP_HEADER, clientIp, serve } from "./serve.ts";

const MiB = 1024 ** 2;
const seen: Record<string, string | null> = {};
const server = serve(
  async (request) => {
    seen.ip = request.headers.get(CLIENT_IP_HEADER);
    if (request.method === "POST") {
      const size = await request.arrayBuffer().then(
        (body) => body.byteLength,
        () => -1,
      );
      return new Response(String(size));
    }
    // Several asynchronous chunks, so nothing can buffer the whole body and measure it
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await Bun.sleep(1);
        if (sent++ < 8) controller.enqueue(new Uint8Array(MiB).fill(sent));
        else controller.close();
      },
    });
    return new Response(body, { headers: { "content-length": String(8 * MiB), "set-cookie": "a=1" } });
  },
  { port: 0, trustProxy: false, maxBodyBytes: MiB },
);
await new Promise((resolve) => server.once("listening", resolve));
const url = `http://localhost:${(server.address() as AddressInfo).port}/`;
afterAll(() => server.close());

test("a streamed response keeps its Content-Length, so downloads show progress", async () => {
  const response = await fetch(url);
  expect(response.headers.get("content-length")).toBe(String(8 * MiB));
  expect(response.headers.get("transfer-encoding")).toBeNull();
  expect(response.headers.getSetCookie()).toEqual(["a=1"]);
  const body = new Uint8Array(await response.arrayBuffer());
  expect(body.length).toBe(8 * MiB);
  expect([body[0], body.at(-1)]).toEqual([1, 8]);
});

test("request bodies stream through up to the limit and fail past it", async () => {
  const post = async (size: number) => (await fetch(url, { method: "POST", body: new Uint8Array(size) })).text();
  expect(await post(MiB)).toBe(String(MiB));
  expect(await post(MiB + 1)).toBe("-1");
});

test("the client address cannot be spoofed with the internal header", async () => {
  await fetch(url, { headers: { [CLIENT_IP_HEADER]: "6.6.6.6", "x-forwarded-for": "6.6.6.6" } });
  expect(seen.ip).not.toBe("6.6.6.6");
  expect(seen.ip).toBeTruthy();
});

test("X-Forwarded-For is used, last entry only, only when the proxy is trusted", () => {
  expect(clientIp("127.0.0.1", "6.6.6.6, 10.0.0.1", true)).toBe("10.0.0.1");
  expect(clientIp("127.0.0.1", "6.6.6.6, 10.0.0.1", false)).toBe("127.0.0.1");
  expect(clientIp(undefined, null, true)).toBe("unknown");
});
