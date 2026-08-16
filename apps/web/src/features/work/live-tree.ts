import type { WorkAgentEvent } from "@aegis/types";
import type { FileOpAction } from "./agent-activity";

export interface TreeEntry {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size?: number;
}

export interface PendingFileOp {
  action: FileOpAction;
  path: string;
}

/** Derive the tree mutation a tool start implies so the file tree can update
 * the instant the agent starts acting, before the refetch completes. */
export function pendingOpFromToolStart(event: WorkAgentEvent): PendingFileOp | null {
  if (event.type !== "agent.tool.started") return null;
  if (!event.filePath) return null;
  if (event.action === "read") return { action: "read", path: event.filePath };
  if (event.action === "search") return null;
  if (event.action === "list") return null;
  if (event.action === "create") return { action: "create", path: event.filePath };
  if (event.action === "write") return { action: "edit", path: event.filePath };
  if (event.action === "edit") return { action: "edit", path: event.filePath };
  if (event.action === "delete") return { action: "delete", path: event.filePath };
  if (event.action === "rename" || event.action === "move") return { action: "move", path: event.filePath };
  if (event.tool === "readFile") return { action: "read", path: event.filePath };
  if (event.tool === "editFile") return { action: "edit", path: event.filePath };
  if (event.tool === "writeFile") return { action: "create", path: event.filePath };
  if (event.tool === "deleteFile" || event.tool === "deleteFolder") return { action: "delete", path: event.filePath };
  if (event.tool === "moveFile") return { action: "move", path: event.filePath };
  if (event.tool === "copyFile") return { action: "copy", path: event.filePath };
  return null;
}

/** Resolve the file-change event to an actual tree mutation, taking a pending
 * tool operation into account (move/copy rename the target path). */
export function mutationFromFileChange(event: WorkAgentEvent, pending?: PendingFileOp | null): { action: FileOpAction; path: string; to?: string } {
  const path = event.type === "agent.file.change" ? event.relativePath : pending?.path ?? "";
  if (pending && (pending.action === "move" || pending.action === "copy") && pending.path !== path) {
    return { action: pending.action, path: pending.path, to: path };
  }
  const action = pending && pending.path === path ? pending.action : "edit";
  return { action, path };
}

function removeEntry(tree: TreeEntry[], path: string): TreeEntry[] {
  const prefix = `${path}/`;
  return tree.filter((entry) => entry.relativePath !== path && !entry.relativePath.startsWith(prefix));
}

function upsertEntry(tree: TreeEntry[], path: string): TreeEntry[] {
  if (tree.some((entry) => entry.relativePath === path)) return tree;
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  const entry: TreeEntry = { name, relativePath: path, type: "file" };
  // Also materialize parent directories that do not exist yet.
  let prefix = "";
  const parents: TreeEntry[] = [];
  for (let i = 0; i < parts.length - 1; i += 1) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
    if (!tree.some((existing) => existing.relativePath === prefix)) {
      parents.push({ name: parts[i], relativePath: prefix, type: "directory" });
    }
  }
  return [...tree, ...parents, entry];
}

/** Apply a resolved mutation to the flat tree entries returned by the API.
 * Pure and unit-testable. */
export function applyTreeMutation(tree: TreeEntry[], mutation: { action: FileOpAction; path: string; to?: string }): TreeEntry[] {
  switch (mutation.action) {
    case "create":
    case "copy":
      return upsertEntry(tree, mutation.to ?? mutation.path);
    case "move": {
      let result = removeEntry(tree, mutation.path);
      result = upsertEntry(result, mutation.to ?? mutation.path);
      return result;
    }
    case "delete":
      return removeEntry(tree, mutation.path);
    case "edit":
    case "read":
    default:
      return tree;
  }
}
