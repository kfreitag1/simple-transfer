import { CHUNK_BYTES, UPLOAD_CONCURRENCY } from "./constants.ts";
import { type Transfer, type TransferFile, transferPath } from "./contract.ts";
import { ApiError } from "./errors.ts";

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadOptions {
  /** Origin of the API. Defaults to the page origin */
  baseUrl?: string;
  /** Injectable so tests can route requests to `app.handle` with a session cookie */
  fetch?: typeof fetch;
  /** Aborting pauses the upload: the promise rejects with the abort reason and the upload can be resumed later */
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Uploads every incomplete file of `transfer`, then finalizes it and resolves with the ready transfer
 *
 * Resumable: it starts each file at `file.offset`, so resuming is calling it again with a freshly
 * fetched transfer and the same blobs. `blobs` is keyed by `file.path`; a missing or wrongly sized
 * blob throws before any request is made
 *
 * Behaviour is specified in ARCHITECTURE.md ("Upload protocol")
 */
export async function uploadTransfer(
  transfer: Transfer,
  blobs: ReadonlyMap<string, Blob>,
  options: UploadOptions = {},
): Promise<Transfer> {
  const { baseUrl = "", fetch: request = fetch, onProgress } = options;
  for (const file of transfer.files) {
    if (blobs.get(file.path)?.size !== file.size) throw new Error(`No blob of ${file.size} bytes for ${file.path}`);
  }
  // Aborted by the caller, or by the first failing file so the others stop too
  const failed = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, failed.signal]) : failed.signal;
  const base = `${baseUrl}${transferPath(transfer.id)}`;

  const offsets = new Map(transfer.files.map((file) => [file.id, file.offset]));
  const totalBytes = transfer.files.reduce((sum, file) => sum + file.size, 0);
  const report = () =>
    onProgress?.({ uploadedBytes: [...offsets.values()].reduce((sum, offset) => sum + offset, 0), totalBytes });

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    for (let failures = 1; ; failures++) {
      signal.throwIfAborted();
      let result: Response | Error;
      try {
        result = await request(url, { ...init, signal });
        if (result.status < 500 && result.status !== 429) return result;
      } catch (error) {
        signal.throwIfAborted();
        result = error as Error;
      }
      if (failures === MAX_ATTEMPTS) throw result instanceof Response ? await ApiError.from(result) : result;
      await sleep(Math.min(FIRST_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS), signal);
    }
  };

  const uploadFile = async (file: TransferFile) => {
    const blob = blobs.get(file.path)!;
    for (let offset = offsets.get(file.id)!; offset < file.size; offset = offsets.get(file.id)!) {
      const response = await send(`${base}/files/${encodeURIComponent(file.id)}?offset=${offset}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob.slice(offset, offset + CHUNK_BYTES),
      });
      if (response.ok) offsets.set(file.id, ((await response.json()) as { offset: number }).offset);
      else {
        const error = await ApiError.from(response);
        if (error.problem.code !== "offset-mismatch" || error.problem.offset === undefined) throw error;
        offsets.set(file.id, error.problem.offset);
      }
      report();
    }
  };

  report();
  const pending = transfer.files.filter((file) => file.offset < file.size);
  const worker = async () => {
    for (let file = pending.shift(); file; file = pending.shift()) await uploadFile(file);
  };
  try {
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  } catch (error) {
    failed.abort(error);
    throw options.signal?.aborted ? options.signal.reason : error;
  }
  const response = await send(`${base}/finalize`, { method: "POST" });
  if (!response.ok) throw await ApiError.from(response);
  return response.json() as Promise<Transfer>;
}

const MAX_ATTEMPTS = 5;
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
