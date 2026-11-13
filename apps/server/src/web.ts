import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";

export const webPlugin = async (webDir: string) =>
  new Elysia({ name: "web" })
    .use(await staticPlugin({ assets: webDir, prefix: "/", alwaysStatic: true }))
    .get("/*", () => Bun.file(`${webDir}/index.html`));
