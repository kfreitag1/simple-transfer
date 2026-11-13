import { ERROR_STATUS, type ErrorCode } from "@st/shared/errors";
import { HTTPError } from "elysia";

const define = <const C extends ErrorCode>(code: C) => HTTPError.id(code, ERROR_STATUS[code]);

/** Thrown anywhere below a route; Elysia serves them as problem documents. `NotFound` comes from Elysia. */
export class Unauthorized extends define("unauthorized") {}
export class Forbidden extends define("forbidden") {}
export class PasswordRequired extends define("password-required") {}
export class PasswordInvalid extends define("password-invalid") {}
export class TransferTooLarge extends define("transfer-too-large") {}
export class QuotaExceeded extends define("quota-exceeded") {}
export class ExpiryTooLong extends define("expiry-too-long") {}
export class InvalidPath extends define("invalid-path") {}
export class ChunkTooLarge extends define("chunk-too-large") {}
export class UploadIncomplete extends define("upload-incomplete") {}
export class TransferFinalized extends define("transfer-finalized") {}

export class OffsetMismatch extends define("offset-mismatch") {
  constructor(readonly offset: number) {
    super();
  }
  extension() {
    return { offset: this.offset };
  }
}

export class RateLimited extends define("rate-limited") {
  override readonly headers: Record<string, string>;
  constructor(retryAfterSeconds: number) {
    super();
    this.headers = { "Retry-After": String(retryAfterSeconds) };
  }
}
