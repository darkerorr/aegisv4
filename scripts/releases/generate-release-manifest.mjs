import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tauriConfigPath = path.join(repoRoot, "apps/desktop/src-tauri/tauri.conf.json");
const releaseRoot = path.join(repoRoot, "apps/desktop/src-tauri/target/release");
const publicRoot = path.join(repoRoot, "apps/web/public/releases");
const shouldPublish = process.argv.includes("--publish-local");

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function artifact(type, sourcePath, version, publishAllowed = true) {
  try {
    const file = await stat(sourcePath);
    const filename = path.basename(sourcePath);
    const targetDirectory = path.join(publicRoot, version);
    if (shouldPublish && publishAllowed) {
      await mkdir(targetDirectory, { recursive: true });
      await copyFile(sourcePath, path.join(targetDirectory, filename));
    }
    return {
      status: shouldPublish && publishAllowed ? "available" : "built-not-published",
      installerType: type,
      filename,
      architecture: "x64",
      sizeBytes: file.size,
      sha256: await sha256(sourcePath),
      signed: false,
      downloadUrl: shouldPublish && publishAllowed ? `/releases/${version}/${encodeURIComponent(filename)}` : null,
      builtAt: file.mtime.toISOString(),
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "unavailable", installerType: type, downloadUrl: null };
    throw error;
  }
}

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
const version = tauriConfig.version;
const nsisPath = path.join(releaseRoot, "bundle/nsis", `Aegis App_${version}_x64-setup.exe`);
const msiPath = path.join(releaseRoot, "bundle/msi", `Aegis App_${version}_x64_en-US.msi`);
const portablePath = path.join(releaseRoot, "aegis-app.exe");

const [nsis, msi, portableBuild] = await Promise.all([
  artifact("NSIS", nsisPath, version),
  artifact("MSI", msiPath, version),
  artifact("Portable development executable", portablePath, version, false),
]);

if ([nsis, msi, portableBuild].every((entry) => entry.status === "unavailable")) {
  throw new Error(`No Desktop artifact was found under ${releaseRoot}. Run the Tauri release build first.`);
}

// The raw Tauri executable is evidence of a successful build, but is not
// published as a portable distribution because its runtime contract has not
// been validated independently from the installers.
portableBuild.status = portableBuild.status === "unavailable" ? "unavailable" : "local-build-only";
portableBuild.downloadUrl = null;

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  current: {
    version,
    releasedAt: nsis.builtAt ?? msi.builtAt ?? portableBuild.builtAt ?? null,
    channel: "development",
    notes: [
      "Windows x64 Desktop build produced from the current Tauri workspace.",
      "The available installers are development artifacts and are not code-signed.",
    ],
    platforms: {
      "windows-x64": { recommended: "nsis", artifacts: { nsis, msi, portable: portableBuild } },
    },
  },
  previous: [],
};

await mkdir(publicRoot, { recursive: true });
await writeFile(path.join(publicRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`[RELEASE] Manifest generated for Aegis Desktop ${version}.`);
console.log(`[RELEASE] NSIS: ${nsis.status}; MSI: ${msi.status}; portable: ${portableBuild.status}.`);
if (!shouldPublish) console.log("[RELEASE] Run with --publish-local to copy verified installers into apps/web/public/releases/<version>.");
