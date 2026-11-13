const MiB = 1024 ** 2;

/** Upload chunk size. Clients send exactly this many bytes per PATCH except for a file's final chunk; the server rejects larger bodies. ≥ 5 MiB keeps an S3 multipart adapter viable. */
export const CHUNK_BYTES = 16 * MiB;
/** Files of one transfer uploaded in parallel. Chunks within a file are sequential. */
export const UPLOAD_CONCURRENCY = 3;
/** An `uploading` transfer is deleted once this long passes without a chunk. */
export const UPLOAD_TTL_SECONDS = 24 * 60 * 60;
/** Lifetime of the unlock cookie issued for a password-protected transfer. */
export const UNLOCK_TTL_SECONDS = 60 * 60;

export const MAX_FILES = 10_000;
export const MAX_PATH_LENGTH = 1024;
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PASSWORD_LENGTH = 200;

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];
