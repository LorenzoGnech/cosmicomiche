import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  output: "static",
  adapter: node({ mode: "standalone" }),
  integrations: [
    {
      name: "copy-content",
      hooks: {
        "astro:build:done": ({ dir }) => {
          const clientDir = fileURLToPath(dir);
          cpSync("content", join(dirname(clientDir), "content"), { recursive: true });
        },
      },
    },
  ],
});
