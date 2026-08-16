#!/usr/bin/env node
// Aegis process supervisor (Windows-friendly).
//
// Launches Web, API and Local Agent WITHOUT fragile cmd.exe windows, keeps
// persistent logs under logs/, restarts crashed services with exponential
// backoff, detects crash loops, watches memory, and records a machine-readable
// logs/status.json so the Work Mode UI can display real process state (PID,
// uptime, memory, last crash).
//
//   node scripts/supervisor.mjs                   dev servers (tsx / next dev)
//   node scripts/supervisor.mjs --production      built artifacts
//   node scripts/supervisor.mjs --status          print logs/status.json, exit
//   node scripts/supervisor.mjs --stop            stop recorded services, exit
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { CrashLoopDetector, MemoryGuard, formatLogLine, nextBackoff, windowsProcessMemoryMb } from "@aegis/supervisor";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const logsDir = process.env.AEGIS_LOG_DIR || path.join(root, "logs");
mkdirSync(logsDir, { recursive: true });

const isTTY = Boolean(process.stdout.isTTY);
const paint = (code, text) => (isTTY ? `\u001b[${code}m${text}\u001b[0m` : text);
const grey = (t) => paint("90", t);
const green = (t) => paint("92", t);
const yellow = (t) => paint("93", t);
const red = (t) => paint("91", t);

function supervisorLine(level, message, at = new Date()) {
  const line = formatLogLine("supervisor", level, message, at);
  try {
    appendFileSync(path.join(logsDir, "supervisor.log"), `${line}\n`, "utf8");
  } catch {
    // best effort
  }
  return line;
}

const statusFile = () => path.join(logsDir, "status.json");

function exitCause(code, signal, reason) {
  if (reason) return reason;
  if (signal) return `terminated by signal ${signal}`;
  if (code === 0) return "clean exit";
  if (code === null) return "unknown termination";
  return `exited with code ${code}`;
}

const SERVICE_NAMES = ["api", "web", "local-agent"];

const serviceSpecs = {
  api: { port: 4000, health: "/health", logFile: "api.log", errorFile: "api.error.log", color: grey, startupGraceMs: 30_000, probeTimeoutMs: 3_000 },
  web: { port: 3000, health: "/", logFile: "web.log", errorFile: "web.error.log", color: grey, startupGraceMs: 120_000, probeTimeoutMs: 20_000 },
  "local-agent": { port: Number(process.env.AEGIS_LOCAL_AGENT_PORT) || 4150, health: "/health", logFile: "local-agent.log", errorFile: "local-agent.error.log", color: grey, startupGraceMs: 30_000, probeTimeoutMs: 3_000 },
};

function spawnSpec(name, production) {
  const node = process.execPath;
  const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const next = path.join(root, "apps", "web", "node_modules", "next", "dist", "bin", "next");
  const env = { ...process.env, AEGIS_LOG_DIR: logsDir, AEGIS_SUPERVISOR: "1" };
  if (name === "api") {
    const entry = production ? path.join(root, "apps", "api", "dist", "server.js") : path.join(root, "apps", "api", "src", "server.ts");
    const cwd = production ? root : path.join(root, "apps", "api");
    const args = production ? [entry] : [tsx, entry];
    return { command: node, args, cwd, env };
  }
  if (name === "local-agent") {
    const entry = production ? path.join(root, "apps", "local-agent", "dist", "server.js") : path.join(root, "apps", "local-agent", "src", "server.ts");
    const cwd = root;
    const args = production ? [entry] : [tsx, entry];
    return { command: node, args, cwd, env };
  }
  const cwd = path.join(root, "apps", "web");
  const args = production ? [next, "start", "--hostname", "127.0.0.1", "--port", "3000"] : [next, "dev", "--hostname", "127.0.0.1"];
  return { command: node, args, cwd, env };
}

