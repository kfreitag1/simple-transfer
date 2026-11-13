import { MAX_PATH_LENGTH } from "./constants.ts";

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it rejects
const FORBIDDEN = /[\u0000-\u001f\u007f\\]/;

export function normalizePath(path: string): string | undefined {
  const normalized = path.normalize("NFC");
  if (normalized.length > MAX_PATH_LENGTH || FORBIDDEN.test(normalized)) return undefined;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return undefined;
  return normalized;
}
