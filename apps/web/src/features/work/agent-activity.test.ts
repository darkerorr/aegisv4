import { describe, expect, it } from "vitest";
import { classifyCommand, initialActivityState, reduceActivityEvent, activityProgress } from "./agent-activity";
import type { WorkAgentEvent } from "@aegis/types";

function toolStarted(overrides: Partial<Extract<WorkAgentEvent, { type: "agent.tool.started" }>>): WorkAgentEvent {
  return { type: "agent.tool.started", tool: "editFile", action: "edit", ...overrides } as WorkAgentEvent;
}

function toolCompleted(overrides: Partial<Extract<WorkAgentEvent, { type: "agent.tool.completed" }>>): WorkAgentEvent {
  return { type: "agent.tool.completed", tool: "editFile", action: "edit", ok: true, ...overrides } as WorkAgentEvent;
}

function toolFailed(overrides: Partial<Extract<WorkAgentEvent, { type: "agent.tool.failed" }>>): WorkAgentEvent {
  return { type: "agent.tool.failed", tool: "runCommand", action: "run", message: "boom", ...overrides } as WorkAgentEvent;
}

function fileChange(relativePath: string): WorkAgentEvent {
  return { type: "agent.file.change", relativePath } as WorkAgentEvent;
}

describe("classifyCommand", () => {
  it("detects test commands", () => {
    expect(classifyCommand("pnpm test").state).toBe("TESTING");
    expect(classifyCommand("pnpm --filter @aegis/web exec vitest run").kind).toBe("test");
    expect(classifyCommand("cargo test --lib").state).toBe("TESTING");
  });

  it("detects build commands", () => {
    expect(classifyCommand("pnpm build").state).toBe("BUILDING");
    expect(classifyCommand("npx tsc --noEmit").kind).toBe("build");
    expect(classifyCommand("vite build").state).toBe("BUILDING");
  });

  it("falls back to plain command", () => {
    const result = classifyCommand("git status --short");
    expect(result.kind).toBe("command");
    expect(result.state).toBe("RUNNING_COMMAND");
  });
});

describe("reduceActivityEvent — state machine", () => {
  it("moves from IDLE to EDITING on an edit tool start", () => {
    const state = reduceActivityEvent(initialActivityState(), toolStarted({ action: "edit", filePath: "src/a.ts" }));
    expect(state.state).toBe("EDITING");
    expect(state.editedCount).toBe(1);
    expect(state.currentFile).toBe("src/a.ts");
    expect(state.phrase).toContain("src/a.ts");
  });

  it("tracks read/search/create/delete/move states", () => {
    const read = reduceActivityEvent(initialActivityState(), toolStarted({ action: "read", filePath: "README.md" }));
    expect(read.state).toBe("READING");
    const search = reduceActivityEvent(initialActivityState(), toolStarted({ action: "search", query: "foo" }));
    expect(search.state).toBe("SEARCHING");
    const create = reduceActivityEvent(initialActivityState(), toolStarted({ action: "create", filePath: "new.ts" }));
    expect(create.state).toBe("CREATING");
    expect(create.createdCount).toBe(1);
    const del = reduceActivityEvent(initialActivityState(), toolStarted({ action: "delete", filePath: "old.ts" }));
    expect(del.state).toBe("DELETING");
    expect(del.deletedCount).toBe(1);
    const move = reduceActivityEvent(initialActivityState(), toolStarted({ action: "move", filePath: "a.ts" }));
    expect(move.state).toBe("MOVING");
  });

  it("transitions to WAITING on approval and back after resolution", () => {
    let state = reduceActivityEvent(initialActivityState(), { type: "agent.approval.required", approvalId: "a1", reason: "run", action: { type: "terminal", command: "rm -rf /" } } as WorkAgentEvent);
    expect(state.state).toBe("WAITING");
    expect(state.approvalCount).toBe(1);
    state = reduceActivityEvent(state, { type: "agent.approval.resolved", approvalId: "a1", approved: true } as WorkAgentEvent);
    expect(state.state).toBe("THINKING");
  });

  it("goes to COMPLETED on agent.completed", () => {
    const state = reduceActivityEvent(initialActivityState(), { type: "agent.completed", message: "done" } as WorkAgentEvent);
    expect(state.state).toBe("COMPLETED");
    expect(activityProgress(state)).toBe(100);
  });

  it("goes to ERROR on agent.error", () => {
    const state = reduceActivityEvent(initialActivityState(), { type: "agent.error", error: { code: "LOCAL_AGENT", message: "stream closed" } } as WorkAgentEvent);
    expect(state.state).toBe("ERROR");
    expect(state.activity.some((entry) => entry.kind === "error")).toBe(true);
  });

  it("marks tool entries done/failed with duration", () => {
    let state = reduceActivityEvent(initialActivityState(), toolStarted({ action: "edit", filePath: "src/a.ts" }));
    state = reduceActivityEvent(state, toolCompleted({ action: "edit", filePath: "src/a.ts" }));
    const entry = state.activity.find((e) => e.kind === "edit");
    expect(entry?.status).toBe("done");
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
    expect(state.stepsDone).toBe(1);
  });

  it("marks a failed command and records counters", () => {
    let state = reduceActivityEvent(initialActivityState(), toolStarted({ action: "run", command: "pnpm test", tool: "runCommand" }));
    expect(state.state).toBe("TESTING");
    expect(state.commandCount).toBe(1);
    expect(state.testsRun).toBe(1);
    state = reduceActivityEvent(state, toolFailed({ command: "pnpm test", message: "exit 1" }));
    const entry = state.activity.find((e) => e.kind === "test");
    expect(entry?.status).toBe("failed");
    expect(state.stepsDone).toBe(1);
  });
});

describe("reduceActivityEvent — file tracking", () => {
  it("tracks active files with action and status", () => {
    let state = reduceActivityEvent(initialActivityState(), toolStarted({ action: "create", filePath: "src/new.ts" }));
    state = reduceActivityEvent(state, fileChange("src/new.ts"));
    expect(state.files["src/new.ts"]).toMatchObject({ path: "src/new.ts", action: "create", status: "done" });
    expect(state.currentFile).toBe("src/new.ts");
  });

  it("resolves a file change without a prior tool as a generic done entry", () => {
    const state = reduceActivityEvent(initialActivityState(), fileChange("package.json"));
    expect(state.files["package.json"]).toMatchObject({ path: "package.json", status: "done" });
  });

  it("progress grows as steps are completed but stays <100 while more work runs", () => {
    let state = reduceActivityEvent(initialActivityState(), toolStarted({ action: "read", filePath: "a.ts" }));
    state = reduceActivityEvent(state, toolCompleted({ action: "read", filePath: "a.ts" }));
    expect(activityProgress(state)).toBe(100);
    state = reduceActivityEvent(state, toolStarted({ action: "edit", filePath: "b.ts" }));
    expect(activityProgress(state)).toBe(50);
    state = reduceActivityEvent(state, toolCompleted({ action: "edit", filePath: "b.ts" }));
    expect(activityProgress(state)).toBe(100);
  });
});
