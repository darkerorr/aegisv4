import http from "node:http";
import path from "node:path";
import { setDefaultResultOrder } from "node:dns";
import type { WorkAgentEvent, WorkAgentRequest, WorkspaceMode } from "@aegis/types";
import { WorkAgentRequestSchema, WorkspaceModeSchema } from "@aegis/types";
import { z } from "zod";
import { installCrashLogger, processMemorySample } from "@aegis/supervisor";
import { config, paths } from "./config.js";
import { ensureToken, tokenMatches } from "./token.js";
import { pickWorkspaceFolder, workspaceId, WorkspaceStore, newApprovalId } from "./workspaces.js";
import { ApprovalManager } from "./approvals.js";
import { buildTree, listFiles, readFileSafe, searchFiles, editFileSafe, writeFileSafe, deleteFileSafe, moveFileSafe } from "./files.js";
import { commandRisk, formatCommandResult, runCommand, assertCommandWithinWorkspace, aegisTerminalGuard, activeChildCount } from "./terminal.js";
import { gitStatus, revealInExplorer } from "./git.js";
import { runAgent } from "./agent.js";
import { runTeamAgent } from "./team.js";
import { UndoStore } from "./undo.js";

// undici performs no Happy Eyeballs; prefer IPv4 so a dead IPv6 path cannot hold
// connections until the connect timeout fires.
setDefaultResultOrder("ipv4first");

const store = new WorkspaceStore();
const approvals = new ApprovalManager();
const undoStore = new UndoStore();

