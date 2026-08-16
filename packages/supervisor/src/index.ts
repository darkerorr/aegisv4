import { appendFileSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

/** Canonical persistent log line: `[ISO timestamp] [SERVICE] [LEVEL] message`. */
export function formatLogLine(service: string, level: LogLevel, message: string, at = new Date()): string {
  return `[${at.toISOString()}] [${service}] [${level}] ${message}`;
}

/** Exponential backoff for supervisor restarts: 2, 4, 8, 16, 30, 30, ... capped. */
export function nextBackoff(attempt: number, baseMs = 2_000, maxMs = 30_000): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(maxMs, baseMs * 2 ** exponent);
}

export interface ExitRecord {
  service: string;
  at: number;
  code: number | null;
  signal: NodeJS.Signals | null;
  reason?: string;
}

/** Detects "SERVICE CRASH LOOP": too many exits in a sliding window. */
export class CrashLoopDetector {
  constructor(
    private readonly windowMs = 5 * 60_000,
    private readonly maxExits = 5,
    private readonly entries: ExitRecord[] = [],
  ) {}

  record(service: string, at = Date.now(), code: number | null = null, signal: NodeJS.Signals | null = null, reason?: string): boolean {
    this.entries.push({ service, at, code, signal, reason });
    return this.detected(service, at);
  }

  detected(service: string, at = Date.now()): boolean {
    const since = at - this.windowMs;
    let count = 0;
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (entry.service !== service) continue;
      if (entry.at < since) break;
      count += 1;
    }
    return count >= this.maxExits;
  }

  recent(service: string, at = Date.now()): number {
    const since = at - this.windowMs;
    let count = 0;
    for (const entry of this.entries) {
      if (entry.service === service && entry.at >= since) count += 1;
    }
    return count;
  }
}

export interface ProcessMemorySample {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
}

const toMb = (bytes: number): number => Math.round((bytes / 1048576) * 10) / 10;

export function processMemorySample(): ProcessMemorySample {
  const usage = process.memoryUsage();
  return {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
  };
}

/** Guards a service against runaway memory. `restart` triggers a supervisor restart. */
export class MemoryGuard {
  constructor(
    private readonly limitMb: number,
    private readonly warnAtMb = limitMb * 0.8,
  ) {}

  assess(rssMb: number): "restart" | "warn" | "ok" {
    if (rssMb >= this.limitMb) return "restart";
    if (rssMb >= this.warnAtMb) return "warn";
    return "ok";
  }
}

/** Reads a process' working set (RSS) on Windows via PowerShell, in MiB. */
export function windowsProcessMemoryMb(pid: number, timeoutMs = 2_000): Promise<number | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  return new Promise<number | null>((resolve) => {
    const script = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-Process -Id ${pid} -ErrorAction SilentlyContinue).WorkingSet64`;
    const child = execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: timeoutMs },
      (error, stdout) => {
        if (error) { resolve(null); return; }
        const bytes = Number(String(stdout).trim());
        resolve(Number.isFinite(bytes) && bytes > 0 ? toMb(bytes) : null);
      },
    );
    child.unref?.();
  });
}

export interface CrashLoggerOptions {
  service: string;
  logDir: string;
  logToConsole?: boolean;
  logMemoryEveryMs?: number;
}

/**
 * Installs persistent, structured crash + memory logging for a Node process:
 *  - uncaughtException / unhandledRejection / uncaughtExceptionMonitor →
 *    `<logDir>/<service>.error.log` (never silent, never lost when the window closes)
 *  - exit / beforeExit → `<logDir>/<service>.log`
 *  - periodic memory sample → `<logDir>/<service>.log`
 * Crash handlers keep the process alive (as before) but always leave a trace.
 */
export function installCrashLogger(options: CrashLoggerOptions): { memoryTimer: NodeJS.Timeout } {
  const { service, logDir, logToConsole = true, logMemoryEveryMs = 60_000 } = options;
  const logFile = `${logDir}/${service}.log`;
  const errorFile = `${logDir}/${service}.error.log`;

  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // best effort — a missing log dir must never break the service
  }
  // Synchronous writes so a crash record is never lost (not even during exit).
  const write = (file: string, line: string): void => {
    try {
      appendFileSync(file, `${line}\n`, "utf8");
    } catch {
      // best effort
    }
  };
  const report = (level: LogLevel, file: string, message: string): void => {
    const line = formatLogLine(service, level, message);
    write(file, line);
    if (logToConsole) console.error(line);
  };
  const log = (level: LogLevel, message: string): void => report(level, logFile, message);
  const error = (level: LogLevel, message: string): void => report(level, errorFile, message);

  process.on("uncaughtException", (caught: Error) => {
    error("FATAL", `uncaughtException\n${caught.name}: ${caught.message}\n${caught.stack ?? ""}`);
  });
  process.on("unhandledRejection", (reason: unknown) => {
    const message = reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}` : String(reason);
    error("ERROR", `unhandledRejection\n${message}`);
  });
  process.on("uncaughtExceptionMonitor", (caught: Error, origin: NodeJS.UncaughtExceptionOrigin) => {
    error("FATAL", `uncaughtExceptionMonitor origin=${origin}\n${caught.stack ?? caught.message}`);
  });

  process.on("exit", (code) => {
    write(logFile, formatLogLine(service, "INFO", `process exiting (code=${code})`));
  });
  process.on("beforeExit", (code) => {
    write(logFile, formatLogLine(service, "INFO", `beforeExit (code=${code})`));
  });

  const onSignal = (signal: NodeJS.Signals): void => {
    log("WARN", `received ${signal}, exiting cleanly`);
    process.exit(0);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) {
    process.on(signal, onSignal);
  }

  const memoryTimer = setInterval(() => {
    const sample = processMemorySample();
    log(
      "INFO",
      `mem rss=${sample.rssMb}MiB heapUsed=${sample.heapUsedMb}MiB heapTotal=${sample.heapTotalMb}MiB external=${sample.externalMb}MiB`,
    );
  }, logMemoryEveryMs);
  memoryTimer.unref();

  return { memoryTimer };
}