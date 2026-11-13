import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, For, Show } from "solid-js";
import { t } from "../i18n/index.ts";
import { Button } from "./Button.tsx";
import styles from "./overlays.module.css";

/** A modal. Escape and a click on the backdrop close it; children mount afresh each time it opens */
export function Dialog(props: { open: boolean; title: string; onClose: () => void; children: JSX.Element }) {
  let dialog!: HTMLDialogElement;
  createEffect(
    () => props.open,
    (open) => {
      if (open) dialog.showModal();
      else dialog.close();
    },
  );
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the dialog element handles Escape itself
    <dialog
      ref={(el) => {
        dialog = el;
      }}
      class={styles.dialog}
      onClose={() => props.onClose()}
      onClick={(event) => event.target === dialog && dialog.close()}
    >
      <Show when={props.open}>
        <div class={styles.body}>
          <h2>{props.title}</h2>
          {props.children}
        </div>
      </Show>
    </dialog>
  );
}

type Confirmation = { title: string; body?: string; action: string; danger?: boolean };
type Toast = { id: number; message: string; failure: boolean };

// One of each for the whole app, rendered by <Overlays>, so any handler can call these without wiring
const [confirming, setConfirming] = createSignal<Confirmation & { settle: (confirmed: boolean) => void }>();
const [toasts, setToasts] = createSignal<Toast[]>([]);
let toastId = 0;

/** Asks before something that cannot be undone. `action` labels the confirming button */
export const confirmAction = (confirmation: Confirmation) =>
  new Promise<boolean>((settle) => setConfirming({ ...confirmation, settle }));

/** A brief message that an action happened or, with `failure`, did not */
export function toast(message: string, failure = false) {
  const id = toastId++;
  setToasts((list) => [...list, { id, message, failure }]);
  setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 4000);
}

export function Overlays() {
  const settle = (confirmed: boolean) => {
    confirming()?.settle(confirmed);
    setConfirming(undefined);
  };
  return (
    <>
      <Dialog open={confirming() !== undefined} title={confirming()?.title ?? ""} onClose={() => settle(false)}>
        <Show when={confirming()?.body}>{(body) => <p class="muted">{body()}</p>}</Show>
        <div class={styles.actions}>
          <Button onClick={() => settle(false)}>{t("common.cancel")}</Button>
          <Button variant={confirming()?.danger ? "danger" : "primary"} onClick={() => settle(true)}>
            {confirming()?.action}
          </Button>
        </div>
      </Dialog>
      <div class={styles.toasts} role="status">
        <For each={toasts()}>
          {(item) => <div class={[styles.toast, { [styles.failure!]: item.failure }]}>{item.message}</div>}
        </For>
      </div>
    </>
  );
}
