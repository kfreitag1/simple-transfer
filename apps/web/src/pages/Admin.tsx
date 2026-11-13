import { useSearchParams } from "@solidjs/router";
import { MAX_BRAND_NAME_LENGTH, MAX_LOGO_BYTES, ROLES, type Role } from "@st/shared/constants";
import type { AdminStats, Releases } from "@st/shared/contract";
import type { LimitOverride, LimitScope, Limits } from "@st/shared/limits";
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Match,
  refresh,
  Show,
  Switch,
  untrack,
  useContext,
} from "solid-js";
import { api, ConfigContext, shareUrl, unwrap } from "../api.ts";
import { authClient, SessionContext } from "../auth.ts";
import { ErrorText, Expiry, toastError } from "../components.tsx";
import { formatBytes, formatDuration, formatNumber } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { theme } from "../theme.ts";
import { Button, IconButton } from "../ui/Button.tsx";
import { Field, Input, Segmented, Select } from "../ui/Field.tsx";
import { Icon } from "../ui/Icon.tsx";
import { confirmAction, Dialog, toast } from "../ui/overlays.tsx";
import { Empty, Page, Panel } from "../ui/surfaces.tsx";
import { Hinted } from "../ui/Tooltip.tsx";
import styles from "./Admin.module.css";

type User = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null };

/** The default tab comes first and has no `?tab=` */
const TABS = ["users", "transfers", "limits", "instance", "releases"] as const;

/** Limit keys with the unit they are edited in: bytes in GB, seconds in days */
const FIELDS = [
  ["maxTransferBytes", 1e9],
  ["quotaBytes", 1e9],
  ["maxExpirySeconds", 86_400],
  ["defaultExpirySeconds", 86_400],
] as const satisfies readonly (readonly [keyof Limits, number])[];

const isBytes = (key: keyof Limits) => key.endsWith("Bytes");
const formatLimit = (key: keyof Limits, value: number | null | undefined) =>
  value === undefined
    ? t("admin.inherit")
    : value === null
      ? t("common.unlimited")
      : isBytes(key)
        ? formatBytes(value)
        : formatDuration(value);

export default function Admin() {
  const session = useContext(SessionContext);
  return (
    <Show
      when={session()?.user.role === "admin"}
      fallback={
        <Panel>
          <Empty icon="prohibition" title={t("errors.forbidden")} />
        </Panel>
      }
    >
      <AdminPage />
    </Show>
  );
}

function AdminPage() {
  const config = useContext(ConfigContext);
  const [search] = useSearchParams();
  const tab = () => TABS.find((name) => name === search.tab) ?? TABS[0];
  const stats = createMemo(() => unwrap(api.admin.stats.get()));
  const releases = createMemo(() => unwrap(api.admin.releases.get()));
  const users = createMemo(async (): Promise<User[]> => {
    const { data, error } = await authClient.admin.listUsers({ query: { limit: 10_000, sortBy: "createdAt" } });
    if (error) throw error;
    return data.users;
  });
  return (
    <Page title={t("admin.title")} aside={<Stats stats={stats()} />}>
      <nav class={styles.tabs}>
        <For each={TABS}>
          {(name) => (
            <a href={name === TABS[0] ? "/admin" : `/admin?tab=${name}`}>
              <Show when={name === "releases" && releases().update}>
                {(update) => (
                  <>
                    <span class={styles.dot} aria-hidden="true" />
                    <span class="sr-only">{t("updates.available", { version: update().latest })}</span>
                  </>
                )}
              </Show>
              {t(`admin.tabs.${name}`)}
            </a>
          )}
        </For>
      </nav>
      <Switch>
        <Match when={tab() === "users"}>
          <Users users={users()} onChange={() => refresh(users)} />
        </Match>
        <Match when={tab() === "transfers"}>
          <AllTransfers onChange={() => refresh(stats)} />
        </Match>
        <Match when={tab() === "limits"}>
          <LimitSettings users={users()} />
        </Match>
        <Match when={tab() === "instance"}>
          <InstanceSettings />
        </Match>
        <Match when={tab() === "releases"}>
          <ReleasesTab
            releases={releases()}
            onSaved={() => {
              refresh(releases);
              refresh(config);
            }}
          />
        </Match>
      </Switch>
    </Page>
  );
}

