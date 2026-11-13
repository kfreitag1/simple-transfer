/**
 * Port for blob storage. Keys are opaque, server-generated (`<transferId>/<fileId>`) and never
 * derived from user input. Adapters live beside this file; `local.ts` is the only one for now.
 * Every adapter must pass the shared contract suite in `storage.contract.ts`.
 */
export interface Storage {
  /** Bytes durably stored under `key`; 0 if nothing is. The source of truth for upload offsets. */
  size(key: string): Promise<number>;

  /**
   * Appends `body` to `key` and resolves with the new size. Throws `OffsetMismatch` (carrying the
   * actual size) unless `offset === size(key)`. Calls for the same key never interleave. If `body`
   * errors midway the bytes already written may be kept or dropped: callers re-read `size`.
   */
  append(key: string, offset: number, body: ReadableStream<Uint8Array>): Promise<number>;

  /** Lazy handle to the stored bytes. Returned from a route it gets `Range` support from Elysia; `.stream()` feeds the zip. */
  read(key: string): Blob;

  /** Deletes every key that starts with `prefix`. Succeeds when there are none. */
  remove(prefix: string): Promise<void>;
}
