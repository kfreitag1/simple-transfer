import type { JSX } from "@solidjs/web";
import { Icon, type IconName } from "./Icon.tsx";
import styles from "./surfaces.module.css";

/** The narrow card that holds one focused task: sign in, send, download */
export function Panel(props: { centered?: boolean; highlight?: boolean; children: JSX.Element }) {
  return (
    <section class={[styles.panel, { [styles.centered!]: !!props.centered, [styles.highlight!]: !!props.highlight }]}>
      {props.children}
    </section>
  );
}

/** The wide layout for lists and settings. `aside` sits opposite the title */
export function Page(props: { title: string; aside?: JSX.Element; children: JSX.Element }) {
  return (
    <section class={styles.page}>
      <header class={styles.pageHeader}>
        <h1>{props.title}</h1>
        {props.aside}
      </header>
      {props.children}
    </section>
  );
}

/** Stands in for content that is absent: an empty list, a missing transfer. Children are the way forward */
export function Empty(props: { icon: IconName; title: string; children?: JSX.Element }) {
  return (
    <div class={styles.empty}>
      <Icon name={props.icon} class={styles.emptyIcon} />
      <p>{props.title}</p>
      {props.children}
    </div>
  );
}
