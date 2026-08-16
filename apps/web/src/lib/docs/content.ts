import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type DocArticle, type DocStatus } from "./schema";

export { docsGroups, type DocArticle, type DocStatus } from "./schema";

const docsRoot = path.join(process.cwd(), "content", "docs");

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseFrontmatter(raw: string, slug: string): DocArticle {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing frontmatter in docs article: ${slug}`);
  const data = Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
  const content = match[2].trim();
  const headings = Array.from(content.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((heading) => ({ id: slugify(heading[2]), label: heading[2], level: heading[1].length }));
  return {
    slug,
    title: data.title,
    description: data.description,
    group: data.group,
    status: data.status as DocStatus,
    updated: data.updated,
    keywords: (data.keywords || "").split(",").map((keyword) => keyword.trim()).filter(Boolean),
    content,
    headings,
  };
}

async function walk(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? walk(path.join(directory, entry.name), relative) : [relative];
  }));
  return files.flat().filter((file) => file.endsWith(".mdx"));
}

export async function getAllDocs(): Promise<DocArticle[]> {
  const files = await walk(docsRoot);
  const articles = await Promise.all(files.map(async (file) => {
    const slug = file.replace(/\.mdx$/, "");
    return parseFrontmatter(await readFile(path.join(docsRoot, file), "utf8"), slug);
  }));
  return articles.sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
}

export async function getDoc(slug: string) {
  return (await getAllDocs()).find((article) => article.slug === slug) ?? null;
}
