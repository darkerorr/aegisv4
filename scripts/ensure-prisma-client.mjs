import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(repoRoot, "apps", "api");
const schemaPath = path.join(apiRoot, "prisma", "schema.prisma");
const stampPath = path.join(apiRoot, "node_modules", ".aegis-prisma-schema.sha256");
const clientEntry = path.join(apiRoot, "node_modules", "@prisma", "client", "index.d.ts");
const schemaHash = createHash("sha256").update(await readFile(schemaPath)).digest("hex");
const previousHash = existsSync(stampPath) ? (await readFile(stampPath, "utf8")).trim() : "";

if (!existsSync(clientEntry) || previousHash !== schemaHash) {
  const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "pnpm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm.cmd", "exec", "prisma", "generate", "--schema", schemaPath]
    : ["exec", "prisma", "generate", "--schema", schemaPath];
  const result = spawnSync(executable, args, { cwd: apiRoot, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  await writeFile(stampPath, `${schemaHash}\n`, "utf8");
}
