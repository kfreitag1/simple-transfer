import { useParams } from "@solidjs/router";
import { type Transfer, type TransferFile, transferPath } from "@st/shared/contract";
import { createMemo, createSignal, For, Show, useContext } from "solid-js";
import { api, errorCode, isLocked, shareUrl, unwrap } from "../api.ts";
import { CopyButton, ErrorText, FileRow, TransferMeta } from "../components.tsx";
import { createFileDrop, DropZone, type OnPick, type Picked } from "../file-drop.tsx";
import { formatApproximate, formatBytes, formatNumber, formatPercent, formatRate } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { Button, LinkButton } from "../ui/Button.tsx";
import { Input } from "../ui/Field.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Empty, Panel } from "../ui/surfaces.tsx";
import { type Upload, UploadsContext } from "../uploads.ts";
import styles from "./Transfer.module.css";

/** Missing files listed by name when resuming; the rest are counted */
const MISSING_LISTED = 50;

type Folder = { name: string; folders: Map<string, Folder>; files: TransferFile[] };

function buildTree(files: TransferFile[]): Folder {
  const root: Folder = { name: "", folders: new Map(), files: [] };
  for (const file of files) {
    const segments = file.path.split("/");
    let folder = root;
    for (const name of segments.slice(0, -1)) {
      const child = folder.folders.get(name) ?? { name, folders: new Map(), files: [] };
      folder.folders.set(name, child);
      folder = child;
    }
    folder.files.push(file);
  }
  return root;
}

/** Everything about one transfer: its download, or its upload while it is still incomplete */
export default function TransferPage() {
  const params = useParams();
  const uploads = useContext(UploadsContext);
  const id = () => params.id!;
  const [attempt, setAttempt] = createSignal(0);
  // Only this transfer's live upload, so another one running in the background cannot stand in for it
  const live = createMemo(() => uploads.get(id()));
  const result = createMemo(() => {
    attempt();
    return unwrap(api.transfers({ id: id() }).get()).then(
      (transfer) => ({ transfer, error: undefined }),
      (error: unknown) => ({ transfer: undefined, error }),
    );
  });
  /** The copy to render: the live upload's once it is done, the fetched one otherwise */
  const settled = createMemo(() => (live()?.phase() === "done" ? live()?.transfer() : result().transfer));
  /** Only while bytes are still moving (or interrupted); a finished upload has its own view */
  const inFlight = createMemo(() => {
    const upload = live();
    return upload !== undefined && upload.phase() !== "done" ? upload : undefined;
  });

  return (
    <Show
      when={settled()}
      fallback={
        <Show
          when={isLocked(result().error)}
          fallback={
            <Panel>
              <Empty icon="file-not-found" title={t(`errors.${errorCode(result().error)}`)} />
            </Panel>
          }
        >
          <Unlock id={id()} onUnlocked={() => setAttempt((n) => n + 1)} />
        </Show>
      }
    >
      {(found) => (
        <Show when={inFlight()} fallback={<TransferBody transfer={found()} />}>
          {(upload) => <UploadProgress upload={upload()} />}
        </Show>
      )}
    </Show>
  );
}

/** The ready transfer, or the way to finish uploading one that is not */
function TransferBody(props: { transfer: Transfer }) {
  return (
    <Show when={props.transfer.status === "uploading"} fallback={<TransferView transfer={props.transfer} />}>
      <Show
        when={props.transfer.owned}
        fallback={
          <Panel>
            <Empty icon="clock" title={t("download.incomplete")} />
          </Panel>
        }
      >
        <FinishUpload transfer={props.transfer} />
      </Show>
    </Show>
  );
}

/** Choose the files that still lack bytes. Resume stays disabled until every one has been added */
function FinishUpload(props: { transfer: Transfer }) {
  const uploads = useContext(UploadsContext);
  const [picked, setPicked] = createSignal<Picked[]>([]);
  const blobs = createMemo(() => {
    const byKey = new Map(picked().map((entry) => [`${entry.path}\0${entry.file.size}`, entry.file]));
    const matched = new Map<string, File>();
    for (const file of props.transfer.files) {
      const blob = byKey.get(`${file.path}\0${file.size}`);
      if (blob) matched.set(file.path, blob);
    }
    return matched;
  });
  /** Only the files that still lack bytes; finished ones are never asked for again */
  const needed = createMemo(() =>
    props.transfer.files.filter((file) => file.offset < file.size).sort((a, b) => a.path.localeCompare(b.path)),
  );
  const missing = () => needed().filter((file) => !blobs().has(file.path));
  const add: OnPick = (more) => setPicked((list) => [...list, ...more]);
  const dragging = createFileDrop(add);

  return (
    <Panel highlight={dragging()}>
      <div class={styles.heading}>
        <h1>{props.transfer.title ?? t("send.resumeTitle")}</h1>
        <TransferMeta transfer={props.transfer} />
      </div>
      <DropZone title={t("send.drop")} hint={t("send.resumeHint")} dragging={dragging()} onPick={add} />
      <Show when={needed().length > 0}>
        <div>
          <div class={styles.needed}>
            <Show when={missing().length > 0} fallback={<span>{t("send.allChosen")}</span>}>
              <span>{t("send.missing", { count: formatNumber(missing().length) })}</span>
            </Show>
            <span>
              {t("send.added", {
                count: formatNumber(needed().length - missing().length),
                total: formatNumber(needed().length),
              })}
            </span>
          </div>
          <Show when={missing().length > 0}>
            <div class={styles.files}>
              <For each={missing().slice(0, MISSING_LISTED)}>
                {(file) => <FileRow name={file.path} meta={formatBytes(file.size)} />}
              </For>
              <Show when={missing().length > MISSING_LISTED}>
                <p class="muted small">{t("send.more", { count: formatNumber(missing().length - MISSING_LISTED) })}</p>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
      <Button
        variant="primary"
        block
        disabled={missing().length > 0}
        onClick={() => uploads.start(props.transfer, blobs())}
      >
        {t("send.resume")}
      </Button>
    </Panel>
  );
}

