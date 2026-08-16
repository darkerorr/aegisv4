import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AegisIcon, AegisIconList, iconForAction, iconForTool } from "./aegis-icons";
import { AegisCore, coreStateFromActivity, CORE_STATES } from "./aegis-core";
import { aegisLangForLabel } from "./aegis-lang";
import { WORK_MODES } from "../../features/work/work-modes";

describe("aegis-icons", () => {
  it("renders an <svg> for every declared icon", () => {
    const names = AegisIconList();
    expect(names.length).toBeGreaterThanOrEqual(20);
    for (const name of names) {
      const html = renderToStaticMarkup(<AegisIcon name={name} size={16} />);
      expect(html, `icon ${name}`).toContain("<svg");
      expect(html, `icon ${name} must not contain emoji`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{2709}\u{2699}]/u);
    }
  });

  it("every icon has distinct markup (real glyphs, not placeholders)", () => {
    const seen = new Set<string>();
    for (const name of AegisIconList()) {
      const html = renderToStaticMarkup(<AegisIcon name={name} size={16} />);
      expect(seen.has(html), `duplicate markup for ${name}`).toBe(false);
      seen.add(html);
    }
  });

  it("accepts a title and sets role=img", () => {
    const html = renderToStaticMarkup(<AegisIcon name="git" size={16} title="git status" />);
    expect(html).toContain("<title>git status</title>");
    expect(html).toContain('role="img"');
  });
});

describe("iconForAction / iconForTool", () => {
  it("maps actions onto distinct glyphs", () => {
    expect(iconForAction("read")).toBe("read");
    expect(iconForAction("edit")).toBe("edit");
    expect(iconForAction("search")).toBe("search");
    expect(iconForAction("run")).toBe("terminal");
    expect(iconForAction("unknown")).toBe("tool");
  });

  it("maps tools onto glyphs", () => {
    expect(iconForTool("searchFiles")).toBe("search");
    expect(iconForTool("readFile")).toBe("read");
    expect(iconForTool("editFile")).toBe("edit");
    expect(iconForTool("writeFile")).toBe("create");
    expect(iconForTool("runCommand")).toBe("terminal");
  });
});

describe("aegis-core", () => {
  it("renders every state without error", () => {
    for (const state of CORE_STATES) {
      const html = renderToStaticMarkup(<AegisCore state={state} size={20} />);
      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain("<svg");
    }
  });

  it("maps agent activity to a core state", () => {
    expect(coreStateFromActivity(null, false)).toBe("idle");
    expect(coreStateFromActivity({ label: "x", action: "read" }, true)).toBe("reading");
    expect(coreStateFromActivity({ label: "x", action: "edit" }, true)).toBe("editing");
    expect(coreStateFromActivity({ label: "x", action: "run" }, true)).toBe("testing");
    expect(coreStateFromActivity({ label: "Terminé", action: "done" }, true)).toBe("done");
    expect(coreStateFromActivity({ label: "Erreur", action: "error" }, true)).toBe("error");
    expect(coreStateFromActivity({ label: "x" }, true)).toBe("thinking");
  });
});

describe("aegis-lang", () => {
  it("maps core languages to Aegis marks", () => {
    expect(aegisLangForLabel("typescript")).toBe("ts");
    expect(aegisLangForLabel("javascript")).toBe("js");
    expect(aegisLangForLabel("python")).toBe("python");
    expect(aegisLangForLabel("rust")).toBe("rust");
    expect(aegisLangForLabel("markdown")).toBe("md");
    expect(aegisLangForLabel("vue")).toBeNull();
  });
});

describe("work-modes", () => {
  it("declares the four modes with icons and instructions", () => {
    expect(WORK_MODES.map((mode) => mode.id)).toEqual(["auto", "plan", "review", "debug"]);
    for (const mode of WORK_MODES) {
      expect(mode.icon).toBeTruthy();
      expect(mode.instructions.length).toBeGreaterThan(40);
    }
  });
});