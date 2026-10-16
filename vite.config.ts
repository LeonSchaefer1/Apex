import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const isDemoBuild = process.env.VITE_APP_MODE === "demo";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  build: {
    // Demo-/Artefakt-Build: Schriften inline, damit keine externen Font-Requests nötig sind (DSGVO, CSP).
    assetsInlineLimit: isDemoBuild ? 400_000 : 4096,
    chunkSizeWarningLimit: 2000,
    rollupOptions: isDemoBuild ? { output: { inlineDynamicImports: true } } : undefined,
  },
});
