/**
 * Build ESM and CJS from src/index.ts
 * - Externalize deps so your library isn't bundled with mongodb/bson
 * - Keep source maps optional (can enable if you want)
 */
const entry = "src/index.ts";
const external = ["mongodb", "bson"];

const footer = "\n// Made by promethewz to make mongodb a better place";

await Bun.build({
  entrypoints: [entry],
  outdir: "dist",
  format: "esm",
  target: "node",
  sourcemap: "linked",
  naming: "[dir]/[name].js",
  external,
  footer,
});

await Bun.build({
  entrypoints: [entry],
  outdir: "dist",
  format: "cjs",
  target: "node",
  sourcemap: "linked",
  naming: "[dir]/[name].cjs",
  external,
  footer,
});

console.log("Built ESM: dist/index.js and CJS: dist/index.cjs");
