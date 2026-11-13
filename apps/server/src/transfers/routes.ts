import { UNLOCK_TTL_SECONDS } from "@st/shared/constants";
import { ChunkQuery, TransferCreate, transferPath, Unlock } from "@st/shared/contract";
import { Elysia } from "elysia";
import type { Context } from "../app.ts";
import { authPlugin } from "../plugins/auth.ts";
import { rateLimitPlugin } from "../plugins/rate-limit.ts";
import {
  appendChunk,
  createTransfer,
  downloadFile,
  downloadTransferZip,
  finalizeTransfer,
  listTransfers,
  removeTransfer,
  toTransfer,
  unlockTransfer,
  viewTransfer,
} from "./service.ts";

export const transferRoutes = (ctx: Context) =>
  new Elysia({ prefix: "/transfers" })
    .use(authPlugin(ctx.auth))
    .use(rateLimitPlugin())
    .post("/", { auth: true, rateLimit: "create", body: TransferCreate }, ({ user, body }) =>
      createTransfer(ctx, user, body),
    )
    .get("/", { auth: true }, ({ user }) => listTransfers(ctx, user.id))
    .get("/:id", { viewer: true, rateLimit: "public" }, ({ viewer, params, cookie }) =>
      toTransfer(ctx, viewTransfer(ctx, params.id, viewer, cookie.unlock?.value), viewer),
    )
    .delete("/:id", { viewer: true }, async ({ viewer, params, set }) => {
      await removeTransfer(ctx, viewer, params.id);
      set.status = 204;
    })
    .patch("/:id/files/:fileId", { auth: true, parse: "none", query: ChunkQuery }, ({ user, params, query, request }) =>
      appendChunk(ctx, user, params.id, params.fileId, query.offset, request.body),
    )
    .post("/:id/finalize", { auth: true }, ({ user, params }) => finalizeTransfer(ctx, user, params.id))
    .post("/:id/unlock", { rateLimit: "unlock", body: Unlock }, async ({ params, body, cookie, set }) => {
      await unlockTransfer(ctx, params.id, body.password);
      cookie.unlock!.set({
        value: params.id,
        path: transferPath(params.id),
        maxAge: UNLOCK_TTL_SECONDS,
        httpOnly: true,
        sameSite: "lax",
        secure: ctx.env.baseUrl.startsWith("https:"),
      });
      set.status = 204;
    })
    .get("/:id/files/:fileId", { viewer: true, rateLimit: "public" }, ({ viewer, params, cookie, request, set }) => {
      const row = viewTransfer(ctx, params.id, viewer, cookie.unlock?.value);
      const { body, headers } = downloadFile(ctx, row, params.fileId, request.headers.has("range"));
      Object.assign(set.headers, headers);
      return body;
    })
    .get("/:id/zip", { viewer: true, rateLimit: "public" }, ({ viewer, params, cookie }) =>
      downloadTransferZip(ctx, viewTransfer(ctx, params.id, viewer, cookie.unlock?.value)),
    );
