// Vercel build wrapper for NeighbourLink.
//
// Problem: some Vercel projects have Root Directory set to `src` (or an Output
// Directory override of `src/.next`), so Vercel looks for `.next` in
// `/vercel/path0/src/.next`. `next build` actually writes `.next` to the
// repository root, where package.json and next.config.ts live. A symlink is not
// enough: Vercel's build-output collector needs a real directory.
//
// This wrapper always runs `npm run build` from the real project root, then makes
// a physical copy of the resulting output at BOTH `/.next` and `/src/.next`.
// Whichever path that Vercel project expects will therefore be present.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function findProjectRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "next.config.ts"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the NeighbourLink project root (package.json + next.config.ts).");
}

const root = findProjectRoot(scriptDir);
const rootOutput = join(root, ".next");
const srcOutput = join(root, "src", ".next");

// Vercel sets a deprecated `npm_config_cache_dir` in some build images. Unset it
// for the build child process, and silence Node's non-actionable DEP0205 notice.
const env = { ...process.env };
delete env.npm_config_cache_dir;
delete env["npm_config_cache-dir"];
const existingNodeOptions = (env.NODE_OPTIONS || "").trim();
env.NODE_OPTIONS = [existingNodeOptions, "--no-deprecation"].filter(Boolean).join(" ");

console.log(`[vercel-build] project root: ${root}`);
const build = spawnSync("npm", ["run", "build"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const markers = ["required-server-files.json", "BUILD_ID", "routes-manifest.json"];
const isValidOutput = (dir) => markers.some((marker) => existsSync(join(dir, marker)));
const timestamp = (dir) => {
  for (const marker of markers) {
    const file = join(dir, marker);
    if (existsSync(file)) return statSync(file).mtimeMs;
  }
  return 0;
};

const candidates = [rootOutput, srcOutput].filter(isValidOutput).sort((a, b) => timestamp(b) - timestamp(a));
const source = candidates[0];
if (!source) {
  console.error("[vercel-build] No valid Next.js output found at .next or src/.next after build.");
  process.exit(1);
}

const destination = source === rootOutput ? srcOutput : rootOutput;
if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true, force: true });
console.log(`[vercel-build] synced ${source} -> ${destination}`);
console.log("[vercel-build] Vercel can now resolve .next from either the repository root or src/.");
