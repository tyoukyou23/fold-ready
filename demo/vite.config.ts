import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The demo imports "fold-ready" straight from ../src, so it always shows the current source.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "fold-ready/devices", replacement: fileURLToPath(new URL("../src/devices.ts", import.meta.url)) },
      { find: "fold-ready", replacement: fileURLToPath(new URL("../src/index.ts", import.meta.url)) },
    ],
  },
  base: "./",
  server: { host: true },
});
