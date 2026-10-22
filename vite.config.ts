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
    rollupOptions: {
      output: {
        // Split vendor code into named chunks so the app chunk stays small
        // and vendor code can be cached independently of app changes.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // react-dom pulls in scheduler; keep it with react.
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react";
          }
          if (id.includes("/node_modules/@radix-ui/")) {
            return "radix";
          }
          if (id.includes("/node_modules/@supabase/")) {
            return "supabase";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "lucide";
          }
          return undefined;
        },
      },
    },
  },
});
