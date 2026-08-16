import type { WorkAgentEvent } from "@aegis/types";

export type AgentState =
  | "IDLE"
  | "THINKING"
  | "ANALYZING"
  | "READING"
  | "SEARCHING"
  | "EDITING"
  | "CREATING"
  | "DELETING"
  | "MOVING"
  | "RUNNING_COMMAND"
  | "TESTING"
  | "BUILDING"
  | "WAITING"
  | "COMPLETED"
  | "ERROR";

export type ActivityKind =
  | "analysis"
  | "read"
  | "search"
  | "edit"
  | "create"
  | "delete"
  | "move"
  | "copy"
  | "command"
  | "test"
  | "build"
  | "approval"
  | "error"
  | "done";

export type FileOpAction = "read" | "edit" | "create" | "delete" | "move" | "copy";

export interface ActivityEntry {
  id: string;
  at: number;
  kind: ActivityKind;
  label: string;
  filePath?: string;
  command?: string;
  query?: string;
  detail?: string;
  status: "running" | "done" | "failed";
  startedAt: number;
  durationMs?: number;
}

export interface FileOpStatus {
  path: string;
  action: FileOpAction;
  status: "running" | "done" | "failed";
  firstSeen: number;
}

export interface AgentActivityState {
  state: AgentState;
  phrase: string;
  activity: ActivityEntry[];
  files: Record<string, FileOpStatus>;
  readCount: number;
  editedCount: number;
  createdCount: number;
  deletedCount: number;
  movedCount: number;
  copiedCount: number;
  commandCount: number;
  testsRun: number;
  buildsRun: number;
  stepsDone: number;
  stepsSeen: number;
  currentFile?: string;
  currentCommand?: string;
  approvalCount: number;
}

export function initialActivityState(): AgentActivityState {
  return {
    state: "IDLE",
    phrase: "En attente d'une tâche…",
    activity: [],
    files: {},
    readCount: 0,
    editedCount: 0,
    createdCount: 0,
    deletedCount: 0,
    movedCount: 0,
    copiedCount: 0,
    commandCount: 0,
    testsRun: 0,
    buildsRun: 0,
    stepsDone: 0,
    stepsSeen: 0,
    approvalCount: 0,
  };
}

export function activityProgress(state: AgentActivityState): number {
  if (state.state === "COMPLETED") return 100;
  if (state.state === "ERROR") return 100;
  if (state.stepsSeen === 0) return state.activity.length ? Math.min(30, state.activity.length * 6) : 0;
  return Math.min(100, Math.round((state.stepsDone / state.stepsSeen) * 100));
}

export function phraseForState(state: AgentState, event: WorkAgentEvent): string {
  switch (state) {
    case "IDLE": return "En attente d'une tâche…";
    case "THINKING": return "Réflexion…";
    case "ANALYZING": return "Analyse de la structure du projet…";
    case "READING": return event.type === "agent.tool.started" ? `Lecture de ${event.filePath ?? "fichier"}…` : "Lecture d'un fichier…";
    case "SEARCHING": return `Recherche de "${("query" in event && event.query) ?? "…"}"…`;
    case "EDITING": return event.type === "agent.tool.started" ? `Modification de ${event.filePath ?? "fichier"}…` : "Modification d'un fichier…";
    case "CREATING": return event.type === "agent.tool.started" ? `Création de ${event.filePath ?? "fichier"}…` : "Création d'un fichier…";
    case "DELETING": return event.type === "agent.tool.started" ? `Suppression de ${event.filePath ?? "fichier"}…` : "Suppression…";
    case "MOVING": return event.type === "agent.tool.started" ? `Déplacement de ${event.filePath ?? "fichier"}…` : "Déplacement…";
    case "RUNNING_COMMAND": return event.type === "agent.tool.started" && event.command ? `Exécution : ${event.command}` : "Exécution d'une commande…";
    case "TESTING": return "Exécution des tests…";
    case "BUILDING": return "Build en cours…";
    case "WAITING": return "En attente d'approbation…";
    case "COMPLETED": return "Tâche terminée";
    case "ERROR": return "Erreur rencontrée";
  }
}

