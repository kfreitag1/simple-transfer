import { createSignal } from "solid-js";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const root = document.documentElement;
const STORAGE_KEY = "theme";

// index.html has already applied the stored choice to `data-theme`; index.css maps it to `color-scheme`
const [theme, setThemeSignal] = createSignal<Theme>(THEMES.find((name) => name === root.dataset.theme) ?? "system");

export { theme };

export function setTheme(next: Theme) {
  localStorage.setItem(STORAGE_KEY, next);
  root.dataset.theme = next;
  setThemeSignal(next);
}
