import path from "node:path";
import { homedir } from "node:os";

const env = process.env;

export const config = {
  host: env.AEGIS_LOCAL_AGENT_HOST || "127.0.0.1",
  port: Number(env.AEGIS_LOCAL_AGENT_PORT) || 4150,
  dataDir: path.resolve(env.AEGIS_LOCAL_AGENT_DATA_DIR || path.join(homedir(), ".aegis", "local-agent")),
  token: env.AEGIS_LOCAL_AGENT_TOKEN || "",
  webOrigins: (env.AEGIS_LOCAL_AGENT_ORIGINS || "http://127.0.0.1:3000,http://localhost:1420")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
  maxFileBytes: Number(env.AEGIS_LOCAL_AGENT_MAX_FILE_BYTES) || 300 * 1024,
  maxTurns: Number(env.AEGIS_LOCAL_AGENT_MAX_TOOL_TURNS) || 15,
  budget: {
    total: Number(env.AEGIS_LOCAL_AGENT_BUDGET) || 240,
    hardTurns: Number(env.AEGIS_LOCAL_AGENT_HARD_TURNS) || 80,
    stallRepeats: Number(env.AEGIS_LOCAL_AGENT_STALL_REPEATS) || 4,
    warnAtFraction: Number(env.AEGIS_LOCAL_AGENT_BUDGET_WARN_FRACTION) || 0.25,
  },
  terminalTimeoutMs: Number(env.AEGIS_LOCAL_AGENT_TERMINAL_TIMEOUT_MS) || 60_000,
  streamIdleTimeoutMs: Number(env.AEGIS_LOCAL_AGENT_STREAM_IDLE_TIMEOUT_MS) || 300_000,
};

export const paths = {
  token: path.join(config.dataDir, "token"),
  workspaces: path.join(config.dataDir, "workspaces.json"),
  undoDir: path.join(config.dataDir, "undo"),
};
