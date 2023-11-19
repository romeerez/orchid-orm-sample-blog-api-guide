import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  sourcemap: true,
  platform: "node",
  format: "esm",
  outdir: "dist",
  banner: {
    js: `
      import __path from 'node:path';
      import { fileURLToPath as __fileURLToPath } from 'node:url';
      import { createRequire as __createRequire } from 'module';
      const require = __createRequire(import.meta.url);
      const __filename = __fileURLToPath(import.meta.url);
      const __dirname = __path.join(__path.dirname(__filename), '..');
    `,
  },
});
