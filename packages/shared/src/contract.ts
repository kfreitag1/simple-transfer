/**
 * API contract: the single source of truth for request and response shapes. Server routes use these
 * schemas for validation; the web app gets the same types through Eden. Timestamps are epoch
 * milliseconds. Routes and behaviour are specified in ARCHITECTURE.md.
 */
import { type Static, Type } from "typebox";
import { MAX_FILES, MAX_MESSAGE_LENGTH, MAX_PASSWORD_LENGTH, MAX_PATH_LENGTH, MAX_TITLE_LENGTH } from "./constants.ts";
import { LimitOverride, Limits } from "./limits.ts";

const Nullable = <T extends Type.TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const Size = Type.Integer({ minimum: 0 });
const Timestamp = Type.Integer();

/** One file of a new transfer. `path` is relative with `/` separators and keeps the folder structure. */
export const FileEntry = Type.Object({
  path: Type.String({ minLength: 1, maxLength: MAX_PATH_LENGTH }),
  size: Size,
});
export type FileEntry = Static<typeof FileEntry>;

export const TransferCreate = Type.Object({
  title: Type.Optional(Type.String({ maxLength: MAX_TITLE_LENGTH })),
  message: Type.Optional(Type.String({ maxLength: MAX_MESSAGE_LENGTH })),
  password: Type.Optional(Type.String({ minLength: 1, maxLength: MAX_PASSWORD_LENGTH })),
  /** Lifetime in seconds from creation. `null` is never. Omitted uses the user's default. */
  expiresIn: Type.Optional(Nullable(Type.Integer({ minimum: 1 }))),
  files: Type.Array(FileEntry, { minItems: 1, maxItems: MAX_FILES }),
});
export type TransferCreate = Static<typeof TransferCreate>;

export const TransferStatus = Type.Union([Type.Literal("uploading"), Type.Literal("ready")]);
export type TransferStatus = Static<typeof TransferStatus>;

export const TransferFile = Type.Object({
  id: Type.String(),
  path: Type.String(),
  size: Size,
  /** Bytes stored so far. Equals `size` once the transfer is ready. */
  offset: Size,
});
export type TransferFile = Static<typeof TransferFile>;

export const TransferSummary = Type.Object({
  /** The share link: `/t/:id`. A memorable word triple (`createShareId`); see "Share ids". */
  id: Type.String(),
  title: Nullable(Type.String()),
  message: Nullable(Type.String()),
  status: TransferStatus,
  size: Size,
  fileCount: Type.Integer(),
  downloads: Type.Integer(),
  hasPassword: Type.Boolean(),
  createdAt: Timestamp,
  expiresAt: Nullable(Timestamp),
});
export type TransferSummary = Static<typeof TransferSummary>;

export const Transfer = Type.Intersect([TransferSummary, Type.Object({ files: Type.Array(TransferFile) })]);
export type Transfer = Static<typeof Transfer>;

export const AdminTransfer = Type.Intersect([
  TransferSummary,
  Type.Object({ owner: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String() }) }),
]);
export type AdminTransfer = Static<typeof AdminTransfer>;

export const ChunkQuery = Type.Object({ offset: Size });
export const ChunkResult = Type.Object({ offset: Size });

export const Unlock = Type.Object({ password: Type.String({ minLength: 1, maxLength: MAX_PASSWORD_LENGTH }) });

/** The signed-in user's effective limits and current usage, for client-side pre-flight checks. */
export const Me = Type.Object({ limits: Limits, usedBytes: Size });
export type Me = Static<typeof Me>;

export const AdminLimits = Type.Object({
  /** Built-in base layer (`DEFAULT_LIMITS`). */
  defaults: Limits,
  overrides: Type.Array(LimitOverride),
});
export type AdminLimits = Static<typeof AdminLimits>;

export const AdminStats = Type.Object({ users: Type.Integer(), transfers: Type.Integer(), bytes: Size });
export type AdminStats = Static<typeof AdminStats>;
