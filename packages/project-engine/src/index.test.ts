import { describe, expect, it } from "vitest";
import { applyPatch, createPatch, isAllowedProjectFile, TrustStore } from "./index.js";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("project policy", () => {
  it("does not read env files", () => {
    expect(isAllowedProjectFile(".env", 10, 100)).toBe(false);
    expect(isAllowedProjectFile("src/main.ts", 10, 100)).toBe(true);
  });
  it("requires approval before applying a patch", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aegis-project-"));
    const filePath = path.join(root, "file.txt");
    const patch = createPatch(filePath, "file.txt", "before", "after");
    expect(await applyPatch(patch, async () => false)).toBe(false);
    await expect(readFile(filePath, "utf8")).rejects.toThrow();
  });
  it("persists workspace trust", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aegis-trust-"));
    const store = new TrustStore(path.join(root, "trusted.json"));
    await store.trust(root);
    expect(await store.isTrusted(root)).toBe(true);
  });
});
