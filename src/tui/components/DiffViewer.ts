import type { PendingPatch } from "../../core/patchManager.js";

export function renderDiffViewer(diff: string, patch?: PendingPatch): string {
  return patch ? `Diff for ${patch.relativePath}\n${diff}` : diff;
}
