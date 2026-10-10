import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const result = await build({
  entryPoints: [resolve(root, "src/reveal-image.js")],
  outfile: resolve(root, "assets/js/reveal-image.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2020"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  nodePaths: [resolve(root, "tools/node_modules")],
  metafile: true,
  logLevel: "info",
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`reveal-image.js: ${(bytes / 1024).toFixed(1)} KiB (minificado)`);