function Stats(props: { stats: AdminStats }) {
  return (
    <dl class={styles.stats}>
      <div>
        <dt>{t("admin.users")}</dt>
        <dd>{formatNumber(props.stats.users)}</dd>
      </div>
      <div>
        <dt>{t("admin.transfers")}</dt>
        <dd>{formatNumber(props.stats.transfers)}</dd>
      </div>
      <div>
        <dt>{t("admin.storage")}</dt>
        <dd>{formatBytes(props.stats.bytes)}</dd>
      </div>
    </dl>
  );
}

function Users(props: { users: User[]; onChange: () => void }) {
  const session = useContext(SessionContext);
  const isSelf = (user: User) => user.id === session()?.user.id;
  const act = async (request: Promise<{ error: unknown }>) => {
    const { error } = await request;
    if (error) toastError(error);
    props.onChange();
  };
  const ban = async (user: User) => {
    const confirmed = await confirmAction({
      title: t("admin.banTitle", { user: user.name }),
      body: t("admin.banBody"),
      action: t("admin.ban"),
      danger: true,
    });
    if (confirmed) act(authClient.admin.banUser({ userId: user.id }));
  };

  return (
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>{t("admin.name")}</th>
            <th>{t("admin.role")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <For each={props.users}>
            {(user) => (
              <tr class={{ [styles.banned!]: !!user.banned }}>
                <td>
                  <div>{user.name}</div>
                  <div class="muted small">
                    {user.email}
                    <Show when={user.banned}> · {t("admin.banned")}</Show>
                  </div>
                </td>
                <td class={styles.controls}>
                  <div class={styles.role}>
                    <Select
                      aria-label={t("admin.role")}
                      disabled={isSelf(user)}
                      value={user.role ?? "user"}
                      onChange={(event) =>
                        act(authClient.admin.setRole({ userId: user.id, role: event.currentTarget.value as Role }))
                      }
                    >
                      <For each={ROLES}>{(role) => <option value={role}>{t(`admin.roles.${role}`)}</option>}</For>
                    </Select>
                  </div>
                </td>
                <td class={styles.controls}>
                  <div>
                    <Show
                      when={user.banned}
                      fallback={
                        <IconButton
                          icon="prohibition"
                          label={t("admin.ban")}
                          disabled={isSelf(user)}
                          onClick={() => ban(user)}
                        />
                      }
                    >
                      <IconButton
                        icon="undo"
                        label={t("admin.unban")}
                        onClick={() => act(authClient.admin.unbanUser({ userId: user.id }))}
                      />
                    </Show>
                  </div>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

function AllTransfers(props: { onChange: () => void }) {
  const transfers = createMemo(() => unwrap(api.admin.transfers.get()));
  const remove = async (id: string) => {
    const confirmed = await confirmAction({
      title: t("transfers.deleteTitle"),
      body: t("transfers.deleteBody"),
      action: t("common.delete"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await unwrap(api.transfers({ id }).delete());
      toast(t("transfers.deleted"));
    } catch (failure) {
      toastError(failure);
    }
    refresh(transfers);
    props.onChange();
  };

  return (
    <Show when={transfers().length > 0} fallback={<Empty icon="send-diagonal" title={t("transfers.empty")} />}>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>{t("transfers.name")}</th>
              <th>{t("admin.owner")}</th>
              <th>{t("transfers.size")}</th>
              <th>{t("common.downloads")}</th>
              <th>{t("transfers.expires")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={transfers()}>
              {(transfer) => (
                <tr>
                  <td>
                    <a href={shareUrl(transfer.id)}>{transfer.title ?? transfer.id}</a>
                    <Show when={transfer.status === "uploading"}>
                      <div class="muted small">{t("transfers.incomplete")}</div>
                    </Show>
                  </td>
                  <td>{transfer.owner.email}</td>
                  <td>{formatBytes(transfer.size)}</td>
                  <td>{formatNumber(transfer.downloads)}</td>
                  <td>
                    <Expiry at={transfer.expiresAt} bare />
                  </td>
                  <td class={styles.controls}>
                    <div>
                      <IconButton icon="trash" label={t("common.delete")} onClick={() => remove(transfer.id)} />
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </Show>
  );
}

/** Shown when no global limits are stored yet: everything inherits the unlimited defaults */
const NO_GLOBAL: LimitOverride = { scope: "global", subject: "", values: {} };

function LimitSettings(props: { users: User[] }) {
  const stored = createMemo(() => unwrap(api.admin.limits.get()));
  const global = createMemo(() => stored().find((row) => row.scope === "global") ?? NO_GLOBAL);
  const overrides = createMemo(() => stored().filter((row) => row.scope !== "global"));
  const [editing, setEditing] = createSignal<LimitOverride>();
  const saved = () => {
    setEditing(undefined);
    refresh(stored);
    toast(t("common.saved"));
  };
  const remove = async (override: LimitOverride) => {
    if (!(await confirmAction({ title: t("admin.deleteOverride"), action: t("common.delete"), danger: true }))) return;
    try {
      await unwrap(api.admin.limits.put({ ...override, values: {} }));
    } catch (failure) {
      toastError(failure);
    }
    refresh(stored);
  };
  const label = (override: LimitOverride) =>
    override.scope === "role"
      ? t("admin.scopeRole", { role: t(`admin.roles.${override.subject as Role}`) })
      : t("admin.scopeUser", { user: props.users.find((u) => u.id === override.subject)?.email ?? override.subject });

  return (
    <div class={styles.sections}>
      <section class="stack">
        <div class={styles.sectionHeader}>
          <h2>
            <Hinted text={t("admin.limitsHint")}>{t("admin.everyone")}</Hinted>
          </h2>
        </div>
        <Show when={global()} keyed>
          {(initial) => <LimitEditor initial={initial} users={props.users} onSaved={saved} />}
        </Show>
      </section>
      <section class="stack">
        <div class={styles.sectionHeader}>
          <h2>
            <Hinted text={t("admin.overridesHint")}>{t("admin.overrides")}</Hinted>
          </h2>
          <Button size="sm" icon="plus" onClick={() => setEditing({ scope: "role", subject: "user", values: {} })}>
            {t("admin.addOverride")}
          </Button>
        </div>
        <Show when={overrides().length > 0}>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("admin.layer")}</th>
                  <For each={FIELDS}>{([key]) => <th>{t(`admin.fields.${key}`)}</th>}</For>
                  <th />
                </tr>
              </thead>
              <tbody>
                <For each={overrides()}>
                  {(override) => (
                    <tr>
                      <td>{label(override)}</td>
                      <For each={FIELDS}>{([key]) => <td>{formatLimit(key, override.values[key])}</td>}</For>
                      <td class={styles.controls}>
                        <div>
                          <IconButton icon="edit-pencil" label={t("admin.edit")} onClick={() => setEditing(override)} />
                          <IconButton icon="trash" label={t("common.delete")} onClick={() => remove(override)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>
      <Dialog open={editing() !== undefined} title={t("admin.override")} onClose={() => setEditing(undefined)}>
        <Show when={editing()} keyed>
          {(initial) => (
            <LimitEditor initial={initial} users={props.users} onSaved={saved} onCancel={() => setEditing(undefined)} />
          )}
        </Show>
      </Dialog>
    </div>
  );
}

type FieldState = { mode: "inherit" | "unlimited" | "value"; amount: string };

/** Edits the global limits, or an override when `onCancel` is given. Only overrides can inherit */
function LimitEditor(props: { initial: LimitOverride; users: User[]; onSaved: () => void; onCancel?: () => void }) {
  // Remounted (keyed) for each row it edits, so the initial values are read once
  const initial = untrack(() => props.initial);
  const isGlobal = initial.scope === "global";
  const [scope, setScope] = createSignal<LimitScope>(initial.scope);
  const [subject, setSubject] = createSignal(initial.subject);
  const [fields, setFields] = createSignal(
    Object.fromEntries(
      FIELDS.map(([key, unit]) => {
        const value = initial.values[key];
        const state: FieldState =
          value === undefined
            ? { mode: isGlobal ? "unlimited" : "inherit", amount: "" }
            : value === null
              ? { mode: "unlimited", amount: "" }
              : { mode: "value", amount: String(value / unit) };
        return [key, state];
      }),
    ) as Record<keyof Limits, FieldState>,
  );
  const [error, setError] = createSignal<unknown>();
  const update = (key: keyof Limits, patch: Partial<FieldState>) =>
    setFields((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
  const changeScope = (next: LimitScope) => {
    setScope(next);
    setSubject(next === "role" ? "user" : (props.users[0]?.id ?? ""));
  };
  const modes = (): { value: FieldState["mode"]; label: string }[] => [
    ...(isGlobal ? [] : [{ value: "inherit" as const, label: t("admin.inherit") }]),
    { value: "unlimited", label: t("common.unlimited") },
    { value: "value", label: t("admin.custom") },
  ];

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values: LimitOverride["values"] = {};
    for (const [key, unit] of FIELDS) {
      const { mode, amount } = fields()[key];
      if (mode === "unlimited") values[key] = null;
      if (mode === "value") values[key] = Math.max(1, Math.round(Number(amount) * unit));
    }
    setError(undefined);
    try {
      await unwrap(api.admin.limits.put({ scope: scope(), subject: subject(), values }));
      props.onSaved();
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <form class="stack" onSubmit={submit}>
      <Show when={!isGlobal}>
        <div class={styles.columns}>
          <Select
            label={t("admin.layer")}
            value={scope()}
            onChange={(event) => changeScope(event.currentTarget.value as LimitScope)}
          >
            <For each={["role", "user"] as const}>
              {(value) => <option value={value}>{t(`admin.scopes.${value}`)}</option>}
            </For>
          </Select>
          <Show when={scope() === "role"}>
            <Select
              label={t("admin.role")}
              value={subject()}
              onChange={(event) => setSubject(event.currentTarget.value)}
            >
              <For each={ROLES}>{(role) => <option value={role}>{t(`admin.roles.${role}`)}</option>}</For>
            </Select>
          </Show>
          <Show when={scope() === "user"}>
            <Select
              label={t("admin.user")}
              value={subject()}
              onChange={(event) => setSubject(event.currentTarget.value)}
            >
              <For each={props.users}>{(user) => <option value={user.id}>{user.email}</option>}</For>
            </Select>
          </Show>
        </div>
      </Show>
      <div class={styles.limits}>
        <For each={FIELDS}>
          {([key]) => (
            <div class={styles.limit}>
              <span>{t(`admin.fields.${key}`)}</span>
              <Segmented
                label={t(`admin.fields.${key}`)}
                value={fields()[key].mode}
                options={modes()}
                onChange={(mode) => update(key, { mode })}
              />
              <Show when={fields()[key].mode === "value"}>
                <Input
                  aria-label={t(`admin.fields.${key}`)}
                  suffix={t(isBytes(key) ? "admin.gigabytes" : "admin.days")}
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={fields()[key].amount}
                  onInput={(event) => update(key, { amount: event.currentTarget.value })}
                />
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={error()}>{(failure) => <ErrorText error={failure()} />}</Show>
      <div class={styles.formActions}>
        <Show when={props.onCancel}>
          <Button onClick={() => props.onCancel?.()}>{t("common.cancel")}</Button>
        </Show>
        <Button type="submit" variant="primary">
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function InstanceSettings() {
  const config = useContext(ConfigContext);
  const initial = untrack(() => config().settings.branding);
  const [name, setName] = createSignal(initial.name ?? "");
  const [accent, setAccent] = createSignal(initial.accent);
  const [logo, setLogo] = createSignal(initial.logo);
  const accentId = createUniqueId();
  const logoId = createUniqueId();
  let file!: HTMLInputElement;
  /** Without a brand the accent is the text colour (index.css), so the picker starts there. It takes only `#rrggbb` */
  const unbranded = () => {
    theme();
    const [r, g, b] = getComputedStyle(document.body).color.match(/\d+/g)!.map(Number);
    return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, "0")).join("")}`;
  };

  const pickLogo = () => {
    const image = file.files?.[0];
    file.value = "";
    if (!image) return;
    if (image.size > MAX_LOGO_BYTES) {
      toast(t("admin.logoTooLarge", { size: formatBytes(MAX_LOGO_BYTES) }), true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(image);
  };
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    try {
      await unwrap(
        api.admin.settings.put({
          branding: { name: name().trim() || null, accent: accent(), logo: logo() },
          // The whole row is written, so keep the setting this form does not edit
          updateCheck: config().settings.updateCheck,
        }),
      );
      refresh(config);
      toast(t("common.saved"));
    } catch (failure) {
      toastError(failure);
    }
  };

  return (
    <form class={["stack", styles.branding]} onSubmit={submit}>
      <Input
        label={t("admin.brandName")}
        placeholder={t("app.name")}
        value={name()}
        onInput={(event) => setName(event.currentTarget.value)}
        maxlength={MAX_BRAND_NAME_LENGTH}
      />
      <Field for={accentId} label={t("admin.accent")}>
        <div class="row">
          <input
            id={accentId}
            class={styles.swatch}
            type="color"
            value={accent() ?? unbranded()}
            onInput={(event) => setAccent(event.currentTarget.value)}
          />
          <span class="muted small">{accent() ?? t("admin.default")}</span>
          <Show when={accent()}>
            <Button variant="ghost" size="sm" onClick={() => setAccent(null)}>
              {t("admin.reset")}
            </Button>
          </Show>
        </div>
      </Field>
      <Field for={logoId} label={t("admin.logo")} hint={t("admin.logoHint", { size: formatBytes(MAX_LOGO_BYTES) })}>
        <div class="row">
          <span class={styles.logo}>
            <Show when={logo()} fallback={<Icon name="send-diagonal" />}>
              {(source) => <img src={source()} alt="" />}
            </Show>
          </span>
          <input
            ref={(el) => {
              file = el;
            }}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={pickLogo}
          />
          <Button id={logoId} size="sm" icon="upload" onClick={() => file.click()}>
            {t("admin.upload")}
          </Button>
          <Show when={logo()}>
            <Button variant="ghost" size="sm" onClick={() => setLogo(null)}>
              {t("admin.remove")}
            </Button>
          </Show>
        </div>
      </Field>
      <div class={styles.formActions}>
        <Button type="submit" variant="primary">
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

/** What this build contains, whether there is a newer release, and whether to look for one */
function ReleasesTab(props: { releases: Releases; onSaved: () => void }) {
  const config = useContext(ConfigContext);
  const toggle = async (enabled: boolean) => {
    try {
      await unwrap(api.admin.settings.put({ branding: config().settings.branding, updateCheck: enabled }));
      props.onSaved();
    } catch (failure) {
      toastError(failure);
    }
  };

  return (
    <div class="stack">
      <label class={styles.check}>
        <input
          type="checkbox"
          checked={config().settings.updateCheck}
          onChange={(event) => toggle(event.currentTarget.checked)}
        />
        <Hinted text={t("admin.updateCheckHint")}>{t("admin.updateCheck")}</Hinted>
      </label>
      <div class={styles.releaseHead}>
        <Show when={props.releases.update}>
          {(update) => (
            <a class={styles.update} href={update().url} target="_blank" rel="noreferrer">
              {t("updates.available", { version: update().latest })}
            </a>
          )}
        </Show>
        <span class="muted small">{t("admin.version", { version: props.releases.current })}</span>
      </div>
      <Show
        when={props.releases.releases.length > 0}
        fallback={<Empty icon="empty-page" title={t("admin.noReleases")} />}
      >
        <div class={styles.releases}>
          <For each={props.releases.releases}>
            {(release) => (
              <section class={styles.release}>
                <h2>{release.version}</h2>
                <For each={release.changes}>
                  {(group) => (
                    <div>
                      <h3>{group.title}</h3>
                      <ul>
                        <For each={group.items}>{(item) => <li>{item}</li>}</For>
                      </ul>
                    </div>
                  )}
                </For>
              </section>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
