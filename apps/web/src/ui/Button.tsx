import type { JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import styles from "./Button.module.css";
import { Icon, type IconName } from "./Icon.tsx";
import { Tooltip } from "./Tooltip.tsx";

type Look = {
  /** Defaults to `secondary`. One `primary` per view */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
  /** Fill the available width */
  block?: boolean;
  icon?: IconName;
};

const classes = (look: Look, iconOnly = false) => [
  styles.button,
  styles[look.variant ?? "secondary"],
  { [styles.small!]: look.size === "sm", [styles.block!]: !!look.block, [styles.iconOnly!]: iconOnly },
];

function Content(props: { icon?: IconName; children?: JSX.Element }) {
  return (
    <>
      <Show when={props.icon}>{(icon) => <Icon name={icon()} />}</Show>
      {props.children}
    </>
  );
}

export function Button(props: Look & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class">) {
  const rest = omit(props, "variant", "size", "block", "icon", "children");
  return (
    <button type="button" {...rest} class={classes(props)}>
      <Content icon={props.icon}>{props.children}</Content>
    </button>
  );
}

/** A link that looks like a button, for navigation and downloads */
export function LinkButton(props: Look & Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "class">) {
  const rest = omit(props, "variant", "size", "block", "icon", "children");
  return (
    <a {...rest} class={classes(props)}>
      <Content icon={props.icon}>{props.children}</Content>
    </a>
  );
}

/** `label` is both the accessible name and the tooltip */
export function IconButton(
  props: { icon: IconName; label: string; size?: "sm" } & Omit<
    JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    "class" | "children"
  >,
) {
  const rest = omit(props, "icon", "label", "size");
  return (
    <Tooltip text={props.label}>
      <button
        type="button"
        aria-label={props.label}
        {...rest}
        class={classes({ variant: "ghost", size: props.size }, true)}
      >
        <Icon name={props.icon} />
      </button>
    </Tooltip>
  );
}
