import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
const globalsPath = join(webRoot, "src/app/globals.css");

const IMPORT_RE = /@import\s+(?:url\()?["']([^"')]+)["']\)?;?/g;
const TAILWIND_RE = /@tailwind\s+\w+;/g;

const seen = new Set();
const parts = [];

function load(file) {
  const key = resolve(file);
  if (seen.has(key)) return;
  seen.add(key);
  let css = readFileSync(file, "utf8");
  css = css.replace(TAILWIND_RE, "");
  const imports = [];
  let m;
  const re = new RegExp(IMPORT_RE.source, "g");
  while ((m = re.exec(css))) imports.push(m[1]);
  css = css.replace(IMPORT_RE, "");
  for (const imp of imports) {
    load(resolve(dirname(file), imp));
  }
  parts.push({ file: key, css });
}

load(globalsPath);

const combined = parts
  .map((p) => p.css)
  .join("\n")
  .replace(/@tailwind\s+[^;]+;/g, "")
  .replace(/@import\s+[^;]+;/g, "");

writeFileSync(join(webRoot, "compiled.css"), combined, "utf8");
console.log("compiled", parts.length, "files ->", combined.length, "bytes");
