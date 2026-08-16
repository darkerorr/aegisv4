import { describe, expect, it } from "vitest";
import { applyTreeMutation, mutationFromFileChange, pendingOpFromToolStart } from "./live-tree";
import type { WorkAgentEvent } from "@aegis/types";

const baseTree = [
  { name: "src", relativePath: "src", type: "directory" as const },
  { name: "a.ts", relativePath: "src/a.ts", type: "file" as const },
  { name: "package.json", relativePath: "package.json", type: "file" as const },
];

function started(action: string, filePath: string, tool = "editFile"): WorkAgentEvent {
  return { type: "agent.tool.started", tool, action, filePath } as WorkAgentEvent;
}

function changed(relativePath: string): WorkAgentEvent {
  return { type: "agent.file.change", relativePath } as WorkAgentEvent;
}

describe("pendingOpFromToolStart", () => {
  it("maps create/edit/write/delete/move actions", () => {
    expect(pendingOpFromToolStart(started("create", "x.ts"))).toEqual({ action: "create", path: "x.ts" });
    expect(pendingOpFromToolStart(started("edit", "x.ts"))).toEqual({ action: "edit", path: "x.ts" });
    expect(pendingOpFromToolStart(started("write", "x.ts"))).toEqual({ action: "edit", path: "x.ts" });
    expect(pendingOpFromToolStart(started("delete", "x.ts"))).toEqual({ action: "delete", path: "x.ts" });
    expect(pendingOpFromToolStart(started("move", "old.ts"))).toEqual({ action: "move", path: "old.ts" });
  });

  it("falls back on tool name for non-action events", () => {
    expect(pendingOpFromToolStart(started("run", "x.ts", "runCommand"))).toBeNull();
    expect(pendingOpFromToolStart(started("read", "x.ts", "readFile"))).toEqual({ action: "read", path: "x.ts" });
  });
});

describe("mutationFromFileChange", () => {
  it("resolves a move into a rename", () => {
    const mutation = mutationFromFileChange(changed("src/b.ts"), { action: "move", path: "src/a.ts" });
    expect(mutation).toEqual({ action: "move", path: "src/a.ts", to: "src/b.ts" });
  });

  it("resolves a plain create", () => {
    const mutation = mutationFromFileChange(changed("new.ts"), { action: "create", path: "new.ts" });
    expect(mutation).toEqual({ action: "create", path: "new.ts" });
  });
});

describe("applyTreeMutation", () => {
  it("adds a new file and its missing parents", () => {
    const result = applyTreeMutation(baseTree, { action: "create", path: "lib/util.ts" });
    expect(result.some((entry) => entry.relativePath === "lib/util.ts" && entry.type === "file")).toBe(true);
    expect(result.some((entry) => entry.relativePath === "lib" && entry.type === "directory")).toBe(true);
  });

  it("does not duplicate an existing file", () => {
    const result = applyTreeMutation(baseTree, { action: "create", path: "src/a.ts" });
    expect(result.filter((entry) => entry.relativePath === "src/a.ts")).toHaveLength(1);
  });

  it("removes a file and its subtree", () => {
    const result = applyTreeMutation(baseTree, { action: "delete", path: "src" });
    expect(result.some((entry) => entry.relativePath === "src")).toBe(false);
    expect(result.some((entry) => entry.relativePath === "src/a.ts")).toBe(false);
    expect(result.some((entry) => entry.relativePath === "package.json")).toBe(true);
  });

  it("moves a file to a new path", () => {
    const result = applyTreeMutation(baseTree, { action: "move", path: "src/a.ts", to: "lib/a.ts" });
    expect(result.some((entry) => entry.relativePath === "src/a.ts")).toBe(false);
    expect(result.some((entry) => entry.relativePath === "lib/a.ts")).toBe(true);
  });

  it("ignores read/edit mutations", () => {
    expect(applyTreeMutation(baseTree, { action: "edit", path: "src/a.ts" })).toHaveLength(baseTree.length);
    expect(applyTreeMutation(baseTree, { action: "read", path: "src/a.ts" })).toHaveLength(baseTree.length);
  });
});
