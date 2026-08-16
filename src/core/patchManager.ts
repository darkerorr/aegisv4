import { writeFile } from "node:fs/promises";
import { confirm, input } from "@inquirer/prompts";
import { ProjectFileReader } from "./fileReader.js";
import { sanitizeFileName } from "../utils/validation.js";

export interface PendingPatch {
  filePath: string;
  relativePath: string;
  before: string;
  after: string;
}

export class PatchManager {
  private reader = new ProjectFileReader();

  async createReplacement(inputData: {
    root: string;
    relativePath: string;
    nextContent: string;
    maxFileBytes: number;
  }): Promise<PendingPatch> {
    const current = await this.reader.readProjectFile(
      inputData.root,
      inputData.relativePath,
      inputData.maxFileBytes,
    );

    return {
      filePath: current.path,
      relativePath: current.relativePath,
      before: current.content,
      after: inputData.nextContent,
    };
  }

  showDiff(patch: PendingPatch): string {
    const before = patch.before.split("\n");
    const after = patch.after.split("\n");
    const lines = [`--- ${patch.relativePath}`, `+++ ${patch.relativePath}`];
    const max = Math.max(before.length, after.length);

    for (let index = 0; index < max; index += 1) {
      if (before[index] === after[index]) {
        lines.push(` ${before[index] ?? ""}`);
      } else {
        if (before[index] !== undefined) lines.push(`-${before[index]}`);
        if (after[index] !== undefined) lines.push(`+${after[index]}`);
      }
    }

    return lines.join("\n");
  }

  async apply(patch: PendingPatch): Promise<boolean> {
    const ok = await confirm({
      message: `Apply changes to ${patch.relativePath}?`,
      default: false,
    });
    if (!ok) return false;

    await writeFile(patch.filePath, patch.after, "utf8");
    return true;
  }

  async confirmDelete(relativePath: string): Promise<boolean> {
    const answer = await input({
      message: `Deleting ${sanitizeFileName(relativePath)} is destructive. Type DELETE to confirm:`,
    });
    return answer === "DELETE";
  }
}

export function stripCodeFence(content: string): string {
  const match = content.match(/```(?:[\w.-]+)?\n([\s\S]*?)```/);
  return match?.[1] ?? content;
}
