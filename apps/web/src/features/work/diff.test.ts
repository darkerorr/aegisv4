import { describe, expect, it } from "vitest";
import { diffHunks, diffLines, diffStats } from "./diff";

describe("diffLines", () => {
  it("returns no lines for identical input", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "equal", oldLine: 1, newLine: 1, text: "a" },
      { type: "equal", oldLine: 2, newLine: 2, text: "b" },
    ]);
  });
  it("marks a full-file creation as additions", () => {
    const lines = diffLines("", "x\ny");
    expect(lines).toEqual([
      { type: "add", newLine: 1, text: "x" },
      { type: "add", newLine: 2, text: "y" },
    ]);
  });
  it("marks a full-file deletion as removals", () => {
    const lines = diffLines("x\ny", "");
    expect(lines).toEqual([
      { type: "del", oldLine: 1, text: "x" },
      { type: "del", oldLine: 2, text: "y" },
    ]);
  });
  it("detects an insertion in the middle", () => {
    const lines = diffLines("a\nc", "a\nb\nc");
    expect(lines).toEqual([
      { type: "equal", oldLine: 1, newLine: 1, text: "a" },
      { type: "add", newLine: 2, text: "b" },
      { type: "equal", oldLine: 2, newLine: 3, text: "c" },
    ]);
  });
  it("detects a replacement (removal + addition)", () => {
    const lines = diffLines("a\nold\nc", "a\nnew\nc");
    expect(lines.filter((line) => line.type === "equal").map((line) => line.text)).toEqual(["a", "c"]);
    expect(lines.some((line) => line.type === "del" && line.text === "old" && line.oldLine === 2)).toBe(true);
    expect(lines.some((line) => line.type === "add" && line.text === "new" && line.newLine === 2)).toBe(true);
  });
  it("handles shifted line numbers after an insertion", () => {
    const lines = diffLines("a\nb", "a\nx\nb");
    expect(lines[1]).toMatchObject({ type: "add", newLine: 2 });
    expect(lines[2]).toMatchObject({ type: "equal", oldLine: 2, newLine: 3 });
  });
});

describe("diffHunks", () => {
  it("produces one hunk per isolated change", () => {
    const hunks = diffHunks("a\nb\nc\nd", "a\nb2\nc\nd", 0);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({ oldStart: 2, oldCount: 1, newStart: 2, newCount: 1 });
    expect(new Set(hunks[0].lines.map((line) => line.type))).toEqual(new Set(["del", "add"]));
    expect(hunks[0].lines.some((line) => line.type === "del" && line.text === "b")).toBe(true);
    expect(hunks[0].lines.some((line) => line.type === "add" && line.text === "b2")).toBe(true);
  });
  it("splits distant changes into separate hunks", () => {
    const hunks = diffHunks("a\nb\nc\nx\ny\nz", "a\nB\nc\nx\nY\nz", 0);
    expect(hunks).toHaveLength(2);
  });
  it("keeps context lines around changes", () => {
    const hunks = diffHunks("a\nb\nc\nd\ne", "a\nB\nc\nd\ne", 1);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.length).toBeGreaterThan(2);
  });
});

describe("diffStats", () => {
  it("counts additions and removals", () => {
    expect(diffStats("a\nold\nc", "a\nnew\nc\nd")).toEqual({ adds: 2, dels: 1 });
  });
});