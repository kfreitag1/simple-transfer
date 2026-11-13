// Choosing files, by button, by drag onto the window, or by pasting. Shared by the send form and the transfer page
import { type Accessor, createSignal, onSettled, Show } from "solid-js";
import styles from "./file-drop.module.css";
import { t } from "./i18n/index.ts";
import { Button } from "./ui/Button.tsx";
import { Icon } from "./ui/Icon.tsx";

export type Picked = { path: string; file: File };
export type OnPick = (files: Picked[]) => void;

/** The three cards that fan out as a drop target. Placeholders until there is artwork */
export function DropZone(props: { title: string; hint?: string; dragging: boolean; onPick: OnPick }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a shortcut for the first button, which is the keyboard path
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      class={[styles.drop, { [styles.dragging!]: props.dragging }]}
      onClick={(event) => {
        if (!(event.target as Element).closest("button, input")) event.currentTarget.querySelector("button")?.click();
      }}
    >
      <div class={styles.fan} aria-hidden="true">
        <div class={styles.card}>
          <Icon name="media-image" />
        </div>
        <div class={styles.card}>
          <Icon name="folder" />
        </div>
        <div class={styles.card}>
          <Icon name="empty-page" />
        </div>
      </div>
      <div>
        <h1>{props.dragging ? t("send.dropNow") : props.title}</h1>
        <Show when={props.hint}>
          <p class="muted small">{props.hint}</p>
        </Show>
      </div>
      <PickButtons onPick={props.onPick} />
    </div>
  );
}

export function PickButtons(props: { compact?: boolean; onPick: OnPick }) {
  let files!: HTMLInputElement;
  let folder!: HTMLInputElement;
  const pick = (input: HTMLInputElement) => {
    props.onPick([...(input.files ?? [])].map((file) => ({ path: file.webkitRelativePath || file.name, file })));
    input.value = "";
  };
  const look = () => (props.compact ? ({ variant: "ghost", size: "sm" } as const) : {});
  return (
    <div class="row">
      <input
        ref={(el) => {
          files = el;
        }}
        type="file"
        multiple
        hidden
        onChange={(event) => pick(event.currentTarget)}
      />
      <input
        ref={(el) => {
          folder = el;
        }}
        type="file"
        webkitdirectory
        hidden
        onChange={(event) => pick(event.currentTarget)}
      />
      <Button {...look()} icon="page-plus" onClick={() => files.click()}>
        {props.compact ? t("send.addFiles") : t("send.pickFiles")}
      </Button>
      <Button {...look()} icon="folder-plus" onClick={() => folder.click()}>
        {props.compact ? t("send.addFolder") : t("send.pickFolder")}
      </Button>
    </div>
  );
}

/** Makes the whole window a drop target and accepts pasted files. True while files are held over the window */
export function createFileDrop(onPick: OnPick): Accessor<boolean> {
  const [dragging, setDragging] = createSignal(false);
  onSettled(() => {
    const listening = new AbortController();
    const on = <K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void) =>
      addEventListener(type, listener, { signal: listening.signal });
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    // dragenter and dragleave fire for every element crossed, so count them
    let depth = 0;
    on("dragenter", (event) => {
      if (carriesFiles(event) && ++depth === 1) setDragging(true);
    });
    on("dragleave", (event) => {
      if (carriesFiles(event) && --depth === 0) setDragging(false);
    });
    on("dragover", (event) => {
      if (carriesFiles(event)) event.preventDefault();
    });
    on("drop", async (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      // Entries must be taken synchronously, before the first await
      const entries = [...(event.dataTransfer?.items ?? [])].flatMap((item) => item.webkitGetAsEntry() ?? []);
      onPick(await collectEntries(entries));
    });
    on("paste", (event) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length > 0) onPick(files.map((file) => ({ path: file.name, file })));
    });
    return () => listening.abort();
  });
  return dragging;
}

async function collectEntries(entries: FileSystemEntry[]): Promise<Picked[]> {
  const picked: Picked[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      picked.push({ path: entry.fullPath.replace(/^\//, ""), file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries answers in batches until it returns an empty one
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child);
      }
    }
  };
  for (const entry of entries) await walk(entry);
  return picked;
}
