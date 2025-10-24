import { $ } from "bun";

/**
 * Build ESM and CJS from src/index.ts
 * - Externalize deps so your library isn't bundled with mongodb/bson
 * - Keep source maps optional (can enable if you want)
 */
const entry = "src/index.ts";
const external = ["mongodb"];

const footer = "\n// Made by promethewz to make mongodb a better place";

await $`rm -rf dist`;

await Bun.build({
  entrypoints: [entry],
  outdir: "dist",
  format: "esm",
  target: "node",
  sourcemap: "linked",
  naming: "[dir]/[name].js",
  minify: true,
  external,
  footer,
});

console.log("Built ESM: dist/index.js");
