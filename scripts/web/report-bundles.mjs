import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.join(repoRoot, "apps/web");
const manifestPath = path.join(webRoot, ".next-prod/app-build-manifest.json");
if (!existsSync(manifestPath)) throw new Error("Run the Web production build before generating the bundle report.");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const rows = [];
for (const [route, files] of Object.entries(manifest.pages || {})) {
  let bytes = 0;
  for (const file of files) {
    const fullPath = path.join(webRoot, ".next-prod", file);
    if (existsSync(fullPath)) bytes += (await stat(fullPath)).size;
  }
  rows.push({ route, files: files.length, kB: (bytes / 1024).toFixed(1), includesThree: files.some((file) => /three|react-three/i.test(file)) });
}
rows.sort((a, b) => Number(b.kB) - Number(a.kB));
console.table(rows);
