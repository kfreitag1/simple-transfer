import type { Accent } from "@st/shared/contract";

export type AccentScheme = "light" | "dark";

/** The OKLCH lightness range the automatic counterpart is clamped into */
const AUTO_CLAMP = { light: "min(l, 0.55)", dark: "max(l, 0.8)" } as const;

/** A CSS colour expression for the automatic counterpart of an explicit accent */
const autoColor = (hex: string, scheme: AccentScheme) => `oklch(from ${hex} ${AUTO_CLAMP[scheme]} c h)`;

let colorContext: CanvasRenderingContext2D | undefined;

/** Uses the browser's colour engine: a canvas resolves any CSS colour to `#rrggbb` in sRGB */
function toHex(color: string): string {
  if (!colorContext) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    colorContext = canvas.getContext("2d")!;
  }
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorContext.getImageData(0, 0, 1, 1).data;
  return `#${[r!, g!, b!].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** The accent with nothing set is the theme's text colour, which only the DOM can resolve */
function defaultAccent(scheme: AccentScheme): string {
  const probe = document.createElement("span");
  probe.style.colorScheme = scheme;
  probe.style.color = "var(--fg)";
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return toHex(color);
}

/** Both accents as `#rrggbb`, deriving an unset side from the other (see "Instance settings" in ARCHITECTURE.md) */
export function accentColors(accent: Accent): Record<AccentScheme, string> {
  return {
    light: accent.light ?? (accent.dark ? toHex(autoColor(accent.dark, "light")) : defaultAccent("light")),
    dark: accent.dark ?? (accent.light ? toHex(autoColor(accent.light, "dark")) : defaultAccent("dark")),
  };
}
