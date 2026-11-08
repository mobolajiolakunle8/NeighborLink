// Vercel build wrapper for NeighbourLink.
// 1. Builds Next.js from the real project root and copies the output to both `.next`
//    and `src/.next` (for projects whose Root Directory is set to `src`).
// 2. If FIREBASE_TOKEN or FIREBASE_SERVICE_ACCOUNT_JSON is set as a server-only Vercel
//    secret, deploys firestore.rules, indexes and storage.rules so they never fall behind.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "next.config.ts"))) return dir;
    const parent = dirname(dir); if (parent === dir) break; dir = parent;
  }
  throw new Error("Could not locate the project root.");
}
const root = findRoot(dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env }; delete env.npm_config_cache_dir; delete env["npm_config_cache-dir"];
const run = (cmd, args, extra = {}) => spawnSync(cmd, args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32", ...extra });

const build = run("npm", ["run", "build"]);
if (build.status !== 0) process.exit(build.status ?? 1);

const rootOut = join(root, ".next"), srcOut = join(root, "src", ".next");
const markers = ["required-server-files.json", "BUILD_ID", "routes-manifest.json"];
const valid = (d) => markers.some((m) => existsSync(join(d, m)));
const stamp = (d) => { for (const m of markers) if (existsSync(join(d, m))) return statSync(join(d, m)).mtimeMs; return 0; };
const source = [rootOut, srcOut].filter(valid).sort((a, b) => stamp(b) - stamp(a))[0];
if (!source) { console.error("[vercel-build] No Next.js output found."); process.exit(1); }
const dest = source === rootOut ? srcOut : rootOut;
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(source, dest, { recursive: true });
console.log(`[vercel-build] synced ${source} -> ${dest}`);

const token = process.env.FIREBASE_TOKEN, sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!token && !sa) { console.log("[vercel-build] No Firebase deploy secret set — skipping rules deployment."); process.exit(0); }
const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(readFileSync(join(root, "src/config/firebase.web.json"), "utf8")).projectId;
let tmp = null;
if (sa) {
  try { JSON.parse(sa); } catch { console.warn("[vercel-build] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — skipping."); process.exit(0); }
  tmp = mkdtempSync(join(tmpdir(), "nl-fb-"));
  const file = join(tmp, "sa.json"); writeFileSync(file, sa, { mode: 0o600 });
  env.GOOGLE_APPLICATION_CREDENTIALS = file;
}
const args = ["-y", "firebase-tools@13", "deploy", "--only", "firestore:rules,firestore:indexes,storage", "--project", projectId, "--non-interactive"];
if (token) args.push("--token", token);
const res = run("npx", args);
if (tmp) rmSync(tmp, { recursive: true, force: true });
// A failed rules deploy must not ship silently: fail the build so it is noticed.
if (res.status !== 0) { console.error("[vercel-build] Firebase rules deployment FAILED."); process.exit(res.status ?? 1); }
console.log("[vercel-build] Firebase rules, indexes and storage rules deployed.");
