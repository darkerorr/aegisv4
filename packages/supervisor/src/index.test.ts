import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CrashLoopDetector, MemoryGuard, formatLogLine, installCrashLogger, nextBackoff } from "./index.js";

describe("supervisor primitives", () => {
  it("formats canonical log lines", () => {
    const line = formatLogLine("api", "WARN", "service exited", new Date("2026-08-13T10:00:00.000Z"));
    expect(line).toBe("[2026-08-13T10:00:00.000Z] [api] [WARN] service exited");
  });

  it("computes exponential backoff capped at 30s", () => {
    expect(nextBackoff(1)).toBe(2_000);
    expect(nextBackoff(2)).toBe(4_000);
    expect(nextBackoff(3)).toBe(8_000);
    expect(nextBackoff(4)).toBe(16_000);
    expect(nextBackoff(5)).toBe(30_000);
    expect(nextBackoff(9)).toBe(30_000);
  });

  it("detects a crash loop only after max exits in the window", () => {
    const detector = new CrashLoopDetector(5 * 60_000, 5);
    const t = 1_000_000;
    expect(detector.record("api", t + 0)).toBe(false);
    expect(detector.record("api", t + 1_000)).toBe(false);
    expect(detector.record("api", t + 2_000)).toBe(false);
    expect(detector.record("api", t + 3_000)).toBe(false);
    expect(detector.record("api", t + 4_000)).toBe(true);
  });

  it("does not count exits from other services or older exits", () => {
    const detector = new CrashLoopDetector(5 * 60_000, 3);
    const t = 1_000_000;
    detector.record("web", t, 1, null);
    detector.record("web", t + 1_000, 1, null);
    detector.record("api", t + 2_000, 1, null);
    detector.record("api", t - 400_000, 1, null);
    expect(detector.detected("api", t + 2_000)).toBe(false);
  });

  it("assesses memory against warn and restart thresholds", () => {
    const guard = new MemoryGuard(1_500, 1_200);
    expect(guard.assess(100)).toBe("ok");
    expect(guard.assess(1_250)).toBe("warn");
    expect(guard.assess(1_500)).toBe("restart");
    expect(guard.assess(2_000)).toBe("restart");
  });
});

describe("installCrashLogger", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "aegis-supervisor-test-"));
  const logDir = path.join(dir, "logs");

  beforeAll(() => installCrashLogger({ service: "api", logDir, logToConsole: false, logMemoryEveryMs: 86_400_000 }));

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes uncaughtException to the error log", async () => {
    process.emit("uncaughtException", new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const content = readFileSync(path.join(logDir, "api.error.log"), "utf8");
    expect(content).toContain("[api]");
    expect(content).toContain("[FATAL]");
    expect(content).toContain("uncaughtException");
    expect(content).toContain("boom");
  });

  it("writes unhandledRejection to the error log", async () => {
    (process.emit as (event: string, ...args: unknown[]) => boolean)("unhandledRejection", new Error("nope"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const content = readFileSync(path.join(logDir, "api.error.log"), "utf8");
    expect(content).toContain("unhandledRejection");
    expect(content).toContain("nope");
  });

  it("writes a memory sample to the service log", async () => {
    process.emit("beforeExit", 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const content = readFileSync(path.join(logDir, "api.log"), "utf8");
    expect(content).toContain("beforeExit (code=0)");
  });
});