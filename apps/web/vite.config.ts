import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  // The UI relies on current CSS (anchor positioning, light-dark(), relative colours)
  build: { target: "esnext" },
  server: { proxy: { "/api": "http://localhost:3000" } },
});
