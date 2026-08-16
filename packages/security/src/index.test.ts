import { describe, expect, it } from "vitest";
import { classifyCommand, isSafeRelativePath } from "./index.js";

describe("security policy", () => {
  it("rejects secrets and traversal", () => {
    expect(isSafeRelativePath("C:/project", ".env")).toBe(false);
    expect(isSafeRelativePath("C:/project", "../outside.txt")).toBe(false);
    expect(isSafeRelativePath("C:/project", "src/index.ts")).toBe(true);
  });
  it("classifies dangerous commands", () => {
    expect(classifyCommand("rm -rf dist")).toBe("destructive");
    expect(classifyCommand("npm i -g tool")).toBe("sensitive");
  });
});
