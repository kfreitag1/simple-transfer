import type { Settings } from "@st/shared/contract";
import type { Context } from "./app.ts";
import { settings } from "./db/schema.ts";

export function getSettings(ctx: Context): Settings {
  const row = ctx.db.select().from(settings).get();
  return {
    branding: { name: row?.name ?? null, accent: row?.accent ?? null, logo: row?.logo ?? null },
    updateCheck: row?.updateCheck ?? true,
  };
}

export function setSettings(ctx: Context, { branding, updateCheck }: Settings): void {
  const values = { name: branding.name, accent: branding.accent, logo: branding.logo, updateCheck };
  ctx.db
    .insert(settings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values })
    .run();
}
