import { useParams } from "@solidjs/router";
import { type Transfer, type TransferFile, transferPath } from "@st/shared/contract";
import { createMemo, createSignal, Errored, For, Show, useContext } from "solid-js";
import { api, errorCode, isLocked, shareUrl, unwrap } from "../api.ts";
import { CopyButton, ErrorText, FileRow, ReAddFiles, TransferMeta } from "../components.tsx";
import { createFileDrop, type OnPick, type Picked } from "../file-drop.tsx";
import { matchFiles, missingFiles } from "../files.ts";
import { formatApproximate, formatBytes, formatPercent, formatRate } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { displayFileCount, displayName, packageRootOf } from "../packages.ts";
import { buildTree, type Folder } from "../tree.ts";
import { Button, LinkButton } from "../ui/Button.tsx";
import { Input } from "../ui/Field.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Empty, Panel } from "../ui/surfaces.tsx";
import { type Upload, UploadsContext } from "../uploads.ts";
import styles from "./Transfer.module.css";

/** Everything about one transfer: its download, or its upload while it is still incomplete */
export default function TransferPage() {
  const params = useParams();
  const uploads = useContext(UploadsContext);
  const id = () => params.id!;
  const fetched = createMemo(() => unwrap(api.transfers({ id: id() }).get()));
  // Only this transfer's live upload, so another one running in the background cannot stand in for it
  const live = createMemo(() => uploads.get(id()));
  /** While bytes are still moving (or interrupted); once done, its copy is newer than the fetched one */
  const inFlight = createMemo(() => (live()?.phase() === "done" ? undefined : live()));

  return (
    <Errored
      fallback={(error, reset) => (
        <Show
          when={isLocked(error())}
          fallback={
            <Panel>
              <Empty icon="file-not-found" title={t(`errors.${errorCode(error())}`)} />
            </Panel>
          }
        >
          <Unlock id={id()} onUnlocked={reset} />
        </Show>
      )}
    >
      <Show when={inFlight()} fallback={<TransferBody transfer={live()?.transfer() ?? fetched()} />}>
        {(upload) => <UploadProgress upload={upload()} />}
      </Show>
    </Errored>
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
  /** Only the files that still lack bytes; finished ones are never asked for again */
  const needed = createMemo(() =>
    props.transfer.files.filter((file) => file.offset < file.size).sort((a, b) => a.path.localeCompare(b.path)),
  );
  const matched = createMemo(() => matchFiles(needed(), picked()));
  const missing = createMemo(() => missingFiles(needed(), matched()));
  const add: OnPick = (more) => setPicked((list) => [...list, ...more]);
  const dragging = createFileDrop(add);

  return (
    <Panel highlight={dragging()}>
      <div class={styles.heading}>
        <h1>{props.transfer.title ?? t("send.resumeTitle")}</h1>
        <TransferMeta transfer={props.transfer} />
      </div>
      <ReAddFiles needed={needed()} missing={missing()} hint={t("send.resumeHint")} dragging={dragging()} onPick={add}>
        <Button
          variant="primary"
          block
          disabled={missing().length > 0}
          onClick={() => uploads.start(props.transfer, matched())}
        >
          {t("send.resume")}
        </Button>
      </ReAddFiles>
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
  const zipUrl = (path?: string) => `${base()}/zip${path === undefined ? "" : `?path=${encodeURIComponent(path)}`}`;
  /** A lone file downloads as itself, a lone package as its own zip, anything more as one zip */
  const primary = () => {
    const files = props.transfer.files;
    if (displayFileCount(files) > 1) return { href: zipUrl(), label: t("download.all") };
    const root = packageRootOf(files[0]!.path);
    return { href: root === undefined ? fileUrl(files[0]!) : zipUrl(root), label: t("download.one") };
  };
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
        <FolderView folder={buildTree(props.transfer.files)} fileUrl={fileUrl} zipUrl={zipUrl} />
      </div>
      <LinkButton variant="primary" block icon="download" href={primary().href} target="_self" download>
        {primary().label}
      </LinkButton>
    </Panel>
  );
}

function FolderView(props: {
  folder: Folder;
  fileUrl: (file: TransferFile) => string;
  zipUrl: (path: string) => string;
}) {
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
              <FolderView folder={child} fileUrl={props.fileUrl} zipUrl={props.zipUrl} />
            </details>
          </li>
        )}
      </For>
      <For each={[...props.folder.packages.values()]}>
        {(pkg) => (
          <li>
            <FileRow name={pkg.name} meta={formatBytes(pkg.size)} href={props.zipUrl(pkg.path)} />
          </li>
        )}
      </For>
      <For each={props.folder.files}>
        {(file) => (
          <li>
            <FileRow name={displayName(file.path)} meta={formatBytes(file.size)} href={props.fileUrl(file)} />
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
