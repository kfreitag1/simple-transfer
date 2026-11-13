import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, For, omit, Show } from "solid-js";
import styles from "./Field.module.css";
import { Icon, type IconName } from "./Icon.tsx";
import { Hinted } from "./Tooltip.tsx";

/** Without a `label` the control is rendered bare and needs an `aria-label` */
type Labelled = { label?: string; hint?: string };

/** Label and optional hint over any control. `for` is the control's id */
export function Field(props: Labelled & { for: string; children: JSX.Element }) {
  return (
    <Show when={props.label} fallback={props.children}>
      <div class={styles.field}>
        <div class={styles.label}>
          <label for={props.for}>
            <Show when={props.hint} fallback={props.label}>
              {(hint) => <Hinted text={hint()}>{props.label}</Hinted>}
            </Show>
          </label>
        </div>
        {props.children}
      </div>
    </Show>
  );
}

/** `suffix` is a unit shown inside the end of the input */
export function Input(
  props: Labelled & { suffix?: string } & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "id">,
) {
  const id = createUniqueId();
  const rest = omit(props, "label", "hint", "suffix");
  return (
    <Field for={id} label={props.label} hint={props.hint}>
      <Show when={props.suffix} fallback={<input id={id} {...rest} class={styles.control} />}>
        <span class={styles.adorned}>
          <input id={id} {...rest} class={[styles.control, styles.suffixed]} />
          <span>{props.suffix}</span>
        </span>
      </Show>
    </Field>
  );
}

export function Textarea(props: Labelled & Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "class" | "id">) {
  const id = createUniqueId();
  const rest = omit(props, "label", "hint");
  return (
    <Field for={id} label={props.label} hint={props.hint}>
      <textarea id={id} {...rest} class={styles.control} />
    </Field>
  );
}

export function Select(props: Labelled & Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "class" | "id">) {
  const id = createUniqueId();
  const rest = omit(props, "label", "hint", "value", "children");
  let select!: HTMLSelectElement;
  // A select can only take a value that is among its options, so apply it once they have rendered
  createEffect(
    () => props.value,
    (value) => {
      select.value = String(value ?? "");
    },
  );
  return (
    <Field for={id} label={props.label} hint={props.hint}>
      <span class={styles.adorned}>
        <select
          ref={(el) => {
            select = el;
          }}
          id={id}
          {...rest}
          class={styles.control}
        >
          {props.children}
        </select>
        <Icon name="nav-arrow-down" />
      </span>
    </Field>
  );
}

/** A choice between a few options that are all worth seeing at once */
export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
}) {
  const name = createUniqueId();
  return (
    <div class={styles.segmented} role="radiogroup" aria-label={props.label}>
      <For each={props.options}>
        {(option) => (
          <label class={styles.segment}>
            <input
              class="sr-only"
              type="radio"
              name={name}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
            />
            <Show when={option.icon}>{(icon) => <Icon name={icon()} />}</Show>
            {option.label}
          </label>
        )}
      </For>
    </div>
  );
}
