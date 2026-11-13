import { useLocation, useNavigate } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, Loading, Show, useContext } from "solid-js";
import { api, ConfigContext, unwrap } from "./api.ts";
import { authClient, createSession, type Session, SessionContext } from "./auth.ts";
import { UploadIndicator } from "./components.tsx";
import { t } from "./i18n/index.ts";
import styles from "./Layout.module.css";
import { setTheme, THEMES, theme } from "./theme.ts";
import { Button } from "./ui/Button.tsx";
import { Segmented } from "./ui/Field.tsx";
import { Icon } from "./ui/Icon.tsx";
import { Overlays } from "./ui/overlays.tsx";
import { Empty, Panel } from "./ui/surfaces.tsx";
import { createUploads, UploadsContext } from "./uploads.ts";

const THEME_ICONS = { system: "computer", light: "sun-light", dark: "half-moon" } as const;

export function Layout(props: { children?: JSX.Element }) {
  const session = createSession();
  const uploads = createUploads();
  const config = createMemo(() => unwrap(api.config.get()));
  const name = () => config().settings.branding.name ?? t("app.name");
  // Branding reaches the rest of the app through the document: the title, the icon and the `--brand` token
  createEffect(
    () => ({ ...config().settings.branding, name: name() }),
    (brand) => {
      document.title = brand.name;
      document.querySelector<HTMLLinkElement>("link[rel=icon]")!.href = brand.logo ?? "/favicon.svg";
      if (brand.accent) document.documentElement.style.setProperty("--brand", brand.accent);
      else document.documentElement.style.removeProperty("--brand");
    },
  );
  return (
    <SessionContext value={session}>
      <ConfigContext value={config}>
        <UploadsContext value={uploads}>
          <header class={styles.header}>
            {/* Recipients of a link are not invited further in: without a session the brand goes nowhere. */}
            <a class={styles.brand} href={session() ? "/" : undefined}>
              <Show when={config().settings.branding.logo} fallback={<Icon name="send-diagonal" />}>
                {(logo) => <img src={logo()} alt="" />}
              </Show>
              <span>{name()}</span>
            </a>
            <Show when={session()}>
              {(current) => (
                <>
                  <nav class={styles.nav}>
                    <a href="/">{t("nav.send")}</a>
                    <a href="/transfers">{t("nav.transfers")}</a>
                    <Show when={current().user.role === "admin"}>
                      <a href="/admin">{t("nav.admin")}</a>
                    </Show>
                  </nav>
                  <Account user={current().user} />
                </>
              )}
            </Show>
          </header>
          <main class={styles.main}>
            <Loading fallback={<div class={styles.loading} role="status" aria-label={t("common.loading")} />}>
              {props.children}
            </Loading>
          </main>
          <UploadIndicator />
          <Overlays />
        </UploadsContext>
      </ConfigContext>
    </SessionContext>
  );
}

function Account(props: { user: Session["user"] }) {
  return (
    <>
      <button type="button" class={styles.account} popovertarget="account-menu" aria-label={t("nav.account")}>
        <Show when={props.user.image} fallback={<Icon name="user" />}>
          {(image) => <img src={image()} alt="" />}
        </Show>
      </button>
      <div id="account-menu" class={styles.menu} popover="auto">
        <div class={styles.who}>
          <span class="truncate">{props.user.name}</span>
          <span class="muted small truncate">{props.user.email}</span>
        </div>
        <Segmented
          label={t("theme.label")}
          value={theme()}
          onChange={setTheme}
          options={THEMES.map((value) => ({ value, label: t(`theme.${value}`), icon: THEME_ICONS[value] }))}
        />
        <Button variant="ghost" icon="log-out" onClick={() => authClient.signOut()}>
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  );
}

export function RequireUser(props: { children?: JSX.Element }) {
  const session = useContext(SessionContext);
  const location = useLocation();
  const navigate = useNavigate();
  createEffect(
    () => session() === null,
    (signedOut) => {
      if (signedOut) {
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?next=${next}`, { replace: true });
      }
    },
  );
  return <Show when={session()}>{props.children}</Show>;
}

export function NotFound() {
  return (
    <Panel>
      <Empty icon="file-not-found" title={t("errors.not-found")} />
    </Panel>
  );
}
