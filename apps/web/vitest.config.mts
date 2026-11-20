import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts", "components/**/*.test.ts", "components/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    server: { deps: { inline: ["convex-test", "@ledgerline/ui"] } },
  },
});
