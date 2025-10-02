import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    react({ include: ["library-tests/form-observer/react/**", "library-tests/react-hook-form/**"] }),
    solid({ include: "library-tests/form-observer/solid/**" }),
  ],
  server: {
    headers: {
      // Set for `performance.measureUserAgentSpecificMemory()` https://web.dev/articles/monitor-total-page-memory-usage
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
