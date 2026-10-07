import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "dopa-dino",
    compatibilityDate: "2026-10-07",
    workersDev: false,
    previewUrls: false,
  },
});
