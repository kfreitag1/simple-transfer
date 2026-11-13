import type { JSX } from "@solidjs/web";
import { createUniqueId } from "solid-js";
import styles from "./Tooltip.module.css";

/** How long a tooltip waits before showing when none has been showing lately (hover intent) */
const OPEN_DELAY = 500;
/** Grace period on the way out, so the pointer can cross the gap between an anchor and its tooltip */
const CLOSE_DELAY = 80;
/** How long after one closes the next opens immediately */
const WARM_MS = 500;

// Shared by every tooltip: `shown` hides whichever is open, so moving between anchors never leaves two
let shown: (() => void) | undefined;
let closedAt = 0;
const warm = () => shown !== undefined || Date.now() - closedAt < WARM_MS;

/**
 * Shows `text` above its child on hover and keyboard focus. Purely visual: the child needs its
 * own accessible name. Positioned with CSS anchor positioning in the top layer, so it is never clipped
 */
export function Tooltip(props: { text: string; children: JSX.Element }) {
  const anchor = `--tip-${createUniqueId().replace(/\W/g, "")}`;
  let tip!: HTMLSpanElement;
  let opening: ReturnType<typeof setTimeout> | undefined;
  let closing: ReturnType<typeof setTimeout> | undefined;

  function reveal() {
    shown = dismiss;
    tip.showPopover();
  }

  function dismiss() {
    clearTimeout(opening);
    clearTimeout(closing);
    tip.hidePopover();
    if (shown === dismiss) {
      shown = undefined;
      closedAt = Date.now();
    }
  }

  const enter = () => {
    clearTimeout(opening);
    clearTimeout(closing);
    if (shown !== dismiss) shown?.();
    if (warm()) reveal();
    else opening = setTimeout(reveal, OPEN_DELAY);
  };
  const leave = () => {
    clearTimeout(opening);
    clearTimeout(closing);
    closing = setTimeout(dismiss, CLOSE_DELAY);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: listens for its child's events; it is not a control itself
    <span
      class={styles.anchor}
      style={`anchor-name: ${anchor}`}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocusIn={enter}
      onFocusOut={leave}
      onKeyDown={(event) => event.key === "Escape" && dismiss()}
    >
      {props.children}
      <span
        ref={(el) => {
          tip = el;
        }}
        class={styles.tooltip}
        style={`position-anchor: ${anchor}`}
        popover="manual"
        aria-hidden="true"
      >
        {props.text}
      </span>
    </span>
  );
}

/**
 * Marks its text as having an explanation: a dotted underline, drawn under the descenders, that
 * opens the tooltip on hover or keyboard focus
 */
export function Hinted(props: { text: string; children: JSX.Element }) {
  return (
    <Tooltip text={props.text}>
      <span class={styles.hinted} tabindex={0}>
        {props.children}
      </span>
    </Tooltip>
  );
}
