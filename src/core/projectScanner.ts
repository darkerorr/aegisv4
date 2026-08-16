import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface ProjectFile {
  path: string;
  relativePath: string;
  size: number;
}

export interface ProjectScan {
  root: string;
  projectType: string;
  files: ProjectFile[];
  ignoredDirectories: string[];
}

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".pnpm-store",
  ".aegis",
  ".aegis-test",
]);

const ignoredFiles = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
]);

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".wasm",
]);

export class ProjectScanner {
  async scan(root: string, maxFileBytes: number): Promise<ProjectScan> {
    const absoluteRoot = path.resolve(root);
    const files: ProjectFile[] = [];
    await this.walk(absoluteRoot, absoluteRoot, maxFileBytes, files);

    return {
      root: absoluteRoot,
      projectType: this.detectProjectType(files),
      files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
      ignoredDirectories: [...ignoredDirectories],
    };
  }

  isSafeProjectFile(
    relativePath: string,
    size: number,
    maxFileBytes: number,
  ): boolean {
    const parts = relativePath.split(/[\\/]/);
    if (parts.some((part) => ignoredDirectories.has(part))) return false;
    if (ignoredFiles.has(path.basename(relativePath))) return false;
    if (binaryExtensions.has(path.extname(relativePath).toLowerCase()))
      return false;
    return size <= maxFileBytes;
  }

  private async walk(
    root: string,
    dir: string,
    maxFileBytes: number,
    files: ProjectFile[],
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await this.walk(root, absolutePath, maxFileBytes, files);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      const info = await stat(absolutePath).catch(() => undefined);
      if (
        !info ||
        !this.isSafeProjectFile(relativePath, info.size, maxFileBytes)
      ) {
        continue;
      }

      files.push({ path: absolutePath, relativePath, size: info.size });
    }
  }

  private detectProjectType(files: ProjectFile[]): string {
    const names = new Set(
      files.map((file) => file.relativePath.replaceAll("\\", "/")),
    );
    if (names.has("package.json")) return "Node.js";
    if (names.has("pyproject.toml") || names.has("requirements.txt"))
      return "Python";
    if (names.has("Cargo.toml")) return "Rust";
    if (names.has("go.mod")) return "Go";
    if (names.has("pom.xml") || names.has("build.gradle")) return "Java";
    return "Unknown";
  }
}
