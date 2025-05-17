import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: {
      // Set for `performance.measureUserAgentSpecificMemory()` https://web.dev/articles/monitor-total-page-memory-usage
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
