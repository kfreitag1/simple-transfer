import { createMemo, createSignal } from "solid-js";
import en from "./locales/en.ts";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
type Leaves<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}` }[keyof T & string];

/** Every locale file default-exports a `Dict`, so a missing key is a compile error. */
export type Dict = Widen<typeof en>;
export type Key = Leaves<Dict>;

const loaders = import.meta.glob<Dict>(["./locales/*.ts", "!./locales/en.ts"], { import: "default" });
const file = (locale: string) => `./locales/${locale}.ts`;

export const LOCALES = ["en", ...Object.keys(loaders).map((path) => path.slice("./locales/".length, -".ts".length))];

const STORAGE_KEY = "locale";
const supported = (locale: string | null | undefined) => (locale && LOCALES.includes(locale) ? locale : undefined);
const initial =
  supported(localStorage.getItem(STORAGE_KEY)) ??
  navigator.languages.map((tag) => supported(tag.split("-")[0])).find(Boolean) ??
  "en";

document.documentElement.lang = initial;

const [locale, setLocaleSignal] = createSignal(initial);
const dict = createMemo(() => (locale() === "en" ? en : (loaders[file(locale())]?.() ?? en)));

/** Current locale. Pass it to `Intl.*` formatters; never format numbers, sizes or dates by hand. */
export { locale };

export function setLocale(next: string) {
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
  setLocaleSignal(next);
}

/** Translates `key`, replacing `{name}` placeholders from `params`. Reactive: call it inside JSX. */
export function t(key: Key, params?: Record<string, string | number>): string {
  let value: unknown = dict();
  for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
  return (value as string).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ""));
}
