import { createServer, type Server } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Elysia } from "elysia";
import { ChunkTooLarge } from "./errors.ts";

/** Always overwritten by `serve`, so it can be trusted */
export const CLIENT_IP_HEADER = "x-client-ip";

export function clientIp(remoteAddress: string | undefined, forwardedFor: string | null, trustProxy: boolean): string {
  const forwarded = trustProxy ? forwardedFor?.split(",").at(-1)?.trim() : undefined;
  return forwarded || remoteAddress || "unknown";
}

export interface ServeOptions {
  port: number;
  trustProxy: boolean;
  maxBodyBytes: number;
}

/** `Bun.serve` drops `Content-Length` on streamed responses
 *  TODO(oven-sh/bun#10507): see "HTTP edge" in ARCHITECTURE.md
 **/
export function serve(handle: (request: Request) => Promise<Response>, options: ServeOptions): Server {
  return createServer(async (req, res) => {
    const aborted = new AbortController();
    res.on("close", () => res.writableFinished || aborted.abort());
    try {
      const headers = new Headers();
      for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i]!, req.rawHeaders[i + 1]!);
      headers.set(
        CLIENT_IP_HEADER,
        clientIp(req.socket.remoteAddress, headers.get("x-forwarded-for"), options.trustProxy),
      );
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const response = await handle(
        new Request(new URL(req.url ?? "/", `http://${headers.get("host") ?? "localhost"}`).href, {
          method: req.method,
          headers,
          body: hasBody
            ? limitBytes(Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>, options.maxBodyBytes)
            : undefined,
          signal: aborted.signal,
        }),
      );

      const head: Record<string, string | string[]> = {};
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") head[name] = value;
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) head["set-cookie"] = cookies;
      res.writeHead(response.status, head);
      const length = response.headers.get("content-length");
      if (!response.body || req.method === "HEAD") res.end();
      else {
        const body = length === null ? response.body : takeBytes(response.body, Number(length));
        await pipeline(Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>), res);
      }
    } catch (error) {
      if (aborted.signal.aborted) return;
      console.error("request failed", error);
      if (res.headersSent) res.destroy();
      else res.writeHead(500).end();
    }
  }).listen(options.port);
}

/** `serve` only sees a stream, so a `Blob`'s size is stated here. Elysia already does it for Range responses */
export const blobLength = () =>
  new Elysia({ name: "blob-length" }).onAfterHandle("global", ({ responseValue, request, set }) => {
    if (responseValue instanceof Blob && !request.headers.has("range")) {
      set.headers["content-length"] = String(responseValue.size);
    }
  });

/** Bun streams a sliced file `Blob` to the end of the file; bytes past `Content-Length` would corrupt keep-alive */
function takeBytes(body: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
  let remaining = length;
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk.byteLength <= remaining ? chunk : chunk.subarray(0, remaining));
        remaining -= Math.min(chunk.byteLength, remaining);
        if (remaining === 0) controller.terminate();
      },
    }),
  );
}

export function limitBytes(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let remaining = maxBytes;
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        remaining -= chunk.byteLength;
        if (remaining < 0) throw new ChunkTooLarge();
        controller.enqueue(chunk);
      },
    }),
  );
}
