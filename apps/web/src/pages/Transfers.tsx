import type { TransferSummary } from "@st/shared/contract";
import { createMemo, For, refresh, Show, useContext } from "solid-js";
import { api, shareUrl, unwrap } from "../api.ts";
import { CopyButton, TransferMeta, toastError, Usage } from "../components.tsx";
import { t } from "../i18n/index.ts";
import { IconButton, LinkButton } from "../ui/Button.tsx";
import { confirmAction, toast } from "../ui/overlays.tsx";
import { Empty, Page } from "../ui/surfaces.tsx";
import { UploadsContext } from "../uploads.ts";
import styles from "./Transfers.module.css";

export default function Transfers() {
  const uploads = useContext(UploadsContext);
  const transfers = createMemo(() => unwrap(api.transfers.get()));
  const me = createMemo(() => unwrap(api.me.get()));
  const remove = async (transfer: TransferSummary) => {
    const confirmed = await confirmAction({
      title: t("transfers.deleteTitle"),
      body: t("transfers.deleteBody"),
      action: t("common.delete"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await unwrap(api.transfers({ id: transfer.id }).delete());
      uploads.get(transfer.id)?.clear();
      toast(t("transfers.deleted"));
    } catch (failure) {
      toastError(failure);
    }
    refresh(transfers);
    refresh(me);
  };

  return (
    <Page title={t("transfers.title")} aside={<Usage me={me()} />}>
      <Show
        when={transfers().length > 0}
        fallback={
          <Empty icon="send-diagonal" title={t("transfers.empty")}>
            <LinkButton variant="primary" href="/">
              {t("nav.send")}
            </LinkButton>
          </Empty>
        }
      >
        <ul class={styles.list}>
          <For each={transfers()}>
            {(transfer) => (
              <li class={styles.item}>
                <a class={styles.main} href={`/${encodeURIComponent(transfer.id)}`}>
                  <span class={[styles.title, "truncate"]}>{transfer.title ?? transfer.id}</span>
                  <TransferMeta transfer={transfer} downloads />
                </a>
                <div class={styles.actions}>
                  <Show when={transfer.status === "ready"}>
                    <CopyButton text={shareUrl(transfer.id)} />
                  </Show>
                  <IconButton icon="trash" label={t("common.delete")} onClick={() => remove(transfer)} />
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Page>
  );
}
