/** biome-ignore-all lint/suspicious/noConsole: script file */

/**
 * This script checks for inline imports inside .d.ts file after typescript build.
 * This is important because inline imports make twoslash not happy on the docs side.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const DIST_DIR = "dist";
const DECLARATION_SUFFIX = ".d.ts";
const INLINE_IMPORT_PATTERN = /import\("[^"]+"\)/;

interface InlineImportHit {
  filePath: string;
  lineNumber: number;
  line: string;
}

async function collectDeclarationFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return collectDeclarationFiles(fullPath);
      }

      return entry.name.endsWith(DECLARATION_SUFFIX) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

async function findInlineImports(filePath: string): Promise<InlineImportHit[]> {
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

  return lines.flatMap((line, index) => {
    if (!INLINE_IMPORT_PATTERN.test(line)) {
      return [];
    }

    return [
      {
        filePath,
        lineNumber: index + 1,
        line: line.trim(),
      },
    ];
  });
}

const declarationFiles = await collectDeclarationFiles(DIST_DIR);
const hits = (await Promise.all(declarationFiles.map(findInlineImports))).flat();

if (hits.length > 0) {
  console.error("Inline import types found in emitted declarations:");
  for (const hit of hits) {
    console.error(`${hit.filePath}:${hit.lineNumber}`);
    console.error(`  ${hit.line}`);
  }

  process.exit(1);
}

console.log("Declaration check passed: no inline import types in dist/*.d.ts");
