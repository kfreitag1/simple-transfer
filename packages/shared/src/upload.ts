import type { Transfer } from "./contract.ts";

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadOptions {
  /** Origin of the API. Defaults to the page origin. */
  baseUrl?: string;
  /** Injectable so tests can route requests to `app.handle` with a session cookie. */
  fetch?: typeof fetch;
  /** Aborting pauses the upload: the promise rejects with the abort reason and the upload can be resumed later. */
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Uploads every incomplete file of `transfer`, then finalizes it and resolves with the ready transfer.
 *
 * Resumable by construction: it starts each file at `file.offset`, so resuming (after a pause, a
 * network failure or a page reload) is calling it again with a freshly fetched transfer and the
 * same blobs. `blobs` is keyed by `file.path`; a missing or wrongly sized blob throws before any
 * request is made.
 *
 * Behaviour is specified in ARCHITECTURE.md ("Upload protocol").
 */
export function uploadTransfer(
  _transfer: Transfer,
  _blobs: ReadonlyMap<string, Blob>,
  _options: UploadOptions = {},
): Promise<Transfer> {
  throw new Error("not implemented");
}
