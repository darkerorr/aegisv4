import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rootPath = path.join(repoRoot, ".env");
const legacyPath = path.join(repoRoot, "apps", "api", ".env");
const assignment = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=([\s\S]*)$/;

function entries(text) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => {
    const match = assignment.exec(line);
    return match ? { line, key: match[1], value: match[2].trim() } : { line };
  });
}

const rootText = existsSync(rootPath) ? await readFile(rootPath, "utf8") : "";
const legacyText = existsSync(legacyPath) ? await readFile(legacyPath, "utf8") : "";
const rootEntries = entries(rootText);
const legacyEntries = entries(legacyText);
const lastIndex = new Map();
for (let index = 0; index < rootEntries.length; index += 1) {
  if (rootEntries[index].key) lastIndex.set(rootEntries[index].key, index);
}
const deduped = rootEntries.filter((entry, index) => !entry.key || lastIndex.get(entry.key) === index);
const rootByKey = new Map(deduped.filter((entry) => entry.key).map((entry) => [entry.key, entry]));
let migrated = 0;
for (const legacy of legacyEntries) {
  if (!legacy.key || !legacy.value || legacy.key === "GITHUB_CLIENT_SECRET") continue;
  const root = rootByKey.get(legacy.key);
  if (root && root.value) continue;
  if (root) {
    root.value = legacy.value;
    root.line = `${root.key}=${legacy.value}`;
  } else {
    const added = { key: legacy.key, value: legacy.value, line: `${legacy.key}=${legacy.value}` };
    deduped.push(added);
    rootByKey.set(legacy.key, added);
  }
  migrated += 1;
}
const compromised = rootByKey.get("GITHUB_CLIENT_SECRET");
if (compromised) {
  compromised.value = "";
  compromised.line = "GITHUB_CLIENT_SECRET=";
}
const normalized = deduped.map((entry) => entry.key ? `${entry.key}=${entry.value}` : entry.line).join("\n").replace(/\n*$/, "\n");
const temporary = `${rootPath}.aegis-normalizing`;
await writeFile(temporary, normalized, { encoding: "utf8", mode: 0o600 });
await rename(temporary, rootPath);
if (existsSync(legacyPath)) {
  await writeFile(legacyPath, "# Deprecated: configuration is loaded from ../../.env.\n# Keep secrets only in the canonical root file.\n", "utf8");
}
console.log(`Normalized root environment: duplicate keys removed; ${migrated} legacy values migrated; compromised GitHub secret cleared.`);
