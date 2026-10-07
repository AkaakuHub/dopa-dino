import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  publicDir: "dist",
  plugins: [cloudflare({ types: { generate: false } })],
});
