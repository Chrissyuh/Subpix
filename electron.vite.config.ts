import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts")
        }
      }
    }
  },
  renderer: {
    root: ".",
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html")
        }
      }
    },
    plugins: [react()]
  }
});
