/**
 * API contract: the single source of truth for request and response shapes. Server routes use these
 * schemas for validation; the web app gets the same types through Eden. Timestamps are epoch
 * milliseconds. Routes and behaviour specified in ARCHITECTURE.md
 */
import { type Static, Type } from "typebox";
import {
  MAX_BRAND_NAME_LENGTH,
  MAX_FILES,
  MAX_LOGO_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_PATH_LENGTH,
  MAX_TITLE_LENGTH,
} from "./constants.ts";
import { Limits } from "./limits.ts";

export const transferPath = (id: string) => `/api/transfers/${encodeURIComponent(id)}`;

const Nullable = <T extends Type.TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const Size = Type.Integer({ minimum: 0 });
const Timestamp = Type.Integer();

/** One file of a new transfer. `path` is relative with `/` separators and keeps the folder structure */
export const FileEntry = Type.Object({
  path: Type.String({ minLength: 1, maxLength: MAX_PATH_LENGTH }),
  size: Size,
});
export type FileEntry = Static<typeof FileEntry>;

export const TransferCreate = Type.Object({
  title: Type.Optional(Type.String({ maxLength: MAX_TITLE_LENGTH })),
  message: Type.Optional(Type.String({ maxLength: MAX_MESSAGE_LENGTH })),
  password: Type.Optional(Type.String({ minLength: 1, maxLength: MAX_PASSWORD_LENGTH })),
  /** Lifetime in seconds from creation. `null` is never. Omitted uses the user's default */
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
  /** Bytes stored so far. Equals `size` once the transfer is ready */
  offset: Size,
});
export type TransferFile = Static<typeof TransferFile>;

export const TransferSummary = Type.Object({
  /** The share link: `/<id>`. A memorable word triple (`createShareId`) */
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

export const Transfer = Type.Intersect([
  TransferSummary,
  Type.Object({
    files: Type.Array(TransferFile),
    /** Requested by the owner: only they can upload, finalize or delete it */
    owned: Type.Boolean(),
  }),
]);
export type Transfer = Static<typeof Transfer>;

export const AdminTransfer = Type.Intersect([
  TransferSummary,
  Type.Object({ owner: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String() }) }),
]);
export type AdminTransfer = Static<typeof AdminTransfer>;

export const ChunkQuery = Type.Object({ offset: Size });
export const ChunkResult = Type.Object({ offset: Size });
export type ChunkResult = Static<typeof ChunkResult>;

export const Unlock = Type.Object({ password: Type.String({ minLength: 1, maxLength: MAX_PASSWORD_LENGTH }) });

/** The signed-in user's effective limits and current usage, for client-side pre-flight checks */
export const Me = Type.Object({ limits: Limits, usedBytes: Size });
export type Me = Static<typeof Me>;

/** How the instance presents itself, set by an admin. `null` keeps the built-in default */
export const Branding = Type.Object({
  name: Nullable(Type.String({ minLength: 1, maxLength: MAX_BRAND_NAME_LENGTH })),
  /** `#rrggbb`. The web app derives the light and dark variants from it */
  accent: Nullable(Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
  /** A data URL, so it needs no route of its own and cannot run script. Also used as the favicon */
  logo: Nullable(
    Type.String({
      pattern: "^data:image/(png|jpeg|webp|svg\\+xml);base64,[A-Za-z0-9+/]+=*$",
      maxLength: Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32,
    }),
  ),
});
export type Branding = Static<typeof Branding>;

/** Everything an admin can change about the instance. Written whole by `PUT /admin/settings` */
export const Settings = Type.Object({
  branding: Branding,
  /** Whether the server asks the project's repository for newer releases */
  updateCheck: Type.Boolean(),
});
export type Settings = Static<typeof Settings>;

/** One heading of a release's notes ("Added", "Fixed"). Titles come from CHANGELOG.md and are not translated */
export const ChangeGroup = Type.Object({ title: Type.String(), items: Type.Array(Type.String()) });
export type ChangeGroup = Static<typeof ChangeGroup>;

/** A newer release than the one running */
export const Update = Type.Object({
  latest: Type.String(),
  /** The release page, for the notes and the download */
  url: Type.String(),
});
export type Update = Static<typeof Update>;

/** Public instance settings the web app needs before sign-in */
export const Config = Type.Object({
  /** Name of the OIDC provider for the sign-in button. `null` shows a generic label */
  providerName: Nullable(Type.String()),
  settings: Settings,
});
export type Config = Static<typeof Config>;

/** One release from `CHANGELOG.md`, newest first */
export const Release = Type.Object({ version: Type.String(), changes: Type.Array(ChangeGroup) });
export type Release = Static<typeof Release>;

/** For the admin panel: what this build contains and whether there is a newer one */
export const Releases = Type.Object({
  /** The running release, from `package.json` */
  current: Type.String(),
  releases: Type.Array(Release),
  /** Only set when a newer release is known and update checks are on */
  update: Nullable(Update),
});
export type Releases = Static<typeof Releases>;

export const AdminStats = Type.Object({ users: Type.Integer(), transfers: Type.Integer(), bytes: Size });
export type AdminStats = Static<typeof AdminStats>;
