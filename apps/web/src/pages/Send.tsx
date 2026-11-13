import { useNavigate } from "@solidjs/router";
import { MAX_MESSAGE_LENGTH, MAX_PASSWORD_LENGTH, MAX_TITLE_LENGTH } from "@st/shared/constants";
import type { TransferCreate } from "@st/shared/contract";
import type { ErrorCode } from "@st/shared/errors";
import { checkTransfer } from "@st/shared/limits";
import { normalizePath } from "@st/shared/paths";
import { createMemo, createSignal, For, Show, useContext } from "solid-js";
import { api, unwrap } from "../api.ts";
import { ErrorText, FileRow, Meta, Stat, Usage } from "../components.tsx";
import { createFileDrop, DropZone, type OnPick, PickButtons, type Picked } from "../file-drop.tsx";
import { formatBytes, formatDuration, formatNumber } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { Button, IconButton } from "../ui/Button.tsx";
import { Input, Select, Textarea } from "../ui/Field.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Panel } from "../ui/surfaces.tsx";
import { UploadsContext } from "../uploads.ts";
import styles from "./Send.module.css";

const EXPIRY_PRESETS = [3600, 86_400, 3 * 86_400, 7 * 86_400, 14 * 86_400, 30 * 86_400];

export default function Send() {
  const navigate = useNavigate();
  const uploads = useContext(UploadsContext);
  const me = createMemo(() => unwrap(api.me.get()));
  const [picked, setPicked] = createSignal<Picked[]>([]);
  const [title, setTitle] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [expiry, setExpiry] = createSignal<string>();
  const [error, setError] = createSignal<unknown>();

  const expiryOptions = createMemo(() => {
    const { maxExpirySeconds: max, defaultExpirySeconds: fallback } = me().limits;
    const options = EXPIRY_PRESETS.filter((seconds) => max === null || seconds <= max);
    if (fallback !== null && !options.includes(fallback)) options.push(fallback);
    return options.sort((a, b) => a - b);
  });
  const selectedExpiry = () => expiry() ?? String(me().limits.defaultExpirySeconds ?? "never");
  const input = (): TransferCreate => ({
    title: title() || undefined,
    message: message() || undefined,
    password: password() || undefined,
    expiresIn: selectedExpiry() === "never" ? null : Number(selectedExpiry()),
    files: picked().map((entry) => ({ path: entry.path, size: entry.file.size })),
  });
  const totalBytes = () => picked().reduce((sum, entry) => sum + entry.file.size, 0);
  const problem = createMemo((): ErrorCode | undefined => {
    if (picked().length === 0) return undefined;
    const paths = picked().map((entry) => normalizePath(entry.path));
    if (paths.includes(undefined) || new Set(paths).size !== paths.length) return "invalid-path";
    return checkTransfer(input(), me());
  });
  /** What the list shows: loose files, and each top-level folder as one row */
  const entries = createMemo(() => {
    const rows = new Map<string, { name: string; folder: boolean; size: number }>();
    for (const { path, file } of picked()) {
      const name = path.split("/")[0]!;
      const row = rows.get(name) ?? { name, folder: path.includes("/"), size: 0 };
      row.size += file.size;
      rows.set(name, row);
    }
    return [...rows.values()];
  });

  const add: OnPick = (more) =>
    setPicked((list) => [...new Map([...list, ...more].map((entry) => [entry.path, entry])).values()]);
  const remove = (name: string) =>
    setPicked((list) => list.filter((entry) => entry.path !== name && !entry.path.startsWith(`${name}/`)));
  const dragging = createFileDrop(add);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(undefined);
    try {
      const created = await unwrap(api.transfers.post(input()));
      uploads.start(created, new Map(picked().map((entry) => [normalizePath(entry.path)!, entry.file])));
      navigate(`/${encodeURIComponent(created.id)}`);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Panel highlight={dragging()}>
      <Show
        when={picked().length > 0}
        fallback={<DropZone title={t("send.drop")} dragging={dragging()} onPick={add} />}
      >
        <form class="stack" onSubmit={submit}>
          <div>
            <div class={styles.files}>
              <For each={entries()}>
                {(entry) => (
                  <FileRow name={entry.name} icon={entry.folder ? "folder" : undefined} meta={formatBytes(entry.size)}>
                    <IconButton icon="xmark" size="sm" label={t("send.remove")} onClick={() => remove(entry.name)} />
                  </FileRow>
                )}
              </For>
            </div>
            <div class={styles.summary}>
              <Meta>
                <Stat icon="multiple-pages" label={t("common.files")} value={formatNumber(picked().length)} />
                <span>{formatBytes(totalBytes())}</span>
              </Meta>
              <PickButtons compact onPick={add} />
            </div>
          </div>
          <Input
            label={t("send.titleLabel")}
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}
            maxlength={MAX_TITLE_LENGTH}
          />
          <Textarea
            label={t("send.messageLabel")}
            value={message()}
            onInput={(event) => setMessage(event.currentTarget.value)}
            rows={2}
            maxlength={MAX_MESSAGE_LENGTH}
          />
          <details class={styles.options}>
            <summary>
              <Icon name="nav-arrow-right" class="caret" />
              {t("send.options")}
              <span class={styles.chosen}>
                <Show when={password()}>
                  <Icon name="lock" />
                </Show>
                {selectedExpiry() === "never" ? t("common.noExpiry") : formatDuration(Number(selectedExpiry()))}
              </span>
            </summary>
            <div class={styles.columns}>
              <Select
                label={t("send.expiryLabel")}
                value={selectedExpiry()}
                onChange={(event) => setExpiry(event.currentTarget.value)}
              >
                <For each={expiryOptions()}>
                  {(seconds) => <option value={seconds}>{formatDuration(seconds)}</option>}
                </For>
                <Show when={me().limits.maxExpirySeconds === null}>
                  <option value="never">{t("common.never")}</option>
                </Show>
              </Select>
              <Input
                label={t("send.passwordLabel")}
                hint={t("send.passwordHint")}
                type="password"
                autocomplete="new-password"
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                maxlength={MAX_PASSWORD_LENGTH}
              />
            </div>
          </details>
          <Show when={problem() ?? error()}>{(failure) => <ErrorText error={failure()} />}</Show>
          <Button type="submit" variant="primary" block disabled={problem() !== undefined}>
            {t("send.submit")}
          </Button>
          <Usage me={me()} />
        </form>
      </Show>
    </Panel>
  );
}
