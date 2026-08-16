import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.join(repoRoot, "apps/web");
const nextRoot = path.join(webRoot, ".next-prod");
const buildIdPath = path.join(nextRoot, "BUILD_ID");
const statePath = path.join(nextRoot, "aegis-build-state.json");
const force = process.argv.includes("--force");

const roots = [path.join(webRoot, "src"), path.join(webRoot, "content"), path.join(webRoot, "public")];
const fixedFiles = [path.join(webRoot, "package.json"), path.join(webRoot, "next.config.ts"), path.join(webRoot, "postcss.config.mjs"), path.join(webRoot, "tsconfig.json"), path.join(repoRoot, "pnpm-lock.yaml")];

async function collect(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(fullPath);
    // Release binaries are represented by the hashed release manifest. Reading
    // them on every daily start would add I/O without changing the Web bundle.
    if (/\.(exe|msi)$/i.test(entry.name)) return [];
    return [fullPath];
  }));
  return nested.flat();
}

async function sourceFingerprint() {
  const discovered = (await Promise.all(roots.map(collect))).flat();
  const files = [...discovered, ...fixedFiles.filter(existsSync)].sort((a, b) => a.localeCompare(b));
  const hash = createHash("sha256");
  for (const file of files) {
    const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
    const fileStat = await stat(file);
    hash.update(relative);
    hash.update(String(fileStat.size));
    hash.update(await readFile(file));
  }
  return { hash: hash.digest("hex"), fileCount: files.length };
}

const started = performance.now();
const current = await sourceFingerprint();
let previous = null;
if (existsSync(statePath)) {
  try { previous = JSON.parse(await readFile(statePath, "utf8")); } catch { previous = null; }
}

let reason = null;
if (force) reason = "A forced Web build was requested.";
else if (!existsSync(buildIdPath)) reason = "No production BUILD_ID exists.";
else if (!previous) reason = "No Aegis source fingerprint exists for the current build.";
else if (previous.sourceHash !== current.hash) reason = "Source changes detected.";

if (!reason) {
  console.log(`[WEB] Existing production build is current (${current.fileCount} source files checked in ${((performance.now() - started) / 1000).toFixed(2)} s).`);
  process.exit(0);
}

async function portIsListening(port, host = "127.0.0.1") {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const webPort = Number(process.env.AEGIS_WEB_PORT) || 3000;
if (await portIsListening(webPort)) {
  console.error(`[WEB] Refusing to rebuild while port ${webPort} is in use. Stop the existing Web process first.`);
  process.exit(1);
}

console.log(`[WEB] ${reason}`);
console.log("[WEB] Building all routes...");
const buildStarted = performance.now();
// Next can leave mutually incompatible server chunks behind after interrupted
// development and production runs. Once the fingerprint says a rebuild is
// required, the generated output is discarded before compiling a coherent set.
await rm(nextRoot, { recursive: true, force: true });
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
try {
  execSync(`"${command}" --filter @aegis/web build`, { cwd: repoRoot, stdio: "inherit" });
} catch (e) {
  console.error(`[WEB] Build failed.`);
  process.exit(1);
}
if (!existsSync(buildIdPath)) {
  console.error("[WEB] Next.js reported success but .next-prod/BUILD_ID is missing.");
  process.exit(1);
}
await mkdir(nextRoot, { recursive: true });
await writeFile(statePath, `${JSON.stringify({ sourceHash: current.hash, fileCount: current.fileCount, builtAt: new Date().toISOString(), buildId: (await readFile(buildIdPath, "utf8")).trim() }, null, 2)}\n`, "utf8");
console.log(`[WEB] Build completed in ${((performance.now() - buildStarted) / 1000).toFixed(1)} s.`);


