import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "website"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  build: {
    outDir: resolve(__dirname, "site-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "website/index.html")
    }
  },
  plugins: [react()]
});
