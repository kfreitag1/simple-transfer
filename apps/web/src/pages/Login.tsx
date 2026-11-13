import { useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, Show, useContext } from "solid-js";
import { ConfigContext } from "../api.ts";
import { SessionContext, signIn } from "../auth.ts";
import { t } from "../i18n/index.ts";
import { Button } from "../ui/Button.tsx";
import styles from "./Login.module.css";

/** Only same-origin paths, so `?next=` cannot be used to redirect elsewhere */
const safeNext = (next: unknown) => (typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/");

export default function Login() {
  const session = useContext(SessionContext);
  const config = useContext(ConfigContext);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  createEffect(
    () => (session() ? safeNext(search.next) : undefined),
    (next) => {
      if (next) navigate(next, { replace: true });
    },
  );
  return (
    <div class={styles.page}>
      <Button variant="primary" onClick={() => signIn(safeNext(search.next))}>
        <Show when={config().providerName} fallback={t("login.button")}>
          {(provider) => t("login.buttonWith", { provider: provider() })}
        </Show>
      </Button>
    </div>
  );
}
