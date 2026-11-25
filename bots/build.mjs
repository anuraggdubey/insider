/**
 * Builds the always-on services into plain JavaScript under `bots/dist/` for hosting (Dockerfile).
 * Running the built files with `node` avoids a pnpm + tsx + esbuild process chain per service,
 * which does not fit in a 512 MB instance. `@insider/sdk` (TypeScript source) is bundled in; every
 * other package stays an import and resolves from `bots/node_modules` at run time.
 *
 *   pnpm --filter bots build
 */
import { build } from "esbuild";

await build({
  entryPoints: {
    host: "src/host.ts",
    bots: "src/index.ts",
    operator: "src/operator.ts",
    "cup-operator": "src/cup/index.ts",
    analysts: "src/ai/index.ts",
  },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "external-packages",
      setup(b) {
        // Bare package imports stay external, except the workspace SDK and its `#…` subpath imports.
        b.onResolve({ filter: /^[^./]/ }, (args) => {
          if (args.path.startsWith("@insider/") || args.path.startsWith("#")) return undefined;
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
