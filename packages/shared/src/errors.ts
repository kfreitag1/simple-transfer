/**
 * Every error code the API can return, with its HTTP status. Errors are RFC 9457 problem documents
 * (`{ code, status, title, ...extension }`). The server never sends user-facing text: the client
 * translates `code` (`errors.<code>` in the i18n dictionary, which must cover every key here)
 */
export const ERROR_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  "password-required": 401,
  "password-invalid": 403,
  "transfer-too-large": 413,
  "quota-exceeded": 413,
  "expiry-too-long": 422,
  "invalid-path": 422,
  /** Extension: `offset`: the server's actual offset; resume from it */
  "offset-mismatch": 409,
  "chunk-too-large": 413,
  "upload-incomplete": 409,
  "transfer-finalized": 409,
  /** Sent with a `Retry-After` header */
  "rate-limited": 429,
  // Elysia built-ins
  "not-found": 404,
  validation: 422,
  parse: 400,
  /** Stale or tampered unlock cookie: the client treats it as `password-required` */
  "invalid-cookie": 400,
  "internal-server-error": 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface Problem {
  code: ErrorCode;
  status: number;
  /** Present on `offset-mismatch` */
  offset?: number;
}

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.code);
  }

  static async from(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => undefined)) as Problem | undefined;
    return new ApiError(body?.code ? body : { code: "internal-server-error", status: response.status });
  }
}
