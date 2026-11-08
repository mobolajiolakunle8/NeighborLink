// Vercel build wrapper for NeighbourLink. Runs the Next.js build from the real
// project root and physically copies the output to both possible output paths.
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
  throw new Error("Could not locate the NeighbourLink project root.");
}

const root = findProjectRoot(scriptDir);
const env = { ...process.env };
delete env.npm_config_cache_dir;
delete env["npm_config_cache-dir"];
console.log(`[vercel-build] project root: ${root}`);
const build = spawnSync("npm", ["run", "build"], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
if (build.status !== 0) process.exit(build.status ?? 1);
const rootOutput = join(root, ".next");
const srcOutput = join(root, "src", ".next");
const markers = ["required-server-files.json", "BUILD_ID", "routes-manifest.json"];
const valid = dir => markers.some(m => existsSync(join(dir, m)));
const stamp = dir => { for (const m of markers) if (existsSync(join(dir, m))) return statSync(join(dir, m)).mtimeMs; return 0; };
const source = [rootOutput, srcOutput].filter(valid).sort((a, b) => stamp(b) - stamp(a))[0];
if (!source) { console.error("[vercel-build] No valid Next.js output found."); process.exit(1); }
const destination = source === rootOutput ? srcOutput : rootOutput;
if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true, force: true });
console.log(`[vercel-build] synced ${source} -> ${destination}`);
