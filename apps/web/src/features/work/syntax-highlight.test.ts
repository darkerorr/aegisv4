import { describe, expect, it } from "vitest";
import { highlightCode, highlightToHtml, escapeHtml } from "./syntax-highlight";

describe("highlightCode", () => {
  it("tokenizes keywords", () => {
    const tokens = highlightCode("const x = 1;");
    const keywords = tokens.filter((token) => token.kind === "keyword").map((token) => token.text);
    expect(keywords).toContain("const");
  });

  it("tokenizes strings", () => {
    const tokens = highlightCode('const s = "hello";');
    expect(tokens.some((token) => token.kind === "string" && token.text.includes("hello"))).toBe(true);
  });

  it("tokenizes line comments to end of line", () => {
    const tokens = highlightCode("// comment\nconst x = 1;");
    const comment = tokens.find((token) => token.kind === "comment");
    expect(comment?.text).toBe("// comment\n");
    const after = tokens.slice(tokens.indexOf(comment!) + 1);
    expect(after.some((token) => token.kind === "keyword" && token.text === "const")).toBe(true);
  });

  it("tokenizes block comments", () => {
    const tokens = highlightCode("/* block */");
    expect(tokens.some((token) => token.kind === "comment" && token.text === "/* block */")).toBe(true);
  });

  it("tokenizes numbers", () => {
    const tokens = highlightCode("42 + 3.14");
    const numbers = tokens.filter((token) => token.kind === "number").map((token) => token.text);
    expect(numbers).toContain("42");
    expect(numbers).toContain("3.14");
  });

  it("tokenizes function calls", () => {
    const tokens = highlightCode("render(value)");
    expect(tokens.some((token) => token.kind === "function" && token.text === "render")).toBe(true);
  });

  it("tokenizes JSX-ish tags", () => {
    const tokens = highlightCode("<Component>");
    expect(tokens.some((token) => token.kind === "tag" && token.text === "<Component")).toBe(true);
  });

  it("preserves the full source when joined", () => {
    const code = "const greet = (name) => `hi ${name}`;\n// done\nconsole.log(greet(\"a\"));";
    const joined = highlightCode(code).map((token) => token.text).join("");
    expect(joined).toBe(code);
  });
});

describe("highlightToHtml", () => {
  it("escapes HTML inside tokens", () => {
    const html = highlightToHtml("const s = '<div>';", escapeHtml);
    expect(html).toContain("&lt;div&gt;");
  });
});
