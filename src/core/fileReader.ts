import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ProjectScanner } from "./projectScanner.js";

export class ProjectFileReader {
  private scanner = new ProjectScanner();

  async readProjectFile(
    root: string,
    requestedPath: string,
    maxFileBytes: number,
  ): Promise<{ path: string; relativePath: string; content: string }> {
    const absoluteRoot = path.resolve(root);
    const absolutePath = path.resolve(absoluteRoot, requestedPath);
    const relativePath = path.relative(absoluteRoot, absolutePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Refusing to read a file outside the trusted project.");
    }

    const info = await stat(absolutePath);
    if (!info.isFile()) {
      throw new Error(`Not a file: ${requestedPath}`);
    }

    if (
      !this.scanner.isSafeProjectFile(relativePath, info.size, maxFileBytes)
    ) {
      throw new Error(
        "Refusing to read this file automatically. It is ignored, binary, secret, or too large.",
      );
    }

    return {
      path: absolutePath,
      relativePath,
      content: await readFile(absolutePath, "utf8"),
    };
  }
}
