import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript source, so inline them into the bundle.
  noExternal: [/^@crypto-valley\//],
});
