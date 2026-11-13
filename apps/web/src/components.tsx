// Pieces of this app's own vocabulary, shared between pages. Generic controls live in ./ui

import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import type { Me, TransferSummary } from "@st/shared/contract";
import { createEffect, createSignal, For, Show, useContext } from "solid-js";
import { errorCode } from "./api.ts";
import styles from "./components.module.css";
import { formatBytes, formatDate, formatNumber, formatPercent, formatRelative } from "./i18n/format.ts";
import { t } from "./i18n/index.ts";
import { Button, IconButton } from "./ui/Button.tsx";
import { Icon, type IconName } from "./ui/Icon.tsx";
import { toast } from "./ui/overlays.tsx";
import { Tooltip } from "./ui/Tooltip.tsx";
import { type Upload, UploadsContext } from "./uploads.ts";

export function CopyButton(props: { text: string; primary?: boolean }) {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    await navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const icon = () => (copied() ? "check-circle" : "copy");
  const label = () => (copied() ? t("common.copied") : t("common.copyLink"));
  return (
    <Show when={props.primary} fallback={<IconButton icon={icon()} label={label()} onClick={copy} />}>
      <Button variant="primary" block icon={icon()} onClick={copy}>
        {label()}
      </Button>
    </Show>
  );
}

/** For a failure that belongs to a form */
export function ErrorText(props: { error: unknown }) {
  return (
    <p class={styles.error} role="alert">
      <Icon name="warning-circle" />
      {t(`errors.${errorCode(props.error)}`)}
    </p>
  );
}

/** For a failure of a one-off action, where there is no form to show it in */
export const toastError = (error: unknown) => toast(t(`errors.${errorCode(error)}`), true);

/** Relative, with the exact time on hover. `bare` drops the "Expires" for use under a column heading */
export function Expiry(props: { at: number | null; bare?: boolean }) {
  return (
    <Show when={props.at} fallback={<span>{props.bare ? t("common.never") : t("common.noExpiry")}</span>}>
      {(at) => (
        <Tooltip text={formatDate(at())}>
          <span>{props.bare ? formatRelative(at()) : t("common.expires", { when: formatRelative(at()) })}</span>
        </Tooltip>
      )}
    </Show>
  );
}

/** A dot-separated line of small facts */
export function Meta(props: { children: JSX.Element }) {
  return <div class={styles.meta}>{props.children}</div>;
}

/** A number explained by an icon rather than a word, so it needs no plural form */
export function Stat(props: { icon: IconName; label: string; value: string }) {
  return (
    <Tooltip text={props.label}>
      <span class={styles.stat}>
        <Icon name={props.icon} />
        <span class="sr-only">{props.label}</span>
        {props.value}
      </span>
    </Tooltip>
  );
}

export function TransferMeta(props: { transfer: TransferSummary; downloads?: boolean }) {
  return (
    <Meta>
      <Show when={props.transfer.status === "uploading"}>
        <span class={styles.incomplete}>{t("transfers.incomplete")}</span>
      </Show>
      <Stat icon="multiple-pages" label={t("common.files")} value={formatNumber(props.transfer.fileCount)} />
      <span>{formatBytes(props.transfer.size)}</span>
      <Show when={props.downloads}>
        <Stat icon="download" label={t("common.downloads")} value={formatNumber(props.transfer.downloads)} />
      </Show>
      <Show when={props.transfer.hasPassword}>
        <Stat icon="lock" label={t("common.protected")} value="" />
      </Show>
      <Expiry at={props.transfer.expiresAt} />
    </Meta>
  );
}

/** Storage used against the quota. Nothing when the quota is unlimited */
export function Usage(props: { me: Me }) {
  return (
    <Show when={props.me.limits.quotaBytes}>
      {(quota) => (
        <p class="muted small">
          {t("common.usage", { used: formatBytes(props.me.usedBytes), quota: formatBytes(quota()) })}
        </p>
      )}
    </Show>
  );
}

const FILE_ICONS: [IconName, RegExp][] = [
  ["media-image", /\.(avif|gif|heic|jpe?g|png|svg|webp)$/i],
  ["media-video", /\.(avi|mkv|mov|mp4|webm)$/i],
  ["music-note", /\.(aac|flac|m4a|mp3|ogg|wav)$/i],
  ["archive", /\.(7z|gz|rar|tar|zip)$/i],
];

/** One file or folder in a list. With `href` the whole row downloads it; children are trailing actions */
export function FileRow(props: { name: string; meta: string; icon?: IconName; href?: string; children?: JSX.Element }) {
  const icon = () => props.icon ?? FILE_ICONS.find(([, pattern]) => pattern.test(props.name))?.[0] ?? "empty-page";
  const content = () => (
    <>
      <Icon name={icon()} class={styles.fileIcon} />
      <span class="truncate" title={props.name}>
        {props.name}
      </span>
      <span class={styles.fileEnd}>
        <span class={styles.fileMeta}>{props.meta}</span>
        {props.children}
      </span>
    </>
  );
  return (
    <Show when={props.href} fallback={<div class={styles.file}>{content()}</div>}>
      {(href) => (
        <a class={styles.file} href={href()} target="_self" download>
          {content()}
        </a>
      )}
    </Show>
  );
}

const fractionOf = (upload: Upload) => {
  const { uploadedBytes, totalBytes } = upload.progress();
  return totalBytes === 0 ? 1 : uploadedBytes / totalBytes;
};

/**
 * Every upload still in flight, one row each, anywhere in the app. A row opens that transfer's page
 */
export function UploadIndicator() {
  const uploads = useContext(UploadsContext);
  const location = useLocation();
  const viewing = (id: string) => location.pathname === `/${id}`;
  // The page you are on already accounts for one of them
  const active = () =>
    uploads.list().filter((upload) => ["uploading", "failed"].includes(upload.phase()) && !viewing(upload.id));
  // Saying so is only useful when the user is not already looking at the result
  createEffect(
    () => uploads.finished(),
    (finished) => {
      if (finished && !viewing(finished.id)) toast(t("send.doneFor", { name: finished.name }));
    },
  );

  const state = (upload: Upload) =>
    upload.phase() === "failed" ? t("send.failed") : formatPercent(fractionOf(upload));

  return (
    <Show when={active().length > 0}>
      <aside class={styles.uploads}>
        <For each={active()}>
          {(upload) => (
            <a class={styles.upload} href={`/${encodeURIComponent(upload.id)}`}>
              <span class={styles.uploadHead}>
                <Icon name="upload" />
                <span class="truncate">{upload.name()}</span>
                <span class={styles.uploadState}>{state(upload)}</span>
              </span>
              <span class={[styles.uploadBar, { [styles.failed!]: upload.phase() === "failed" }]}>
                <span style={`--value: ${fractionOf(upload)}`} />
              </span>
            </a>
          )}
        </For>
      </aside>
    </Show>
  );
}
