import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust build outputs are frequently locked by cargo/link.exe on Windows.
      // They are not frontend inputs and must never trigger a Vite rebuild.
      ignored: ["**/src-tauri/target/**", "**/src-tauri/target-*/**"],
    },
  },
});
