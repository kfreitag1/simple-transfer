import type { LimitScope, Limits } from "@st/shared/limits";
import { createShareId } from "@st/shared/share-id";
import { index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const randomId = () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// ── Better Auth (core + admin plugin). Column set is dictated by Better Auth; regenerate with
// `bunx --bun @better-auth/cli generate` when upgrading it and diff against this. ──

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ── Application ──

export const transfer = sqliteTable(
  "transfer",
  {
    /** Share link (`/t/:id`): a memorable word triple from `createShareId`. Insert conflicts are retried. */
    id: text("id").primaryKey().$defaultFn(createShareId),
    /** `restrict`: a user with transfers cannot be deleted, so blobs are never orphaned. */
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title"),
    message: text("message"),
    /** `Bun.password` hash, or null when unprotected. */
    passwordHash: text("password_hash"),
    status: text("status", { enum: ["uploading", "ready"] })
      .notNull()
      .default("uploading"),
    /** Sum of declared file sizes. Counts against the owner's quota from creation. */
    size: integer("size").notNull(),
    downloads: integer("downloads").notNull().default(0),
    createdAt: createdAt(),
    /** Last chunk received. An `uploading` transfer is swept `UPLOAD_TTL_SECONDS` after this. */
    touchedAt: timestamp("touched_at")
      .notNull()
      .$defaultFn(() => new Date()),
    /** Fixed at creation. Null never expires. */
    expiresAt: timestamp("expires_at"),
  },
  (t) => [index("transfer_owner_id_idx").on(t.ownerId), index("transfer_expires_at_idx").on(t.expiresAt)],
);

export const file = sqliteTable(
  "file",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    transferId: text("transfer_id")
      .notNull()
      .references(() => transfer.id, { onDelete: "cascade" }),
    /** Normalized relative path, `/`-separated. Never used as a storage key. */
    path: text("path").notNull(),
    /** Declared size. Bytes received so far are not stored here: `Storage.size` is the source of truth. */
    size: integer("size").notNull(),
  },
  (t) => [unique("file_transfer_id_path_unique").on(t.transferId, t.path)],
);

/** Stored limit layers. See `resolveLimits` in @st/shared/limits. */
export const limitOverride = sqliteTable(
  "limit_override",
  {
    scope: text("scope").$type<LimitScope>().notNull(),
    /** `""` for global, a role, or a user id. */
    subject: text("subject").notNull(),
    values: text("values", { mode: "json" }).$type<Partial<Limits>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.subject] })],
);