// ======== Response helpers ========
function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}
function apiError(res: http.ServerResponse, status: number, code: string, message: string, details?: unknown): void {
  json(res, status, { code, message, details: details ?? null });
}
const sseGuarded = new WeakSet<http.ServerResponse>();
const activeStreams = new Set<http.ServerResponse>();
function guardRes(res: http.ServerResponse): void {
  if (sseGuarded.has(res)) return;
  sseGuarded.add(res);
  // Without an error listener, a write on a client that just disconnected
  // (page refresh mid-generation) emits an unhandled 'error' event on the
  // response. That is exactly the kind of crash that closed the service.
  res.on("error", () => {});
}
function sse(res: http.ServerResponse, event: WorkAgentEvent): void {
  guardRes(res);
  if (res.destroyed || res.writableEnded) return;
  try {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  } catch {
    // client is gone; the agent loop checks the aborted flag and stops
  }
}
function parseCookies(request: http.IncomingMessage): Record<string, string> {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
}
async function body(request: http.IncomingMessage, maxBytes = 2_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    total += value.length;
    if (total > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function isPublicPath(method: string, pathname: string): boolean {
  return (
    (pathname === "/health" && method === "GET") ||
    (pathname === "/metrics" && method === "GET") ||
    (pathname === "/auth/token" && method === "POST") ||
    (pathname === "/auth/status" && method === "GET")
  );
}

function splitSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = origin && config.webOrigins.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed || config.webOrigins[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

async function handle(request: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const method = request.method || "GET";
  const origin = request.headers.origin;
  const cors = corsHeaders(origin);
  const applyCors = (headers: Record<string, string>) => ({ ...cors, ...headers });

  if (method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  // ---- Health (public) ----
  if (url.pathname === "/health" && method === "GET") {
    res.writeHead(200, applyCors({ "Content-Type": "application/json; charset=utf-8" }));
    res.end(JSON.stringify({
      ok: true,
      service: "aegis-local-agent",
      version: "0.1.0",
      port: config.port,
      dataDir: paths,
      workspaces: (await store.list()).length,
      pendingApprovals: approvals.count(),
    }));
    return;
  }

  // ---- Auth ----
  const token = await ensureToken();
  const bearer = (request.headers.authorization || "").replace(/^Bearer\s+/i, "") || parseCookies(request).aegis_local_agent_token || "";
  const authenticated = tokenMatches(bearer, token);
  if (!isPublicPath(method, url.pathname) && !authenticated) {
    apiError(res, 401, "LOCAL_AGENT_AUTH_REQUIRED", "A valid Local Agent token is required. Configure it in Settings.");
    return;
  }

  try {
    // ---- Token handshake ----
    if (url.pathname === "/auth/token" && method === "POST") {
      json(res, 200, { token, workspaces: await store.list() });
      return;
    }
    // ---- Authentication status (public: reports whether the caller holds a valid token) ----
    if (url.pathname === "/auth/status" && method === "GET") {
      const configured = Boolean(token && token.length > 0);
      json(res, 200, {
        ok: true,
        service: "aegis-local-agent",
        version: "0.1.0",
        tokenConfigured: configured,
        authenticated,
        workspaces: (await store.list()).length,
      });
      return;
    }

    // ---- Process metrics (public, so /work/status can show real PID/uptime/memory) ----
    if (url.pathname === "/metrics" && method === "GET") {
      const memory = processMemorySample();
      const lagStart = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const eventLoopLagMs = Math.round(performance.now() - lagStart);
      json(res, 200, {
        ok: true,
        service: "aegis-local-agent",
        version: "0.1.0",
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
        port: config.port,
        memory,
        node: process.version,
        eventLoopLagMs,
        activeStreams: activeStreams.size,
        activeCommands: activeChildCount(),
        workspaces: (await store.list()).length,
        pendingApprovals: approvals.count(),
      });
      return;
    }

    // ---- Workspaces ----
    if (url.pathname === "/workspaces" && method === "GET") {
      json(res, 200, { workspaces: await store.list() });
      return;
    }
    if (url.pathname === "/workspaces" && method === "POST") {
      const input = z.object({ root: z.string().min(1), mode: WorkspaceModeSchema.default("restricted") }).parse(await body(request));
      const absolute = path.resolve(input.root);
      const entry = await store.trust(absolute, input.mode);
      json(res, 201, { workspace: entry });
      return;
    }
    if (url.pathname === "/workspaces/pick" && method === "POST") {
      try {
        const root = await pickWorkspaceFolder();
        json(res, 200, { cancelled: !root, root });
      } catch (error) {
        apiError(res, 501, "WORKSPACE_PICKER_UNAVAILABLE", (error as Error).message);
      }
      return;
    }
    if (url.pathname === "/workspaces/resolve" && method === "POST") {
      const input = z.object({ root: z.string().min(1) }).parse(await body(request));
      const absolute = path.resolve(input.root);
      const existing = await store.getByRoot(absolute);
      if (!existing) { apiError(res, 404, "WORKSPACE_NOT_TRUSTED", "This directory is not trusted yet."); return; }
      json(res, 200, { workspace: existing });
      return;
    }
    const segments = splitSegments(url.pathname);
    if (segments[0] === "workspaces" && segments.length >= 2) {
      const workspaceIdSeg = segments[1];
      if (method === "DELETE" && segments.length === 2) {
        const removed = await store.untrust(workspaceIdSeg);
        if (!removed) { apiError(res, 404, "WORKSPACE_NOT_FOUND", "Workspace not found."); return; }
        json(res, 200, { ok: true });
        return;
      }
      if (method === "PATCH" && segments.length === 2) {
        const input = z.object({ mode: WorkspaceModeSchema }).parse(await body(request));
        const updated = await store.setMode(workspaceIdSeg, input.mode);
        json(res, 200, { workspace: updated });
        return;
      }
      const workspace = await store.ensureAllowed(workspaceIdSeg);
      const sub = segments[2];

      if (sub === "files" && method === "GET") {
        json(res, 200, { files: await listFiles(workspace.root) });
        return;
      }
      if (sub === "tree" && method === "GET") {
        json(res, 200, { tree: await buildTree(workspace.root) });
        return;
      }
      if (sub === "file" && method === "GET") {
        const filePath = url.searchParams.get("path");
        if (!filePath) { apiError(res, 400, "VALIDATION_ERROR", "A file path is required."); return; }
        try {
          const file = await readFileSafe(workspace.root, filePath);
          json(res, 200, { path: filePath, content: file.content, size: file.size });
        } catch (error) {
          apiError(res, 400, "FILE_READ_ERROR", (error as Error).message);
        }
        return;
      }
      if (sub === "file" && method === "POST") {
        const input = z.object({ path: z.string().min(1), content: z.string(), mode: WorkspaceModeSchema.optional() }).parse(await body(request));
        try {
          await undoStore.checkpoint(workspace.id, workspace.root, "file", [input.path]);
          await writeFileSafe(workspace.root, input.path, input.content);
          json(res, 200, { ok: true });
        } catch (error) {
          apiError(res, 400, "FILE_WRITE_ERROR", (error as Error).message);
        }
        return;
      }
      if (sub === "file" && method === "DELETE") {
        const filePath = url.searchParams.get("path");
        if (!filePath) { apiError(res, 400, "VALIDATION_ERROR", "A file path is required."); return; }
        try {
          await undoStore.checkpoint(workspace.id, workspace.root, "file", [filePath]);
          await deleteFileSafe(workspace.root, filePath);
          json(res, 200, { ok: true, deleted: filePath });
        } catch (error) {
          apiError(res, 400, "FILE_DELETE_ERROR", (error as Error).message);
        }
        return;
      }
      if (sub === "move" && method === "POST") {
        const input = z.object({ from: z.string().min(1), to: z.string().min(1) }).parse(await body(request));
        try {
          await undoStore.checkpoint(workspace.id, workspace.root, "move", [input.from, input.to]);
          await moveFileSafe(workspace.root, input.from, input.to);
          json(res, 200, { ok: true, from: input.from, to: input.to });
        } catch (error) {
          apiError(res, 400, "FILE_MOVE_ERROR", (error as Error).message);
        }
        return;
      }
      if (sub === "reveal" && method === "POST") {
        const input = z.object({ path: z.string().optional() }).parse(await body(request));
        try {
          const target = path.resolve(workspace.root, input.path ?? "");
          if (!target.startsWith(path.resolve(workspace.root))) { apiError(res, 403, "PATH_OUTSIDE_WORKSPACE", "The path is outside the workspace."); return; }
          const revealed = await revealInExplorer(target);
          json(res, 200, { ok: revealed });
        } catch (error) {
          apiError(res, 501, "REVEAL_UNAVAILABLE", (error as Error).message);
        }
        return;
      }
      if (sub === "undo" && method === "POST") {
        try {
          const result = await undoStore.undo(workspace.id, workspace.root);
          json(res, 200, { ok: true, relativePath: result.relativePath });
        } catch (error) {
          const message = (error as Error).message;
          apiError(res, message.includes("no recent") ? 404 : 400, message.includes("no recent") ? "UNDO_EMPTY" : "UNDO_FAILED", message);
        }
        return;
      }
      if (sub === "search" && method === "GET") {
        const query = url.searchParams.get("query");
        if (!query) { apiError(res, 400, "VALIDATION_ERROR", "A search query is required."); return; }
        const pathFilter = url.searchParams.get("path") || undefined;
        const matches = await searchFiles(workspace.root, query, pathFilter);
        json(res, 200, { matches });
        return;
      }
      if (sub === "git" && method === "GET") {
        const status = await gitStatus(workspace.root);
        json(res, 200, status);
        return;
      }
      if (sub === "command" && method === "POST") {
        const input = z.object({ command: z.string().min(1), cwd: z.string().optional() }).parse(await body(request));
        assertCommandWithinWorkspace(workspace.root, input.cwd || workspace.root);
        const risk = commandRisk(input.command);
        const blocked = aegisTerminalGuard(input.command);
        if (blocked) {
          apiError(res, 403, "TERMINAL_BLOCKED_AEGIS", blocked);
          return;
        }
        if (risk !== "safe") {
          const approvalId = newApprovalId();
          apiError(res, 402, "APPROVAL_REQUIRED", `This command is classified as ${risk}. An explicit approval is required.`, { approvalId, risk });
          return;
        }
        const result = await runCommand(workspace.root, input.command);
        json(res, 200, result);
        return;
      }
    }

    // ---- Approvals ----
    if (segments[0] === "approvals" && segments.length === 2 && method === "POST") {
      const input = z.object({ approved: z.boolean() }).parse(await body(request));
      const resolved = approvals.resolve(segments[1], input.approved);
      if (!resolved) { apiError(res, 404, "APPROVAL_NOT_FOUND", "Approval request not found or already resolved."); return; }
      json(res, 200, { ok: true, approved: input.approved });
      return;
    }

    // ---- Agent streaming ----
    if (url.pathname === "/agent" && method === "POST") {
      const input = WorkAgentRequestSchema.parse(await body(request, 12_000_000));
      const workspace = await store.ensureAllowed(input.workspaceId);
      guardRes(res);
      activeStreams.add(res);
      res.writeHead(200, applyCors({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" }));
      res.flushHeaders?.();
      res.write("retry: 2000\n\n");
      let aborted = false;
      const onClose = () => { aborted = true; };
      res.on("close", onClose);
      const runtime = {
        workspace,
        approvals,
        onEvent: (event: WorkAgentEvent) => { sse(res, event); },
        recordUndo: (relativePath: string) => undoStore.checkpoint(workspace.id, workspace.root, "file", [relativePath]),
        recordUndoPaths: (operation: "folder" | "move" | "copy", relativePaths: string[]) => undoStore.checkpoint(workspace.id, workspace.root, operation, relativePaths),
        getAborted: () => aborted,
      };
      try {
        if (input.team?.enabled) {
          await runTeamAgent(input, runtime);
        } else {
          await runAgent(input, runtime);
        }
      } catch (error) {
        if (!aborted) sse(res, { type: "agent.error", error: { code: "AGENT_FAILED", message: (error as Error).message } });
      } finally {
        activeStreams.delete(res);
        res.off("close", onClose);
        if (!res.writableEnded && !aborted) res.end();
      }
      return;
    }

    apiError(res, 404, "NOT_FOUND", `No route for ${method} ${url.pathname}.`);
  } catch (error) {
    const code = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR";
    const message = error instanceof Error ? error.message : "Unexpected error.";
    apiError(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, code, message);
  }
}

const server = http.createServer((request, response) => {
  void handle(request, response).catch(() => {
    try { apiError(response, 500, "INTERNAL_ERROR", "Unexpected server error."); } catch { response.end(); }
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`[local-agent] server error: ${error.code ?? "UNKNOWN"} ${error.message}`);
  if (error.code === "EADDRINUSE") {
    console.error(`[local-agent] port ${config.port} is already in use. Is another Local Agent running?`);
    process.exit(1);
  }
});

// Persistent, structured crash + memory logging (logs/local-agent.log and
// logs/local-agent.error.log). Crash records survive the window closing.
const aegisLogDir = process.env.AEGIS_LOG_DIR || path.resolve(process.cwd(), "logs");
installCrashLogger({ service: "local-agent", logDir: aegisLogDir });

server.listen(config.port, config.host, () => {
  console.log(`[local-agent] Aegis Local Agent listening on http://${config.host}:${config.port}`);
});

export { server };
