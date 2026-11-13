import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";

/** Serves the built web app, falling back to `index.html` so client-side routes survive a reload. */
export const webPlugin = async (webDir: string) =>
  new Elysia({ name: "web" })
    .use(await staticPlugin({ assets: webDir, prefix: "/", alwaysStatic: true }))
    .get("/*", () => Bun.file(`${webDir}/index.html`));