function UploadProgress(props: { upload: Upload }) {
  const uploading = () => props.upload.phase() === "uploading";
  const fraction = () => {
    const { uploadedBytes, totalBytes } = props.upload.progress();
    return totalBytes === 0 ? 1 : uploadedBytes / totalBytes;
  };
  const secondsLeft = () => {
    const { uploadedBytes, totalBytes } = props.upload.progress();
    return (totalBytes - uploadedBytes) / props.upload.rate();
  };
  return (
    <Panel>
      <div class="stack">
        <div class={styles.status}>{uploading() ? t("send.uploading") : t("send.failed")}</div>
        <p class={styles.percent}>{formatPercent(fraction())}</p>
        <div>
          <div
            class={[styles.bar, { [styles.failed!]: !uploading() }]}
            style={`--value: ${fraction()}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction() * 100)}
          >
            <div />
          </div>
          <div class={styles.progress}>
            <span>
              {t("send.progress", {
                uploaded: formatBytes(props.upload.progress().uploadedBytes),
                total: formatBytes(props.upload.progress().totalBytes),
              })}
            </span>
            <Show when={uploading() && props.upload.rate() > 0}>
              <span>
                {formatRate(props.upload.rate())} · {t("send.remaining", { time: formatApproximate(secondsLeft()) })}
              </span>
            </Show>
          </div>
        </div>
      </div>
      <Show when={props.upload.error()}>{(failure) => <ErrorText error={failure()} />}</Show>
      <Show when={!uploading()}>
        <Button variant="primary" block icon="play" onClick={() => props.upload.resume()}>
          {t("send.resume")}
        </Button>
      </Show>
    </Panel>
  );
}

function TransferView(props: { transfer: Transfer }) {
  const base = () => transferPath(props.transfer.id);
  const fileUrl = (file: TransferFile) => `${base()}/files/${encodeURIComponent(file.id)}`;
  /** A lone file is downloaded as itself rather than inside a zip */
  const only = () => (props.transfer.files.length === 1 ? props.transfer.files[0] : undefined);
  const link = () => shareUrl(props.transfer.id);
  return (
    <Panel>
      <div class={styles.heading}>
        <h1>{props.transfer.title ?? t("download.untitled")}</h1>
        <TransferMeta transfer={props.transfer} downloads={props.transfer.owned} />
      </div>
      <Show when={props.transfer.owned}>
        <div class={styles.share}>
          <Input
            aria-label={t("send.link")}
            readonly
            value={link()}
            onFocus={(event) => event.currentTarget.select()}
          />
          <CopyButton text={link()} />
        </div>
      </Show>
      <Show when={props.transfer.message}>{(message) => <p class={styles.message}>{message()}</p>}</Show>
      <div class={styles.tree}>
        <FolderView folder={buildTree(props.transfer.files)} fileUrl={fileUrl} />
      </div>
      <LinkButton
        variant="primary"
        block
        icon="download"
        href={only() ? fileUrl(only()!) : `${base()}/zip`}
        target="_self"
        download
      >
        {only() ? t("download.one") : t("download.all")}
      </LinkButton>
    </Panel>
  );
}

function FolderView(props: { folder: Folder; fileUrl: (file: TransferFile) => string }) {
  return (
    <ul>
      <For each={[...props.folder.folders.values()]}>
        {(child) => (
          <li>
            <details open>
              <summary class={styles.folder}>
                <Icon name="nav-arrow-right" class="caret" />
                <Icon name="folder" />
                <span class="truncate">{child.name}</span>
              </summary>
              <FolderView folder={child} fileUrl={props.fileUrl} />
            </details>
          </li>
        )}
      </For>
      <For each={props.folder.files}>
        {(file) => (
          <li>
            <FileRow name={file.path.split("/").at(-1)!} meta={formatBytes(file.size)} href={props.fileUrl(file)} />
          </li>
        )}
      </For>
    </ul>
  );
}

function Unlock(props: { id: string; onUnlocked: () => void }) {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<unknown>();
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(undefined);
    try {
      await unwrap(api.transfers({ id: props.id }).unlock.post({ password: password() }));
      props.onUnlocked();
    } catch (failure) {
      setError(failure);
    }
  };
  return (
    <Panel centered>
      <Icon name="lock" class={styles.lock} />
      <h1>{t("download.lockedTitle")}</h1>
      <form class={styles.unlock} onSubmit={submit}>
        <Input
          aria-label={t("download.password")}
          placeholder={t("download.password")}
          type="password"
          autocomplete="current-password"
          required
          autofocus
          value={password()}
          onInput={(event) => setPassword(event.currentTarget.value)}
        />
        <Show when={error()}>{(failure) => <ErrorText error={failure()} />}</Show>
        <Button type="submit" variant="primary" block>
          {t("download.unlock")}
        </Button>
      </form>
    </Panel>
  );
}
