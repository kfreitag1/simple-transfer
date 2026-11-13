type Tree = { readonly [key: string]: string | Tree };

export function translate(dict: Tree, fallback: Tree, key: string, params?: Record<string, string | number>): string {
  const find = (tree: Tree) =>
    key
      .split(".")
      .reduce<string | Tree | undefined>((node, part) => (typeof node === "object" ? node[part] : undefined), tree);
  const value = find(dict) ?? find(fallback);
  const template = typeof value === "string" ? value : key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ""));
}

export function pickLocale(supported: readonly string[], stored: string | null, languages: readonly string[]): string {
  if (stored && supported.includes(stored)) return stored;
  return languages.map((tag) => tag.split("-")[0]!).find((base) => supported.includes(base)) ?? "en";
}
