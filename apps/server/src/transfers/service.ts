import { CHUNK_BYTES } from "@st/shared/constants";
import type { AdminTransfer, ChunkResult, Transfer, TransferCreate, TransferSummary } from "@st/shared/contract";
import { checkTransfer } from "@st/shared/limits";
import { normalizePath } from "@st/shared/paths";
import { downloadZip, predictLength } from "client-zip";
import { and, count, desc, eq, gt, isNull, or, type SQL, sql } from "drizzle-orm";
import { NotFound } from "elysia";
import type { Context } from "../app.ts";
import type { User } from "../auth.ts";
import { file, transfer, user } from "../db/schema.ts";
import {
  ExpiryTooLong,
  InvalidPath,
  PasswordInvalid,
  PasswordRequired,
  QuotaExceeded,
  TransferFinalized,
  TransferTooLarge,
  UploadIncomplete,
} from "../errors.ts";
import { limitsFor, usedBytes } from "../limits.ts";
import { limitBytes } from "../serve.ts";

type Row = typeof transfer.$inferSelect;
type FileRow = typeof file.$inferSelect;
type Viewer = User | undefined;

const keyOf = (transferId: string, fileId: string) => `${transferId}/${fileId}`;
const notExpired = () => or(isNull(transfer.expiresAt), gt(transfer.expiresAt, new Date()));
const canManage = (row: Row, viewer: Viewer) =>
  viewer !== undefined && (viewer.id === row.ownerId || viewer.role === "admin");

function toSummary(row: Row, fileCount: number): TransferSummary {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    status: row.status,
    size: row.size,
    fileCount,
    downloads: row.downloads,
    hasPassword: row.passwordHash !== null,
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt?.getTime() ?? null,
  };
}

export async function toTransfer(ctx: Context, row: Row, viewer: Viewer): Promise<Transfer> {
  const files = filesOf(ctx, row.id);
  return {
    ...toSummary(row, files.length),
    owned: viewer?.id === row.ownerId,
    files: await Promise.all(
      files.map(async ({ id, path, size }) => ({
        id,
        path,
        size,
        offset: row.status === "ready" ? size : await ctx.storage.size(keyOf(row.id, id)),
      })),
    ),
  };
}

const filesOf = (ctx: Context, transferId: string) =>
  ctx.db.select().from(file).where(eq(file.transferId, transferId)).orderBy(file.path).all();

function visibleTransfer(ctx: Context, id: string, viewer: Viewer): Row {
  const row = ctx.db
    .select()
    .from(transfer)
    .where(and(eq(transfer.id, id), notExpired()))
    .get();
  if (!row || (row.status !== "ready" && !canManage(row, viewer))) throw new NotFound();
  return row;
}

function ownTransfer(ctx: Context, id: string, owner: User): Row {
  const row = visibleTransfer(ctx, id, owner);
  if (row.ownerId !== owner.id) throw new NotFound();
  return row;
}

function fileOf(ctx: Context, transferId: string, fileId: string): FileRow {
  const entry = ctx.db
    .select()
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.transferId, transferId)))
    .get();
  if (!entry) throw new NotFound();
  return entry;
}

/** An empty file is never uploaded, so it has no blob */
const readFile = (ctx: Context, entry: FileRow) =>
  entry.size === 0 ? new Blob([]) : ctx.storage.read(keyOf(entry.transferId, entry.id));

const LIMIT_ERRORS = {
  "transfer-too-large": TransferTooLarge,
  "quota-exceeded": QuotaExceeded,
  "expiry-too-long": ExpiryTooLong,
};
/** Fresh share ids tried before giving up on a create */
const ID_ATTEMPTS = 3;
/** Bound parameters per statement stay well under SQLite's limit of 32766 */
const FILE_BATCH = 1000;

export async function createTransfer(ctx: Context, owner: User, input: TransferCreate): Promise<Transfer> {
  const paths = input.files.map((entry) => normalizePath(entry.path));
  if (paths.includes(undefined) || new Set(paths).size !== paths.length) throw new InvalidPath();
  const limits = limitsFor(ctx.db, owner);
  const passwordHash = input.password ? await Bun.password.hash(input.password) : null;
  const expiresIn = input.expiresIn === undefined ? limits.defaultExpirySeconds : input.expiresIn;

  // Synchronous, so the quota read and the insert cannot interleave with another create
  const row = ctx.db.transaction((tx) => {
    const code = checkTransfer(input, { limits, usedBytes: usedBytes(tx, owner.id) });
    if (code) throw new LIMIT_ERRORS[code]();
    const now = Date.now();
    const values = {
      ownerId: owner.id,
      title: input.title || null,
      message: input.message || null,
      passwordHash,
      size: input.files.reduce((sum, entry) => sum + entry.size, 0),
      createdAt: new Date(now),
      touchedAt: new Date(now),
      expiresAt: expiresIn === null ? null : new Date(now + expiresIn * 1000),
    };
    // The id is a share id from the schema default; a taken one inserts nothing, so try again with a new one
    let row: Row | undefined;
    for (let attempt = 0; !row && attempt < ID_ATTEMPTS; attempt++) {
      row = tx.insert(transfer).values(values).onConflictDoNothing().returning().get();
    }
    if (!row) throw new Error(`No free share id after ${ID_ATTEMPTS} attempts`);
    const transferId = row.id;
    const files = input.files.map((entry, i) => ({ transferId, path: paths[i]!, size: entry.size }));
    for (let i = 0; i < files.length; i += FILE_BATCH)
      tx.insert(file)
        .values(files.slice(i, i + FILE_BATCH))
        .run();
    return row;
  });
  return toTransfer(ctx, row, owner);
}

