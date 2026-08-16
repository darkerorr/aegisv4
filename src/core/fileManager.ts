import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveUserPath } from "../utils/validation.js";

export class FileManager {
  async readTextFile(
    filePath: string,
    maxBytes: number,
  ): Promise<{ path: string; content: string }> {
    const absolutePath = resolveUserPath(filePath);
    const info = await stat(absolutePath);

    if (!info.isFile()) {
      throw new Error(`Not a file: ${absolutePath}`);
    }

    if (info.size > maxBytes) {
      throw new Error(
        `File is too large (${info.size} bytes). Limit is ${maxBytes} bytes.`,
      );
    }

    return {
      path: absolutePath,
      content: await readFile(absolutePath, "utf8"),
    };
  }

  async writeGeneratedFile(
    outputDir: string,
    filename: string,
    content: string,
  ): Promise<string> {
    const absoluteDir = resolveUserPath(outputDir);
    await mkdir(absoluteDir, { recursive: true });
    const target = path.join(absoluteDir, filename);
    await writeFile(target, content, { encoding: "utf8", flag: "wx" });
    return target;
  }
}
