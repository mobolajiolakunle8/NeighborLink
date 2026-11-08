// Entry point for Vercel projects whose Root Directory is `src`.
// It delegates to the canonical build script at the repository root so there is a
// single implementation of the build, output sync and optional rules deployment.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let dir = resolve(here);
let target = null;
for (let i = 0; i < 8 && !target; i += 1) {
  const candidate = join(dir, "scripts", "vercel-build.mjs");
  if (existsSync(candidate) && resolve(candidate) !== resolve(fileURLToPath(import.meta.url)) && existsSync(join(dir, "package.json"))) {
    target = candidate;
  }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

if (!target) {
  console.error("[vercel-build] Could not find scripts/vercel-build.mjs above src/. Is the repository root checked out?");
  process.exit(1);
}

await import(pathToFileURL(target).href);
