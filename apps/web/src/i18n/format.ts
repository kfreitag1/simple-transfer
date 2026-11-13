import { locale } from "./index.ts";

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"];

function formatScaled(amount: number, suffix = ""): string {
  let value = amount;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  // A fixed one decimal above bytes: a width that changes as the digits do makes live numbers jump
  const digits = unit === 0 ? 0 : 1;
  return new Intl.NumberFormat(locale(), {
    style: "unit",
    unit: BYTE_UNITS[unit] + suffix,
    unitDisplay: "short",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Decimal units (1 kB = 1000 B), as most file managers show them */
export const formatBytes = (bytes: number) => formatScaled(bytes);

/** A transfer speed: "12.5 MB/s" */
export const formatRate = (bytesPerSecond: number) => formatScaled(bytesPerSecond, "-per-second");

export const formatDate = (ms: number) =>
  new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(ms);

export const formatNumber = (value: number) => new Intl.NumberFormat(locale()).format(value);

export const formatPercent = (fraction: number) =>
  new Intl.NumberFormat(locale(), { style: "percent" }).format(fraction);

const DURATION_UNITS = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
] as const;

/** In the largest unit that divides evenly: "7 days", "36 hours" */
export function formatDuration(seconds: number): string {
  const [unit, size] = DURATION_UNITS.find(([, size]) => seconds % size === 0)!;
  return new Intl.NumberFormat(locale(), { style: "unit", unit, unitDisplay: "long" }).format(seconds / size);
}

/** Rounded up to one short unit, for estimates: "45 sec", "3 min" */
export function formatApproximate(seconds: number): string {
  const [unit, size] = DURATION_UNITS.findLast(([, size]) => seconds < size * 60) ?? DURATION_UNITS[0];
  return new Intl.NumberFormat(locale(), { style: "unit", unit, unitDisplay: "short" }).format(
    Math.ceil(seconds / size),
  );
}

/** A moment relative to now, in its largest whole unit: "in 3 days", "tomorrow", "2 hours ago" */
export function formatRelative(ms: number): string {
  const seconds = (ms - Date.now()) / 1000;
  const [unit, size] = DURATION_UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? DURATION_UNITS[2];
  return new Intl.RelativeTimeFormat(locale(), { numeric: "auto" }).format(Math.round(seconds / size), unit);
}
