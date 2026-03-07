import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Target Safari 14+ (iOS 14+), Chrome 87+, Firefox 78+
    target: ['es2020', 'safari14', 'chrome87', 'firefox78'],
  },
});
