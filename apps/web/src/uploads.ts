import type { Transfer } from "@st/shared/contract";
import { type UploadProgress, uploadTransfer } from "@st/shared/upload";
import { type Accessor, createContext, createSignal, onSettled } from "solid-js";
import { api, unwrap } from "./api.ts";

type UploadPhase = "uploading" | "failed" | "done";

/** One transfer being uploaded. Kept after it finishes, so its link stays on screen */
export interface Upload {
  id: string;
  /** The title, or the share id when there is none */
  name: Accessor<string>;
  phase: Accessor<UploadPhase>;
  transfer: Accessor<Transfer | undefined>;
  progress: Accessor<UploadProgress>;
  /** Bytes per second, smoothed. 0 until there is something to measure */
  rate: Accessor<number>;
  error: Accessor<unknown>;
  resume: () => void;
  /** Aborts and forgets it */
  clear: () => void;
}

/**
 * Every upload of this session, created above the router so changing pages never interrupts one
 * Each keeps the blobs it was given, so resuming never asks for the files again
 */
export function createUploads() {
  const [uploads, setUploads] = createSignal<Upload[]>([]);
  /** Set once per upload that completes, for the toast that says so */
  const [finished, setFinished] = createSignal<{ id: string; name: string }>();

  onSettled(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (uploads().some((upload) => upload.phase() === "uploading")) event.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  });

  function create(transfer: Transfer, files: ReadonlyMap<string, Blob>) {
    const [phase, setPhase] = createSignal<UploadPhase>("uploading");
    const [current, setCurrent] = createSignal<Transfer | undefined>(transfer);
    const [progress, setProgress] = createSignal<UploadProgress>({ uploadedBytes: 0, totalBytes: transfer.size });
    const [rate, setRate] = createSignal(0);
    const [error, setError] = createSignal<unknown>();
    let blobs = files;
    let controller: AbortController | undefined;
    let sample = { at: 0, bytes: 0 };

    const measure = (next: UploadProgress) => {
      setProgress({ ...next });
      const seconds = (performance.now() - sample.at) / 1000;
      if (seconds < 1) return;
      const currentRate = (next.uploadedBytes - sample.bytes) / seconds;
      setRate((previous) => (previous === 0 ? currentRate : previous * 0.7 + currentRate * 0.3));
      sample = { at: performance.now(), bytes: next.uploadedBytes };
    };
    const run = async (target: Transfer) => {
      controller = new AbortController();
      const { signal } = controller;
      const uploadedBytes = target.files.reduce((sum, file) => sum + file.offset, 0);
      sample = { at: performance.now(), bytes: uploadedBytes };
      setProgress({ uploadedBytes, totalBytes: target.size });
      setRate(0);
      setCurrent(target);
      setError(undefined);
      setPhase("uploading");
      try {
        setCurrent(await uploadTransfer(target, blobs, { signal, onProgress: measure }));
        blobs = new Map();
        setPhase("done");
        setFinished({ id: transfer.id, name: current()?.title ?? transfer.id });
      } catch (failure) {
        if (signal.aborted) return;
        setError(failure);
        setPhase("failed");
      }
    };

    const upload: Upload = {
      id: transfer.id,
      name: () => current()?.title ?? transfer.id,
      phase,
      transfer: current,
      progress,
      rate,
      error,
      async resume() {
        try {
          run(await unwrap(api.transfers({ id: transfer.id }).get()));
        } catch (failure) {
          setError(failure);
        }
      },
      clear() {
        controller?.abort();
        setUploads((list) => list.filter((item) => item !== upload));
      },
    };
    return { upload, begin: () => run(transfer) };
  }

  return {
    list: uploads,
    finished,
    get: (id: string) => uploads().find((upload) => upload.id === id),
    /** Starts uploading `transfer`, replacing any upload already running for it */
    start(transfer: Transfer, files: ReadonlyMap<string, Blob>) {
      uploads()
        .find((upload) => upload.id === transfer.id)
        ?.clear();
      const { upload, begin } = create(transfer, files);
      setUploads((list) => [...list, upload]);
      begin();
      return upload;
    },
  };
}

export type Uploads = ReturnType<typeof createUploads>;

export const UploadsContext = createContext<Uploads>();