export function classifyCommand(command: string): { kind: ActivityKind; state: AgentState } {
  const lower = command.toLowerCase();
  if (/(^|\s|\/)(test|vitest|jest|pytest|go test|cargo test|pnpm test|npm test|yarn test)\b/.test(lower) || /--?test\b/.test(lower)) {
    return { kind: "test", state: "TESTING" };
  }
  if (/\b(build|vite build|next build|tsc|tsc -p|webpack|rollup)\b/.test(lower) || /--?build\b/.test(lower)) {
    return { kind: "build", state: "BUILDING" };
  }
  return { kind: "command", state: "RUNNING_COMMAND" };
}

const FILE_TOOL_ACTIONS: Partial<Record<string, FileOpAction>> = {
  readFile: "read",
  editFile: "edit",
  writeFile: "create",
  deleteFile: "delete",
  deleteFolder: "delete",
  moveFile: "move",
  copyFile: "copy",
};

let entrySeq = 0;
function nextId(prefix: string): string {
  entrySeq += 1;
  return `${prefix}-${entrySeq}`;
}

export function reduceActivityEvent(prev: AgentActivityState, event: WorkAgentEvent): AgentActivityState {
  const next: AgentActivityState = {
    ...prev,
    activity: prev.activity.map((entry) => ({ ...entry })),
    files: { ...prev.files },
  };
  const now = Date.now();

  if (event.type === "agent.tool.started") {
    const kindOf = (action?: string): ActivityKind => {
      switch (action) {
        case "read": return "read";
        case "search": return "search";
        case "edit": return "edit";
        case "create": return "create";
        case "delete": return "delete";
        case "rename": case "move": return "move";
        case "list": return "analysis";
        case "run": return event.command ? classifyCommand(event.command).kind : "command";
        default: return "analysis";
      }
    };
    const kind = kindOf(event.action);
    const fileAction = event.filePath ? (event.action === "write" ? "edit" : event.action === "create" ? "create" : FILE_TOOL_ACTIONS[event.tool]) : undefined;

    let label = "Action";
    switch (kind) {
      case "analysis": label = "Analyse"; break;
      case "read": label = "Lecture"; break;
      case "search": label = "Recherche"; break;
      case "edit": label = "Modification"; break;
      case "create": label = "Création"; break;
      case "delete": label = "Suppression"; break;
      case "move": label = "Déplacement"; break;
      case "command": label = "Commande"; break;
      case "test": label = "Test"; break;
      case "build": label = "Build"; break;
      case "approval": label = "Approbation"; break;
      case "error": label = "Erreur"; break;
      case "done": label = "Terminé"; break;
      case "copy": label = "Copie"; break;
    }

    const entry: ActivityEntry = {
      id: nextId(kind),
      at: now,
      kind,
      label,
      filePath: event.filePath,
      command: event.command,
      query: event.query,
      detail: event.filePath ?? event.query ?? event.command,
      status: "running",
      startedAt: now,
    };
    next.activity = [...next.activity, entry].slice(-120);

    if (event.filePath && fileAction) {
      const existing = next.files[event.filePath];
      const op: FileOpStatus = { path: event.filePath, action: fileAction, status: "running", firstSeen: existing?.firstSeen ?? now };
      if (!existing || (existing.status === "done" && fileAction === "edit")) next.files[event.filePath] = op;
    }

    next.currentFile = event.filePath;
    next.currentCommand = event.command;
    next.stepsSeen += 1;

    if (event.action === "run" && event.command) {
      next.commandCount += 1;
      const { kind: commandKind, state } = classifyCommand(event.command);
      if (commandKind === "test") next.testsRun += 1;
      if (commandKind === "build") next.buildsRun += 1;
      next.state = state;
    } else if (event.action === "read") {
      next.state = "READING";
      next.readCount += 1;
    } else if (event.action === "search") {
      next.state = "SEARCHING";
    } else if (event.action === "edit" || event.action === "write") {
      next.state = "EDITING";
      if (event.action === "edit") next.editedCount += 1;
    } else if (event.action === "create") {
      next.state = "CREATING";
      next.createdCount += 1;
    } else if (event.action === "delete") {
      next.state = "DELETING";
      next.deletedCount += 1;
    } else if (event.action === "rename" || event.action === "move") {
      next.state = "MOVING";
      next.movedCount += 1;
    } else if (event.action === "list") {
      next.state = "ANALYZING";
    } else {
      next.state = "THINKING";
    }
    next.phrase = phraseForState(next.state, event);
    return next;
  }

  if (event.type === "agent.tool.completed" || event.type === "agent.tool.failed") {
    const runningIndex = [...next.activity].reverse().findIndex((entry) => entry.status === "running" && (event.command ? entry.command === event.command : entry.detail === (event.filePath ?? event.query ?? event.command)));
    if (runningIndex !== -1) {
      const index = next.activity.length - 1 - runningIndex;
      const entry = next.activity[index];
      next.activity[index] = { ...entry, status: event.type === "agent.tool.completed" ? "done" : "failed", durationMs: now - entry.startedAt };
    }
    if (event.filePath && next.files[event.filePath]) {
      next.files[event.filePath] = { ...next.files[event.filePath], status: event.type === "agent.tool.completed" ? "done" : "failed" };
    }
    next.stepsDone += 1;
    next.stepsSeen = Math.max(next.stepsSeen, next.stepsDone + (next.activity.some((entry) => entry.status === "running") ? 1 : 0));
    if (next.state !== "COMPLETED" && next.state !== "ERROR" && next.state !== "WAITING") next.state = "THINKING";
    next.phrase = "Réflexion…";
    return next;
  }

  if (event.type === "agent.file.change") {
    const existing = next.files[event.relativePath];
    if (existing && existing.status === "running") {
      next.files[event.relativePath] = { ...existing, status: "done" };
    } else {
      next.files[event.relativePath] = { path: event.relativePath, action: existing?.action ?? "edit", status: "done", firstSeen: now };
    }
    next.currentFile = event.relativePath;
    return next;
  }

  if (event.type === "agent.reasoning" || event.type === "agent.delta") {
    if (next.state !== "WAITING" && next.state !== "COMPLETED" && next.state !== "ERROR") {
      next.state = event.type === "agent.reasoning" ? "THINKING" : next.state === "THINKING" ? "THINKING" : next.state;
      next.phrase = event.type === "agent.reasoning" ? "Réflexion…" : "Génération de la réponse…";
    }
    return next;
  }

  if (event.type === "agent.approval.required") {
    next.state = "WAITING";
    next.phrase = "En attente d'approbation…";
    next.approvalCount += 1;
    const entry: ActivityEntry = {
      id: nextId("approval"),
      at: now,
      kind: "approval",
      label: "Approbation requise",
      detail: event.action.type === "terminal" ? event.action.command : event.action.relativePath,
      status: "running",
      startedAt: now,
    };
    next.activity = [...next.activity, entry].slice(-120);
    return next;
  }

  if (event.type === "agent.approval.resolved") {
    next.activity = next.activity.map((entry) => (entry.kind === "approval" && entry.status === "running" ? { ...entry, status: "done", detail: event.approved ? "Approuvé" : "Refusé", durationMs: now - entry.startedAt } : entry));
    next.state = "THINKING";
    next.phrase = "Réflexion…";
    return next;
  }

  if (event.type === "agent.completed") {
    next.state = "COMPLETED";
    next.phrase = "Tâche terminée";
    next.stepsSeen = Math.max(next.stepsSeen, next.stepsDone);
    const entry: ActivityEntry = {
      id: nextId("done"),
      at: now,
      kind: "done",
      label: "Terminé",
      status: "done",
      startedAt: now,
      durationMs: 0,
    };
    next.activity = [...next.activity, entry].slice(-120);
    return next;
  }

  if (event.type === "agent.error") {
    next.state = "ERROR";
    next.phrase = `Erreur : ${event.error.code}`;
    const entry: ActivityEntry = {
      id: nextId("error"),
      at: now,
      kind: "error",
      label: "Erreur",
      detail: event.error.message,
      status: "failed",
      startedAt: now,
      durationMs: 0,
    };
    next.activity = [...next.activity, entry].slice(-120);
    return next;
  }

  if (event.type === "agent.step") {
    if (event.step.status === "completed" || event.step.status === "failed") {
      next.stepsDone += 1;
      next.stepsSeen = Math.max(next.stepsSeen, next.stepsDone);
    } else if (event.step.status === "running") {
      next.stepsSeen += 1;
    }
    return next;
  }

  return next;
}
