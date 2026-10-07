import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  publicDir: "dist",
  plugins: [cloudflare({ types: { generate: false } })],
});
