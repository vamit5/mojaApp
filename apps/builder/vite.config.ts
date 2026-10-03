import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@mojapp/core": pkg("core"),
      "@mojapp/ui": pkg("ui"),
      "@mojapp/app-engine": pkg("app-engine"),
    },
  },
  build: { outDir: mode === "single" ? "dist-single" : "dist" },
}));
