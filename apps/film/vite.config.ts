import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const web = fileURLToPath(new URL("../web", import.meta.url));

// The film imports the web app's components as they are; "@/..." inside them resolves to apps/web.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: { "@": web }, dedupe: ["react", "react-dom", "motion"] },
  define: { "process.env": "{}" },
  oxc: { jsx: { runtime: "automatic" } },
  server: { port: 5199, strictPort: true, fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});