async function healthOk(name) {
  const spec = serviceSpecs[name];
  try {
    const response = await fetch(`http://127.0.0.1:${spec.port}${spec.health}`, { signal: AbortSignal.timeout(spec.probeTimeoutMs ?? 3_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

function createSupervisor({ production = false, crashMax = 5, crashWindowMs = 5 * 60_000, memoryLimitMb = 1_500, pollMs = 2_000, healthFailsBeforeRestart = 3, memoryPollMs = 10_000 }) {
  const children = new Map(); // name -> ChildProcess
  const serviceStates = new Map(
    SERVICE_NAMES.map((name) => [
      name,
      {
        name,
        state: "stopped",
        pid: null,
        parentPid: null,
        command: null,
        startedAt: null,
        onlineSince: null,
        attempt: 1,
        restarts: 0,
        lastExit: null,
        nextRestartInMs: null,
        memoryMb: null,
        crashLoop: false,
        healthFails: 0,
      },
    ]),
  );
  const timers = new Map(); // name -> restartTimer
  const detector = new CrashLoopDetector(crashWindowMs, crashMax);
  const memoryGuard = new MemoryGuard(memoryLimitMb);

  const writeStatus = () => {
    const payload = {
      updatedAt: new Date().toISOString(),
      supervisorPid: process.pid,
      logsDir,
      services: Object.fromEntries(
        SERVICE_NAMES.map((name) => {
          const record = serviceStates.get(name);
          return [name, {
            state: record.state,
            pid: record.pid,
            parentPid: record.parentPid,
            command: record.command,
            uptimeSeconds: record.startedAt ? Math.round((Date.now() - record.startedAt) / 1000) : null,
            startedAt: record.startedAt,
            lastExit: record.lastExit,
            restarts: record.restarts,
            attempt: record.attempt,
            nextRestartInMs: record.nextRestartInMs,
            memoryMb: record.memoryMb,
            crashLoop: record.crashLoop,
          }];
        }),
      ),
    };
    try {
      writeFileSync(statusFile(), JSON.stringify(payload, null, 2), "utf8");
    } catch {
      // best effort
    }
  };

  const log = (name, level, message) => {
    const spec = serviceSpecs[name] ?? { logFile: "supervisor.log", errorFile: "supervisor.log", color: grey };
    const line = formatLogLine(name, level, message);
    const file = level === "INFO" ? spec.logFile : spec.errorFile;
    try {
      appendFileSync(path.join(logsDir, file), `${line}\n`, "utf8");
    } catch {
      // best effort
    }
    const color = level === "ERROR" ? red : level === "WARN" ? yellow : green;
    console.log(`${grey(`[${new Date().toLocaleTimeString()}]`)} ${color(line)}`);
  };

  const setState = (name, nextState) => {
    const record = serviceStates.get(name);
    record.state = nextState;
    if (nextState === "online") {
      record.onlineSince ??= Date.now();
      record.nextRestartInMs = null;
    } else if (nextState !== "starting") {
      record.onlineSince = null;
    }
    writeStatus();
  };

  const attachOutput = (stream, name, kind) => {
    if (!stream) return;
    let tail = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      tail += chunk;
      let index;
      while ((index = tail.indexOf("\n")) >= 0) {
        const line = tail.slice(0, index).replace(/\r$/, "");
        tail = tail.slice(index + 1);
        if (!line) continue;
        log(name, kind === "err" ? "ERROR" : "INFO", `[${kind}] ${line}`);
      }
    });
  };

  const spawnService = (name) => {
    const record = serviceStates.get(name);
    const existing = children.get(name);
    if (existing && existing.exitCode === null && !existing.killed) return;
    if (timers.has(name)) {
      clearTimeout(timers.get(name));
      timers.delete(name);
    }
    const spec = spawnSpec(name, production);
    log(name, "INFO", `spawning ${production ? "production" : "dev"} service`);
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    children.set(name, child);
    record.pid = child.pid;
    record.parentPid = process.pid;
    record.command = [spec.command, ...spec.args].join(" ");
    record.startedAt = Date.now();
    record.nextRestartInMs = null;
    record.healthFails = 0;
    log(name, "INFO", `[PROCESS] started pid=${child.pid} parentPid=${process.pid} command=${record.command} cwd=${spec.cwd}`);
    setState(name, "starting");
    attachOutput(child.stdout, name, "out");
    attachOutput(child.stderr, name, "err");
    child.on("error", (error) => onExit(name, null, null, error.message));
    child.on("exit", (code, signal) => {
      if (children.get(name) !== child) return; // stale event from a previous child
      onExit(name, code, signal, null);
    });
    writeStatus();
  };

  const scheduleRestart = (name, reason) => {
    const record = serviceStates.get(name);
    const delay = nextBackoff(record.attempt);
    record.nextRestartInMs = delay;
    log(name, "WARN", `restart scheduled in ${Math.round(delay / 1000)}s (attempt ${record.attempt}) after ${reason}`);
    setState(name, "crashed");
    const timer = setTimeout(() => {
      timers.delete(name);
      record.attempt += 1;
      spawnService(name);
    }, delay);
    timers.set(name, timer);
    writeStatus();
  };

  const onExit = (name, code, signal, reason) => {
    const record = serviceStates.get(name);
    const pid = record.pid;
    const uptimeSeconds = record.startedAt ? Math.round((Date.now() - record.startedAt) / 1000) : null;
    const cause = exitCause(code, signal, reason);
    children.delete(name);
    record.pid = null;
    record.lastExit = { pid, parentPid: record.parentPid, command: record.command, code, signal, reason: reason ?? null, cause, uptimeSeconds, at: new Date().toISOString() };
    record.restarts += 1;
    record.healthFails = 0;
    log(name, "WARN", `[PROCESS] pid=${pid ?? "?"} parentPid=${record.parentPid ?? "?"} command=${record.command ?? "?"} exitCode=${code ?? "null"} signal=${signal ?? "none"} reason=${reason ?? "none"} uptime=${uptimeSeconds ?? "?"}s cause=${cause}`);
    setState(name, "crashed");
    if (detector.record(name, Date.now(), code, signal)) {
      record.crashLoop = true;
      log(name, "ERROR", `SERVICE CRASH LOOP: ${detector.recent(name)} exits within the window — auto-restart disabled.`);
      setState(name, "crash_loop");
      writeStatus();
      return;
    }
    scheduleRestart(name, reason ?? (signal ? `signal ${signal}` : `exit code ${code}`));
  };

  const stopOne = (name) => {
    const child = children.get(name);
    const record = serviceStates.get(name);
    if (timers.has(name)) {
      clearTimeout(timers.get(name));
      timers.delete(name);
      record.nextRestartInMs = null;
    }
    if (!child) {
      record.state = "stopped";
      writeStatus();
      return;
    }
    log(name, "INFO", "stopping service");
    try {
      child.kill();
    } catch {
      // already dead
    }
    const killer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, 5_000);
    killer.unref?.();
    child.once("exit", () => {
      clearTimeout(killer);
      record.pid = null;
      setState(name, "stopped");
    });
  };

  const restartOne = (name, reason = "manual restart") => {
    const record = serviceStates.get(name);
    record.attempt = 1;
    record.crashLoop = false;
    stopOne(name);
    scheduleRestart(name, reason);
  };

  const healthTimer = setInterval(async () => {
    for (const name of SERVICE_NAMES) {
      const record = serviceStates.get(name);
      const child = children.get(name);
      if (!child || child.exitCode !== null) continue;
      const ok = await healthOk(name);
      if (ok) {
        record.healthFails = 0;
        if (record.state !== "online") {
          log(name, "INFO", "ONLINE");
          if (record.onlineSince && Date.now() - record.onlineSince >= 30_000) {
            record.attempt = 1;
            record.crashLoop = false;
          }
          setState(name, "online");
        }
        continue;
      }
      // Not healthy yet. During the startup grace window (first-page compile,
      // cold start, DB warm-up) failures are expected and must NOT restart.
      const spec = serviceSpecs[name];
      const grace = spec.startupGraceMs ?? 90_000;
      if (record.state === "starting" && record.startedAt && Date.now() - record.startedAt < grace) {
        record.healthFails = 0;
        continue;
      }
      record.healthFails += 1;
      if (record.state === "online") {
        log(name, "WARN", `health probe failed (${record.healthFails}/${healthFailsBeforeRestart})`);
        setState(name, "unhealthy");
      }
      if (record.healthFails >= healthFailsBeforeRestart) {
        record.healthFails = 0;
        log(name, "ERROR", "service became unhealthy — forcing restart");
        stopOne(name);
        const fallback = setTimeout(() => {
          if (!children.has(name)) scheduleRestart(name, "unhealthy");
        }, 6_000);
        fallback.unref?.();
      }
    }
  }, pollMs);
  healthTimer.unref?.();

  const memoryTimer = setInterval(async () => {
    for (const name of SERVICE_NAMES) {
      const child = children.get(name);
      if (!child || child.exitCode !== null) continue;
      const rss = await windowsProcessMemoryMb(child.pid);
      if (rss === null) continue;
      const record = serviceStates.get(name);
      record.memoryMb = rss;
      const verdict = memoryGuard.assess(rss);
      if (verdict === "restart") {
        log(name, "ERROR", `memory guard: RSS ${rss}MiB >= limit ${memoryLimitMb}MiB — restarting`);
        record.memoryMb = null;
        stopOne(name);
      } else if (verdict === "warn") {
        log(name, "WARN", `memory high: RSS ${rss}MiB`);
      }
      writeStatus();
    }
  }, memoryPollMs);
  memoryTimer.unref?.();

  const start = () => {
    supervisorLine("INFO", `supervisor starting (pid=${process.pid} production=${production})`);
    for (const name of SERVICE_NAMES) spawnService(name);
  };

  const stopAll = async () => {
    supervisorLine("INFO", "supervisor stopping all services");
    for (const name of SERVICE_NAMES) stopOne(name);
    await new Promise((resolve) => setTimeout(resolve, 5_500));
    for (const name of SERVICE_NAMES) {
      const child = children.get(name);
      if (child && child.exitCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }
    supervisorLine("INFO", "supervisor exited");
  };

  const restartAll = () => {
    supervisorLine("INFO", "manual restart requested (R)");
    for (const name of SERVICE_NAMES) restartOne(name, "manual restart (R)");
  };

  return { start, stopAll, restartAll, restartOne, stopOne, status: statusFile, serviceStates, children, healthOk };
}

// ---------------------------------------------------------------------------
// CLI wiring
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const production = args.includes("--production");

if (args.includes("--status")) {
  const file = statusFile();
  if (!existsSync(file)) {
    console.log("No logs/status.json yet — the supervisor has never recorded a state.");
    process.exit(0);
  }
  console.log(readFileSync(file, "utf8"));
  process.exit(0);
}

if (args.includes("--stop")) {
  const file = statusFile();
  if (existsSync(file)) {
    try {
      const payload = JSON.parse(readFileSync(file, "utf8"));
      for (const [name, info] of Object.entries(payload.services ?? {})) {
        if (info.pid) {
          try {
            process.kill(info.pid);
            console.log(`Stopped ${name} (pid ${info.pid}).`);
          } catch (error) {
            console.log(`${name}: ${error.code === "ESRCH" ? "not running" : error.message}`);
          }
        }
      }
    } catch {
      console.log("logs/status.json is unreadable.");
    }
  } else {
    console.log("No logs/status.json — nothing to stop.");
  }
  process.exit(0);
}

if (production) {
  const missing = ["apps/api/dist/server.js", "apps/local-agent/dist/server.js"]
    .map((target) => path.join(root, target))
    .filter((target) => !existsSync(target));
  if (missing.length > 0) {
    supervisorLine("ERROR", `production mode but dist missing: ${missing.join(", ")} — run "pnpm build" first.`);
    console.log(red(`Production dist missing. Run "pnpm build" first, or use dev mode (no --production).`));
    process.exit(1);
  }
}

// Dev preflight: ensure the generated Prisma client exists (matches the API dev
// script which requires it before tsx starts) and sync the schema.
if (!production) {
  const prismaCli = path.join(root, "apps", "api", "node_modules", "prisma", "build", "index.js");
  const apiCwd = path.join(root, "apps", "api");
  const clientEntry = path.join(apiCwd, "node_modules", "@prisma", "client", "index.d.ts");
  const schema = path.join(apiCwd, "prisma", "schema.prisma");
  if (!existsSync(clientEntry)) {
    supervisorLine("INFO", "prisma client missing — generating it");
    const generate = spawnSync("node", [prismaCli, "generate", "--schema", schema], { cwd: apiCwd, stdio: "inherit" });
    if (generate.status !== 0) {
      supervisorLine("ERROR", `prisma generate exited ${generate.status}`);
    } else {
      supervisorLine("INFO", "prisma client generated");
    }
  }
  const push = spawnSync("node", [prismaCli, "db", "push", "--skip-generate"], { cwd: apiCwd, encoding: "utf8" });
  if (push.status !== 0) {
    supervisorLine("ERROR", `prisma db push exited ${push.status}: ${(push.stderr || push.stdout || "").split("\n").slice(0, 6).join("\n")}`);
  }
}

const supervisor = createSupervisor({ production });
supervisor.start();

console.log("");
console.log(green("Aegis supervisor is active. Services run in hidden consoles (no fragile CMD windows)."));
console.log(grey("Keys: 1/2/3 restart api/web/local-agent · R restart all · L open logs · Q quit · Ctrl+C stop"));
console.log("");
supervisorLine("INFO", `supervisor ready — logs in ${logsDir}`);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log(grey("\nShutting down..."));
  await supervisor.stopAll();
  process.exit(0);
};
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
  process.on(signal, () => void shutdown());
}

const keys = new Map([
  ["q", () => void shutdown()],
  ["r", () => supervisor.restartAll()],
  ["1", () => supervisor.restartOne("api", "manual restart (1)")],
  ["2", () => supervisor.restartOne("web", "manual restart (2)")],
  ["3", () => supervisor.restartOne("local-agent", "manual restart (3)")],
  ["l", () => {
    try {
      spawn("explorer.exe", [logsDir], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } catch {
      supervisorLine("WARN", "could not open logs directory");
    }
  }],
]);
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("line", (line) => {
  const key = line.trim().toLowerCase();
  const handler = keys.get(key);
  if (handler) handler();
});

// Keep the process alive even when stdin is not a TTY (e.g. launched by CI).
setInterval(() => {}, 2 ** 31 - 1).unref?.();