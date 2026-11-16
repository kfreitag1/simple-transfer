import { useNavigate } from "@solidjs/router";
import { MAX_MESSAGE_LENGTH, MAX_PASSWORD_LENGTH, MAX_TITLE_LENGTH } from "@st/shared/constants";
import type { TransferCreate } from "@st/shared/contract";
import type { ErrorCode } from "@st/shared/errors";
import { checkTransfer } from "@st/shared/limits";
import { normalizePath } from "@st/shared/paths";
import { createMemo, createSignal, For, Match, Show, Switch, useContext } from "solid-js";
import { api, unwrap } from "../api.ts";
import { ErrorText, FileRow, Meta, ReAddFiles, Stat, Usage } from "../components.tsx";
import { DraftContext } from "../drafts.ts";
import { createFileDrop, DropZone, PickButtons } from "../file-drop.tsx";
import { formatBytes, formatDuration, formatNumber } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { displayFileCount, displayName } from "../packages.ts";
import { Button, IconButton } from "../ui/Button.tsx";
import { Input, Select, Textarea } from "../ui/Field.tsx";
import { Icon } from "../ui/Icon.tsx";
import { confirmAction, toast } from "../ui/overlays.tsx";
import { Panel } from "../ui/surfaces.tsx";
import { UploadsContext } from "../uploads.ts";
import styles from "./Send.module.css";

const EXPIRY_PRESETS = [3600, 86_400, 3 * 86_400, 7 * 86_400, 14 * 86_400, 30 * 86_400];

export default function Send() {
  const navigate = useNavigate();
  const uploads = useContext(UploadsContext);
  const draft = useContext(DraftContext);
  const me = createMemo(() => unwrap(api.me.get()));
  const [error, setError] = createSignal<unknown>();

  const expiryOptions = createMemo(() => {
    const { maxExpirySeconds: max, defaultExpirySeconds: fallback } = me().limits;
    const options = EXPIRY_PRESETS.filter((seconds) => max === null || seconds <= max);
    if (fallback !== null && !options.includes(fallback)) options.push(fallback);
    return options.sort((a, b) => a - b);
  });
  const selectedExpiry = () => draft.expiry() ?? String(me().limits.defaultExpirySeconds ?? "never");
  const input = (): TransferCreate => ({
    title: draft.title() || undefined,
    message: draft.message() || undefined,
    password: draft.password() || undefined,
    expiresIn: selectedExpiry() === "never" ? null : Number(selectedExpiry()),
    files: draft.files().map((entry) => ({ path: entry.path, size: entry.file.size })),
  });
  const totalBytes = () => draft.files().reduce((sum, entry) => sum + entry.file.size, 0);
  const problem = createMemo((): ErrorCode | undefined => {
    if (draft.files().length === 0) return undefined;
    const paths = draft.files().map((entry) => normalizePath(entry.path));
    if (paths.includes(undefined) || new Set(paths).size !== paths.length) return "invalid-path";
    return checkTransfer(input(), me());
  });
  /** What the list shows: loose files, and each top-level folder or package as one row */
  const entries = createMemo(() => {
    const rows = new Map<string, { key: string; name: string; folder: boolean; size: number }>();
    for (const { path, file } of draft.files()) {
      const key = path.split("/")[0]!;
      const folder = path.includes("/");
      const row = rows.get(key) ?? { key, name: folder ? key : displayName(key), folder, size: 0 };
      row.size += file.size;
      rows.set(key, row);
    }
    return [...rows.values()];
  });

  const cancelDraft = async () => {
    const confirmed = await confirmAction({
      title: t("send.discardDraftTitle"),
      body: t("send.discardDraftBody"),
      action: t("common.discard"),
      danger: true,
    });
    if (!confirmed) return;
    draft.clear();
    toast(t("send.draftDiscarded"));
  };
  const dragging = createFileDrop(draft.add);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(undefined);
    try {
      const created = await unwrap(api.transfers.post(input()));
      const files = new Map(draft.files().map((entry) => [normalizePath(entry.path)!, entry.file]));
      draft.clear();
      uploads.start(created, files);
      navigate(`/${encodeURIComponent(created.id)}`);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Panel highlight={dragging()}>
      <Switch fallback={<DropZone title={t("send.drop")} dragging={dragging()} onPick={draft.add} />}>
        <Match when={draft.missing().length > 0}>
          <ReAddFiles
            needed={draft.entries()}
            missing={draft.missing()}
            hint={t("send.reAddFiles")}
            dragging={dragging()}
            onPick={draft.add}
            onRemove={draft.remove}
          >
            <Button variant="ghost" block icon="trash" onClick={cancelDraft}>
              {t("send.cancelDraft")}
            </Button>
          </ReAddFiles>
        </Match>
        <Match when={draft.files().length > 0}>
          <form class="stack" onSubmit={submit}>
            <div>
              <div class={styles.files}>
                <For each={entries()}>
                  {(entry) => (
                    <FileRow name={entry.name} folder={entry.folder} meta={formatBytes(entry.size)}>
                      <IconButton
                        icon="xmark"
                        size="sm"
                        label={t("send.remove")}
                        onClick={() => draft.remove(entry.key)}
                      />
                    </FileRow>
                  )}
                </For>
              </div>
              <div class={styles.summary}>
                <Meta>
                  <Stat
                    icon="multiple-pages"
                    label={t("common.files")}
                    value={formatNumber(displayFileCount(draft.files()))}
                  />
                  <span>{formatBytes(totalBytes())}</span>
                </Meta>
                <PickButtons compact onPick={draft.add} />
              </div>
            </div>
            <Input
              label={t("send.titleLabel")}
              value={draft.title()}
              onInput={(event) => draft.setTitle(event.currentTarget.value)}
              maxlength={MAX_TITLE_LENGTH}
            />
            <Textarea
              label={t("send.messageLabel")}
              value={draft.message()}
              onInput={(event) => draft.setMessage(event.currentTarget.value)}
              rows={2}
              maxlength={MAX_MESSAGE_LENGTH}
            />
            <details class={styles.options}>
              <summary>
                <Icon name="nav-arrow-right" class="caret" />
                {t("send.options")}
                <span class={styles.chosen}>
                  <Show when={draft.password()}>
                    <Icon name="lock" />
                  </Show>
                  {selectedExpiry() === "never" ? t("common.noExpiry") : formatDuration(Number(selectedExpiry()))}
                </span>
              </summary>
              <div class={styles.columns}>
                <Select
                  label={t("send.expiryLabel")}
                  value={selectedExpiry()}
                  onChange={(event) => draft.setExpiry(event.currentTarget.value)}
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
                  value={draft.password()}
                  onInput={(event) => draft.setPassword(event.currentTarget.value)}
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
        </Match>
      </Switch>
    </Panel>
  );
}