export function viewTransfer(ctx: Context, id: string, viewer: Viewer, unlockCookie: unknown): Row {
  const row = visibleTransfer(ctx, id, viewer);
  if (row.passwordHash !== null && unlockCookie !== id && !canManage(row, viewer)) throw new PasswordRequired();
  return row;
}

function summaries(ctx: Context, where: SQL | undefined) {
  return ctx.db
    .select({ row: transfer, fileCount: count(file.id), owner: { id: user.id, name: user.name, email: user.email } })
    .from(transfer)
    .innerJoin(user, eq(user.id, transfer.ownerId))
    .leftJoin(file, eq(file.transferId, transfer.id))
    .where(and(notExpired(), where))
    .groupBy(transfer.id)
    .orderBy(desc(transfer.createdAt))
    .all();
}

export const listTransfers = (ctx: Context, ownerId: string): TransferSummary[] =>
  summaries(ctx, eq(transfer.ownerId, ownerId)).map(({ row, fileCount }) => toSummary(row, fileCount));

export const listAllTransfers = (ctx: Context): AdminTransfer[] =>
  summaries(ctx, undefined).map(({ row, fileCount, owner }) => ({ ...toSummary(row, fileCount), owner }));

export async function appendChunk(
  ctx: Context,
  owner: User,
  id: string,
  fileId: string,
  offset: number,
  body: ReadableStream<Uint8Array> | null,
): Promise<ChunkResult> {
  const row = ownTransfer(ctx, id, owner);
  if (row.status !== "uploading") throw new TransferFinalized();
  const entry = fileOf(ctx, id, fileId);

  const capped = limitBytes(body ?? new Blob().stream(), Math.min(CHUNK_BYTES, entry.size - offset));
  const size = await ctx.storage.append(keyOf(id, fileId), offset, capped);
  ctx.db.update(transfer).set({ touchedAt: new Date() }).where(eq(transfer.id, id)).run();
  return { offset: size };
}

export async function finalizeTransfer(ctx: Context, owner: User, id: string): Promise<Transfer> {
  let row = ownTransfer(ctx, id, owner);
  if (row.status === "uploading") {
    for (const entry of filesOf(ctx, id)) {
      if ((await ctx.storage.size(keyOf(id, entry.id))) !== entry.size) throw new UploadIncomplete();
    }
    row = ctx.db.update(transfer).set({ status: "ready" }).where(eq(transfer.id, id)).returning().get()!;
  }
  return toTransfer(ctx, row, owner);
}

/** The only deletion path. Blobs go first, so a crash leaves a row to retry, never an orphaned blob */
export async function deleteTransfer(ctx: Context, id: string): Promise<void> {
  await ctx.storage.remove(`${id}/`);
  ctx.db.delete(transfer).where(eq(transfer.id, id)).run();
}

export async function removeTransfer(ctx: Context, viewer: Viewer, id: string): Promise<void> {
  if (!canManage(visibleTransfer(ctx, id, viewer), viewer)) throw new NotFound();
  await deleteTransfer(ctx, id);
}

export async function unlockTransfer(ctx: Context, id: string, password: string): Promise<void> {
  const row = visibleTransfer(ctx, id, undefined);
  if (row.passwordHash !== null && !(await Bun.password.verify(password, row.passwordHash))) {
    throw new PasswordInvalid();
  }
}

// RFC 8187 also reserves ' ( ) *, which encodeURIComponent leaves as they are
const attachment = (name: string) => ({
  "content-type": "application/octet-stream",
  "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
  "x-content-type-options": "nosniff",
});

const countDownload = (ctx: Context, id: string) =>
  ctx.db
    .update(transfer)
    .set({ downloads: sql`${transfer.downloads} + 1` })
    .where(eq(transfer.id, id))
    .run();

export function downloadFile(ctx: Context, row: Row, fileId: string, ranged: boolean) {
  const entry = fileOf(ctx, row.id, fileId);
  if (!ranged) countDownload(ctx, row.id);
  return {
    body: readFile(ctx, entry),
    headers: attachment(entry.path.split("/").at(-1)!),
  };
}

export function downloadTransferZip(ctx: Context, row: Row): Response {
  const entries = filesOf(ctx, row.id).map((entry) => ({
    name: entry.path,
    size: entry.size,
    lastModified: row.createdAt,
    input: readFile(ctx, entry),
  }));
  countDownload(ctx, row.id);
  const zip = downloadZip(entries, { length: predictLength(entries) });
  for (const [name, value] of Object.entries(attachment(`${row.title || "transfer"}.zip`)))
    zip.headers.set(name, value);
  return zip;
}
