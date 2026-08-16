"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  CircleStop,
  FolderOpen,
  Gauge,
  History,
  LoaderCircle,
  Menu,
  RotateCw,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { FileTypeIcon } from "@/features/work/file-icon";
import { applyTreeMutation, mutationFromFileChange, pendingOpFromToolStart, type PendingFileOp } from "@/features/work/live-tree";
import { WorkTreeContextMenu } from "@/features/work/work-context-menu";
import { Button } from "@/components/ui/button";
import { normalizeError } from "@/lib/api/errors";
import { useModelSelection } from "@/features/chat/model-selection-store";
import { darkenHex, hexToRgba, modelBrandColor, modelBrandSlug, providerSlug } from "@/features/chat/model-brand";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { useWorkspaceNav } from "@/components/workspace/workspace-shell";
import { WorkActionCard, type RunActivity } from "@/features/work/work-action-card";
import { WorkComposer } from "@/features/work/work-composer";
import { WorkFilesDrawer } from "@/features/work/work-files-drawer";
import { WorkFilePreview } from "@/features/work/work-file-preview";
import { WorkHistoryDrawer } from "@/features/work/work-history-drawer";
import { AegisIcon } from "@/components/aegis/aegis-icons";
import { AegisCore, coreStateFromActivity } from "@/components/aegis/aegis-core";
import { AegisBrand } from "@/components/aegis/aegis-brand";
import { AegisLogo } from "@/components/brand/aegis-logo";
import { DEFAULT_WORK_MODE, workModeById, type WorkAgentMode } from "@/features/work/work-modes";
import { DEFAULT_TEAM_ROLES, teamRequest, workTeamRoleMeta, type TeamSelectionMode } from "@/features/work/work-team";
import type { WorkAgentEvent, WorkAgentRole, WorkSessionCreateInput, WorkSessionPatchInput } from "@aegis/api-client";
import type { ChatMessage } from "@aegis/types";
import type { CSSProperties } from "react";

const MemoizedMarkdown = dynamic(() => import("@/features/chat/markdown").then((module) => module.MemoizedMarkdown), { ssr: false });

type TreeNode = { name: string; relativePath: string; type: "file" | "directory"; size?: number; children?: TreeNode[] };

function buildTree(nodes: Array<{ name: string; relativePath: string; type: "file" | "directory"; size?: number }>): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();
  for (const node of nodes) {
    const parts = node.relativePath.split("/");
    let parent = root;
    let prefix = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = prefix ? `${prefix}/${part}` : part;
      const isLast = i === parts.length - 1;
      let entry = map.get(path);
      if (!entry) {
        entry = { name: part, relativePath: path, type: isLast ? node.type : "directory", size: isLast ? node.size : undefined, children: [] };
        map.set(path, entry);
        parent.push(entry);
      }
      if (!isLast) parent = entry.children ?? [];
      prefix = path;
    }
  }
  return root;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const walk = (list: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const node of list) {
      const children = node.children ? walk(node.children) : [];
      if (node.name.toLowerCase().includes(q) || children.length > 0) out.push({ ...node, children });
    }
    return out;
  };
  return walk(nodes);
}

type RunBudget = {
  used: number;
  total: number;
  turns: number;
  hardTurns: number;
  actions: number;
  filesChanged: number;
  testsRun: number;
  status: "active" | "low" | "exhausted" | "stalled";
};

type RunState = {
  prompt: string;
  delta: string;
  reasoning: string;
  reasoningOpen: boolean;
  activity: RunActivity[];
  changedFiles: string[];
  error: string | null;
  done: boolean;
  thinking: boolean;
  startedAt: number;
  durationMs?: number;
  memberId?: string;
  memberName?: string;
  memberRole?: string;
  budget?: RunBudget;
  checkpoint?: { messages: ChatMessage[]; changedFiles: string[] };
  stalledReason?: string;
};

function serializeRuns(runs: RunState[]): unknown[] {
  return runs.slice(-12).map((run) => ({
    prompt: run.prompt.slice(0, 8_000),
    delta: run.delta.slice(-20_000),
    reasoning: run.reasoning.slice(-6_000),
    reasoningOpen: run.reasoningOpen,
    activity: run.activity,
    changedFiles: run.changedFiles,
    error: run.error,
    done: run.done,
    thinking: run.thinking,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    budget: run.budget,
    checkpoint: run.checkpoint,
    stalledReason: run.stalledReason,
  }));
}

function deserializeRuns(value: unknown): RunState[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      prompt: typeof entry.prompt === "string" ? entry.prompt : "",
      delta: typeof entry.delta === "string" ? entry.delta : "",
      reasoning: typeof entry.reasoning === "string" ? entry.reasoning : "",
      reasoningOpen: true,
      activity: Array.isArray(entry.activity) ? (entry.activity as RunActivity[]) : [],
      changedFiles: Array.isArray(entry.changedFiles) ? entry.changedFiles.filter((f): f is string => typeof f === "string") : [],
      error: typeof entry.error === "string" ? entry.error : null,
      done: Boolean(entry.done),
      thinking: false,
      startedAt: typeof entry.startedAt === "number" ? entry.startedAt : Date.now(),
      durationMs: typeof entry.durationMs === "number" ? entry.durationMs : undefined,
      budget: entry.budget && typeof entry.budget === "object" ? (entry.budget as RunBudget) : undefined,
      checkpoint: entry.checkpoint && typeof entry.checkpoint === "object"
        ? {
            messages: Array.isArray((entry.checkpoint as { messages?: unknown }).messages) ? ((entry.checkpoint as { messages: unknown }).messages as ChatMessage[]) : [],
            changedFiles: Array.isArray((entry.checkpoint as { changedFiles?: unknown }).changedFiles) ? ((entry.checkpoint as { changedFiles: string[] }).changedFiles) : [],
          }
        : undefined,
      stalledReason: typeof entry.stalledReason === "string" ? entry.stalledReason : undefined,
    }))
    .filter((run) => run.prompt.length > 0 || run.delta.length > 0)
    .slice(-12);
}

/** Pure reducer over the run list. `continueIndex` targets the exact run being
 * resumed for non-team events; member events keep routing by memberId. */
function applyAgentEventToRuns(runs: RunState[], event: WorkAgentEvent, continueIndex?: number): RunState[] {
  if (event.type === "agent.team.plan") return runs;
  if (event.type === "agent.member.started") {
    const member = event.member;
    const meta = workTeamRoleMeta(member.role);
    return [...runs, {
      prompt: `Équipe — ${member.name}`,
      delta: "",
      reasoning: "",
      reasoningOpen: true,
      activity: [],
      changedFiles: [],
      error: null,
      done: false,
      thinking: true,
      startedAt: Date.now(),
      memberId: member.id,
      memberName: member.name,
      memberRole: meta.description,
    }];
  }
  const memberId = "memberId" in event && event.memberId ? event.memberId : undefined;
  const targetIndex = continueIndex !== undefined && !memberId
    ? continueIndex
    : memberId
      ? runs.findIndex((run) => run.memberId === memberId)
      : runs.length - 1;
  const target = targetIndex >= 0 ? runs[targetIndex] : runs[runs.length - 1];
  if (!target) return runs;
  const next = { ...target };
  if (event.type === "agent.delta") { next.delta += event.delta; next.thinking = false; }
  if (event.type === "agent.reasoning") { next.reasoning += event.delta; next.thinking = true; }
  if (event.type === "agent.progress") { next.budget = event.progress; }
  if (event.type === "agent.budget.low") {
    next.budget = { ...(next.budget ?? emptyBudget(event.total)), used: event.used, total: event.total, status: "low" };
  }
  if (event.type === "agent.budget.exhausted") {
    next.budget = { ...(next.budget ?? emptyBudget(event.total)), used: event.used, total: event.total, status: "exhausted" };
    next.checkpoint = event.checkpoint;
    next.done = true;
    next.thinking = false;
    next.durationMs = Date.now() - next.startedAt;
  }
  if (event.type === "agent.stalled") {
    next.stalledReason = event.reason;
    if (next.budget) next.budget = { ...next.budget, status: "stalled" };
    next.done = true;
    next.thinking = false;
    next.durationMs = Date.now() - next.startedAt;
  }
  if (event.type === "agent.tool.started") {
    next.activity = next.activity.filter((item) => !(item.kind === "tool" && item.tool === event.tool && (item.state === "done" || item.state === "failed")));
    next.activity = [...next.activity, { kind: "tool" as const, tool: event.tool, state: "running" as const, detail: event.filePath ?? event.query ?? event.command, command: event.command }];
    next.thinking = false;
  }
  if (event.type === "agent.tool.completed" || event.type === "agent.tool.failed") {
    next.activity = next.activity.map((item) => (item.kind === "tool" && item.tool === event.tool && item.state === "running" ? { ...item, state: event.type === "agent.tool.completed" ? "done" as const : "failed" as const } : item));
    if (event.type === "agent.tool.completed") next.thinking = false;
  }
  if (event.type === "agent.file.change") {
    const patch = event.patch;
    const action = patch ? (patch.before === "" ? "create" as const : patch.after === "" ? "delete" as const : "edit" as const) : undefined;
    next.activity = [...next.activity.filter((item) => !(item.kind === "file" && item.relativePath === event.relativePath)), { kind: "file" as const, relativePath: event.relativePath, action, patch }];
    if (!next.changedFiles.includes(event.relativePath)) next.changedFiles = [...next.changedFiles, event.relativePath];
  }
  if (event.type === "agent.approval.required" && !next.activity.some((item) => item.kind === "approval" && item.approvalId === event.approvalId)) {
    next.activity = [...next.activity, { kind: "approval" as const, approvalId: event.approvalId, action: event.action, reason: event.reason }];
  }
  if (event.type === "agent.approval.resolved") {
    next.activity = next.activity.map((item) => (item.kind === "approval" && item.approvalId === event.approvalId ? { ...item, resolved: true, approved: event.approved } : item));
  }
  if (event.type === "agent.completed") { next.delta += `\n\n${event.message}`; next.done = true; next.thinking = false; next.durationMs = Date.now() - next.startedAt; }
  if (event.type === "agent.error") { next.error = event.error.message; next.done = true; next.thinking = false; next.durationMs = Date.now() - next.startedAt; }
  const updated = [...runs];
  if (targetIndex >= 0) updated[targetIndex] = next;
  else updated[updated.length - 1] = next;
  return updated;
}

function emptyBudget(total: number): RunBudget {
  return { used: 0, total, turns: 0, hardTurns: 0, actions: 0, filesChanged: 0, testsRun: 0, status: "active" };
}

export function WorkMode() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openNav } = useWorkspaceNav();
  const { selectedModel: model, modelHydrationStatus } = useModelSelection();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [notice, setNotice] = useState<{ title: string; description: string; tone?: "error" } | null>(null);

  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [draftContent, setDraftContent] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [editorLine, setEditorLine] = useState(1);

  const [agentActivity, setAgentActivity] = useState<{ label: string; detail?: string; action?: string } | null>(null);
  const [agentCurrentFile, setAgentCurrentFile] = useState<string | null>(null);
  const [activityPopover, setActivityPopover] = useState(false);
  const [mode, setAgentMode] = useState<WorkAgentMode>(DEFAULT_WORK_MODE);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState<TeamSelectionMode>("single");
  const [teamRoles, setTeamRoles] = useState<WorkAgentRole[]>(DEFAULT_TEAM_ROLES.slice(1));

  const pendingFileOpRef = useRef<PendingFileOp | null>(null);
  const filesScrollRef = useRef<HTMLDivElement | null>(null);
  const filesSearchRef = useRef<HTMLInputElement | null>(null);
  const hydratedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dirtyFilesRef = useRef<Set<string>>(dirtyFiles);
  const runsRef = useRef<RunState[]>(runs);
  const streamingRunIndexRef = useRef<number | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const saveSessionTimerRef = useRef<number | null>(null);
  useEffect(() => { dirtyFilesRef.current = dirtyFiles; }, [dirtyFiles]);
  useEffect(() => { runsRef.current = runs; }, [runs]);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  const syncHighlight = () => {
    const pre = highlightRef.current;
    const textarea = pre?.parentElement?.querySelector("textarea");
    if (!pre || !textarea) return;
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  };

  const status = useQuery({
    queryKey: ["work-status"],
    queryFn: () => api.workStatus(),
    refetchInterval: (query) => (query.state.status === "error" ? 5_000 : 20_000),
    retry: 0,
  });
  const connectAgent = useMutation({
    mutationFn: () => api.workConnect(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-status"] });
      await queryClient.invalidateQueries({ queryKey: ["work-workspaces"] });
    },
    onError: (error) => setNotice({ title: "Could not connect to Local Agent", description: normalizeError(error).message, tone: "error" }),
  });
  const workspaces = useQuery({ queryKey: ["work-workspaces"], queryFn: () => api.workWorkspaces(), retry: 0 });

  const sessionsQuery = useQuery({ queryKey: ["work-sessions"], queryFn: () => api.workListSessions(), retry: 0 });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects(), retry: 0 });
  const projects = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data?.projects]);

  const createSession = useMutation({
    mutationFn: (input: WorkSessionCreateInput) => api.workCreateSession(input),
    onSuccess: (data) => {
      activeSessionIdRef.current = data.session.id;
      setActiveSessionId(data.session.id);
      void queryClient.invalidateQueries({ queryKey: ["work-sessions"] });
    },
  });

  const saveSession = useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkSessionPatchInput }) => api.workUpdateSession(id, input),
    onSettled: () => setSavingSession(false),
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => api.workDeleteSession(id),
    onSuccess: (_data, id) => {
      if (activeSessionIdRef.current === id) {
        activeSessionIdRef.current = null;
        setActiveSessionId(null);
        setRuns([]);
      }
      void queryClient.invalidateQueries({ queryKey: ["work-sessions"] });
    },
  });

  const linkProject = useMutation({
    mutationFn: ({ sessionId, projectId }: { sessionId: string; projectId: string | null }) =>
      api.workUpdateSession(sessionId, { projectId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["work-sessions"] }),
  });

  const createWorkProject = useMutation({
    mutationFn: (input: { name: string; description?: string }) => api.createProject(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      const sessionId = activeSessionIdRef.current;
      if (sessionId) linkProject.mutate({ sessionId, projectId: data.project.id });
    },
  });

  /** Debounced save: pushes the current runs + workspace/model snapshot into the
   * active server session a moment after the UI settles, and right after a run. */
  useEffect(() => {
    if (saveSessionTimerRef.current !== null) window.clearTimeout(saveSessionTimerRef.current);
    if (!activeSessionId) return;
    saveSessionTimerRef.current = window.setTimeout(() => {
      setSavingSession(true);
      saveSession.mutate({
        id: activeSessionId,
        input: { messages: serializeRuns(runs), workspaceId, providerId: model?.providerId ?? null, model: model?.name ?? null },
      });
    }, 1_800);
    return () => {
      if (saveSessionTimerRef.current !== null) window.clearTimeout(saveSessionTimerRef.current);
    };
  }, [runs, activeSessionId, workspaceId, model?.providerId, model?.name, saveSession]);

  const flushActiveSession = useCallback(() => {
    const id = activeSessionIdRef.current;
    if (!id) return;
    if (saveSessionTimerRef.current !== null) {
      window.clearTimeout(saveSessionTimerRef.current);
      saveSessionTimerRef.current = null;
    }
    setSavingSession(true);
    saveSession.mutate({
      id,
      input: { messages: serializeRuns(runsRef.current), workspaceId, providerId: model?.providerId ?? null, model: model?.name ?? null },
    });
  }, [workspaceId, model?.providerId, model?.name, saveSession]);

  const newSession = () => {
    if (streaming) return;
    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    setRuns([]);
    setInput("");
    setHistoryOpen(false);
    createSession.mutate({ workspaceId: workspaceId ?? undefined, providerId: model?.providerId ?? undefined, model: model?.name ?? undefined });
  };

  const loadSession = useCallback(async (id: string) => {
    if (streaming) return;
    try {
      const { session } = await api.workGetSession(id);
      activeSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setRuns(deserializeRuns(session.messages));
      if (session.workspaceId) setWorkspaceId(session.workspaceId);
      setHistoryOpen(false);
    } catch (error) {
      setNotice({ title: "Session introuvable", description: normalizeError(error).message, tone: "error" });
    }
  }, [streaming]);

  const renameSession = useCallback((id: string, title: string) => {
    saveSession.mutate({ id, input: { title } });
  }, [saveSession]);

  useEffect(() => {
    if (status.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] });
      if (workspaceId) void queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] });
    }
  }, [status.isSuccess, queryClient, workspaceId]);
  const workspaceList = useMemo(() => workspaces.data?.workspaces ?? [], [workspaces.data?.workspaces]);

  const tree = useQuery({
    queryKey: ["work-tree", workspaceId],
    queryFn: () => api.workTree(workspaceId as string),
    enabled: Boolean(workspaceId),
    retry: 0,
  });
  const treeNodes = useMemo(() => buildTree(tree.data?.tree ?? []), [tree.data?.tree]);

  const file = useQuery({
    queryKey: ["work-file", workspaceId, activeFile],
    queryFn: () => api.workReadFile(workspaceId as string, activeFile as string),
    enabled: Boolean(workspaceId && activeFile),
    retry: 0,
  });

  const saveFile = useMutation({
    mutationFn: () => api.workWriteFile(workspaceId as string, activeFile as string, draftContent),
    onSuccess: async () => {
      if (!workspaceId || !activeFile) return;
      setDirtyFiles((current) => { const next = new Set(current); next.delete(activeFile); return next; });
      await queryClient.invalidateQueries({ queryKey: ["work-file", workspaceId, activeFile] });
      await queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] });
    },
    onError: (error) => setNotice({ title: "Could not save file", description: normalizeError(error).message, tone: "error" }),
  });

  const deleteFile = useMutation({
    mutationFn: (relativePath: string) => api.workDeleteFile(workspaceId as string, relativePath),
    onSuccess: async (_, relativePath) => {
      setOpenFiles((current) => current.filter((path) => path !== relativePath));
      if (activeFile === relativePath) { setActiveFile(null); setPreviewOpen(false); }
      await queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["work-workspaces"] });
    },
    onError: (error) => setNotice({ title: "Could not delete file", description: normalizeError(error).message, tone: "error" }),
  });

  const renameFile = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => api.workMove(workspaceId as string, from, to),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["work-workspaces"] });
    },
    onError: (error) => setNotice({ title: "Could not rename", description: normalizeError(error).message, tone: "error" }),
  });

  const revealFile = useMutation({
    mutationFn: (relativePath?: string) => api.workReveal(workspaceId as string, relativePath),
    onError: (error) => setNotice({ title: "Could not reveal", description: normalizeError(error).message, tone: "error" }),
  });

  const treeContext = (relativePath: string, isDir: boolean) => ({
    open: () => { if (isDir) toggle(relativePath); else openFile(relativePath); },
    rename: () => {
      const next = window.prompt(`Rename ${isDir ? "folder" : "file"}`, relativePath);
      if (next && next.trim() && next.trim() !== relativePath) {
        const parent = relativePath.split("/").slice(0, -1).join("/");
        const to = parent ? `${parent}/${next.trim()}` : next.trim();
        renameFile.mutate({ from: relativePath, to });
      }
    },
    del: () => { if (window.confirm(`Delete ${relativePath}?`)) deleteFile.mutate(relativePath); },
    copyPath: () => { void navigator.clipboard.writeText(relativePath); },
    reveal: () => revealFile.mutate(relativePath),
  });

  const trust = useMutation({
    mutationFn: (root: string) => api.workTrust({ root, mode: "trusted" }),
    onSuccess: (data) => { setWorkspaceId(data.workspace.id); void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] }); },
    onError: (error) => setNotice({ title: "Could not trust folder", description: normalizeError(error).message, tone: "error" }),
  });

  const pickWorkspace = useMutation({
    mutationFn: () => api.workPickWorkspace(),
    onSuccess: (data) => {
      if (data.root) trust.mutate(data.root);
      else setNotice({ title: "Workspace selection cancelled", description: "No folder was connected." });
    },
    onError: (error) => setNotice({ title: "Workspace picker unavailable", description: normalizeError(error).message, tone: "error" }),
  });

  const untrust = useMutation({
    mutationFn: (id: string) => api.workUntrust(id),
    onSuccess: () => { setWorkspaceId(null); setActiveFile(null); setOpenFiles([]); setDirtyFiles(new Set()); setPreviewOpen(false); setFilesDrawerOpen(false); void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] }); },
  });

  const switchWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    setActiveFile(null);
    setOpenFiles([]);
    setDirtyFiles(new Set());
    setDrafts({});
    setPreviewOpen(false);
  }, []);

  const setMode = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "trusted" | "restricted" }) => api.workSetMode(id, mode),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] }),
  });

  const undoAgentChange = useMutation({
    mutationFn: () => api.workUndo(workspaceId as string),
    onSuccess: async (result) => {
      setNotice({ title: "Change rolled back", description: result.relativePath });
      await queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] });
      if (activeFile === result.relativePath) await queryClient.invalidateQueries({ queryKey: ["work-file", workspaceId, activeFile] });
    },
    onError: (error) => setNotice({ title: "Rollback unavailable", description: normalizeError(error).message, tone: "error" }),
  });

  const resolveApproval = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => api.workResolveApproval(id, approved),
    onSuccess: (_data, vars) => {
      setRuns((current) => {
        const last = current[current.length - 1];
        if (!last) return current;
        const activity = last.activity.map((item) => (item.kind === "approval" && item.approvalId === vars.id ? { ...item, resolved: true, approved: vars.approved } : item));
        return [...current.slice(0, -1), { ...last, activity }];
      });
    },
    onError: (error) => setNotice({ title: "Approval failed", description: normalizeError(error).message, tone: "error" }),
  });

  const toggle = useCallback((relativePath: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(relativePath)) next.delete(relativePath);
      else next.add(relativePath);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!workspaceList.length) return;
    if (!workspaceId || !workspaceList.some((workspace) => workspace.id === workspaceId)) {
      setWorkspaceId(workspaceList[0].id);
    }
  }, [workspaceList, workspaceId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("aegis.work.session");
      if (raw) {
        const saved = JSON.parse(raw) as { workspaceId?: string; activeFile?: string | null; openFiles?: string[]; expanded?: string[]; runs?: RunState[]; drafts?: Record<string, string>; dirtyFiles?: string[] };
        if (saved.workspaceId) setWorkspaceId(saved.workspaceId);
        if (saved.activeFile) setActiveFile(saved.activeFile);
        if (saved.openFiles?.length) setOpenFiles(saved.openFiles.slice(0, 12));
        if (saved.expanded?.length) setExpanded(new Set(saved.expanded));
        if (saved.runs?.length) setRuns(saved.runs.slice(-12).map((run) => ({ ...run, timeline: undefined })));
        if (saved.drafts) setDrafts(saved.drafts);
        if (saved.dirtyFiles?.length) setDirtyFiles(new Set(saved.dirtyFiles));
      }
    } catch { /* corrupted local UI state is safe to ignore */ }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem("aegis.work.session", JSON.stringify({
      workspaceId,
      activeFile,
      openFiles,
      expanded: [...expanded],
      drafts: Object.fromEntries(Object.entries(drafts).map(([path, content]) => [path, content.slice(-50_000)])),
      dirtyFiles: [...dirtyFiles],
      runs: runs.slice(-12).map((run) => ({ ...run, delta: run.delta.slice(-20_000), reasoning: run.reasoning.slice(-6_000) })),
    }));
  }, [workspaceId, activeFile, openFiles, expanded, drafts, dirtyFiles, runs]);

  useEffect(() => {
    if (file.data && activeFile && !dirtyFiles.has(activeFile)) {
      setDrafts((current) => ({ ...current, [activeFile]: file.data?.content ?? "" }));
      setDraftContent(file.data.content);
    }
  }, [file.data, activeFile, dirtyFiles]);

  const closeFile = useCallback((relativePath: string) => {
    setOpenFiles((current) => {
      const next = current.filter((path) => path !== relativePath);
      if (relativePath === activeFile) {
        const index = current.indexOf(relativePath);
        const neighbor = next[index - 1] ?? next[index] ?? null;
        if (neighbor) { setActiveFile(neighbor); setDraftContent(drafts[neighbor] ?? ""); }
        else { setActiveFile(null); setPreviewOpen(false); }
      }
      return next;
    });
  }, [activeFile, drafts]);

  const openFile = (relativePath: string) => {
    setActiveFile(relativePath);
    setDraftContent(drafts[relativePath] ?? "");
    setOpenFiles((current) => (current.includes(relativePath) ? current : [...current, relativePath].slice(-12)));
    setPreviewOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setFilesDrawerOpen(true);
        setDrawerQuery("");
        requestAnimationFrame(() => filesSearchRef.current?.focus());
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFilesDrawerOpen(true);
        setDrawerQuery("");
        requestAnimationFrame(() => filesSearchRef.current?.focus());
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
        event.preventDefault();
        if (activeFile) closeFile(activeFile);
      }
      if (event.key === "Escape") { setFilesDrawerOpen(false); setPreviewOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFile, closeFile]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }));
  }, [runs, streaming]);

  const renderNode = (node: TreeNode, depth: number) => {
    const isDir = node.type === "directory";
    const isFiltering = drawerQuery.trim().length > 0;
    const open = isFiltering || expanded.has(node.relativePath);
    return (
      <div key={node.relativePath}>
        <WorkTreeContextMenu isDir={isDir} actions={treeContext(node.relativePath, isDir)}>
          <button
            type="button"
            className="work-tree__item"
            data-path={node.relativePath}
            data-dir={isDir}
            data-active={!isDir && node.relativePath === activeFile}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => { if (isDir) toggle(node.relativePath); else openFile(node.relativePath); }}
          >
            {isDir ? (open ? <FolderOpen size={14} /> : <ChevronRight size={13} />) : <FileTypeIcon name={node.name} />}
            <span>{node.name}</span>
          </button>
        </WorkTreeContextMenu>
        {isDir && open && (node.children ?? []).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const workspace = workspaceList.find((w) => w.id === workspaceId) ?? workspaceList[0];
  const canSend = Boolean(input.trim()) && Boolean(model) && modelHydrationStatus !== "loading" && !streaming && Boolean(workspaceId);

  /** Open every parent directory of a file so it is visible in the tree, then
   * scroll it into view. This is what makes the explorer follow the agent in
   * real time without any manual refresh. */
  const revealInTree = (relativePath: string) => {
    const parts = relativePath.split("/");
    if (parts.length <= 1) return;
    setExpanded((current) => {
      const next = new Set(current);
      let prefix = "";
      for (let i = 0; i < parts.length - 1; i += 1) {
        prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
        next.add(prefix);
      }
      return next;
    });
    requestAnimationFrame(() => {
      const container = filesScrollRef.current;
      const node = container?.querySelector(`[data-path="${CSS.escape(relativePath)}"]`);
      node?.scrollIntoView({ block: "nearest" });
    });
  };

  /** Execute an agent-issued command and attach its output to the run's tool
   * card. The command never opens a panel: it lives inline in the chat. */
  const executeCommandIntoRun = async (runIndex: number, command: string) => {
    if (!workspaceId || runIndex == null) return;
    try {
      const startedAt = Date.now();
      const result = await api.workRunCommand(workspaceId, command);
      const durationMs = Date.now() - startedAt;
      setRuns((current) => current.map((r, i) => i !== runIndex ? r : {
        ...r,
        activity: r.activity.map((item) => (item.kind === "tool" && item.command === command && item.state === "done" ? { ...item, output: result, durationMs } : item)),
      }));
    } catch (error) {
      setNotice({ title: "Command blocked", description: normalizeError(error).message, tone: "error" });
      setRuns((current) => current.map((r, i) => i !== runIndex ? r : {
        ...r,
        activity: r.activity.map((item) => (item.kind === "tool" && item.command === command && item.state === "running" ? { ...item, state: "failed" } : item)),
      }));
    }
  };

  /** Refetch a file that is open so its content follows the agent's changes
   * live. Skips files with unsaved local edits to avoid clobbering the user's
   * work. */
  const refreshOpenFile = async (workspaceIdValue: string, relativePath: string) => {
    if (dirtyFilesRef.current.has(relativePath) || activeFile === relativePath) return;
    try {
      const result = await api.workReadFile(workspaceIdValue, relativePath);
      setDrafts((current) => (current[relativePath] === result.content ? current : { ...current, [relativePath]: result.content }));
    } catch {
      // keep the stale draft if the refetch fails
    }
  };

  /** Optimistically patch the tree cache so files appear/update the instant the
   * agent acts, then reconcile with a refetch. */
  const patchTreeCache = (workspaceIdValue: string, mutation: { action: string; path: string; to?: string }) => {
    queryClient.setQueryData<{ tree: Array<{ name: string; relativePath: string; type: "file" | "directory"; size?: number }> }>(["work-tree", workspaceIdValue], (old) => {
      if (!old) return old;
      return { tree: applyTreeMutation(old.tree, mutation as Parameters<typeof applyTreeMutation>[1]) };
    });
  };

  const handleAgentEvent = (event: WorkAgentEvent, workspaceIdValue: string) => {
    if (event.type === "agent.tool.started") {
      const label = event.action === "search" ? "Analyser" : event.action === "read" ? "Lire" : event.action === "edit" ? "Éditer" : event.action === "create" ? "Créer" : event.action === "delete" ? "Supprimer" : event.action === "rename" || event.action === "move" ? "Déplacer" : event.action === "run" ? "Commande" : event.action === "list" ? "Lister" : "Travailler";
      setAgentActivity({ label, detail: event.filePath ?? event.query ?? event.command ?? event.tool, action: event.action });
      const pending = pendingOpFromToolStart(event);
      pendingFileOpRef.current = pending;
      if (pending && (pending.action === "create" || pending.action === "delete" || pending.action === "move" || pending.action === "copy")) {
        patchTreeCache(workspaceIdValue, { action: pending.action, path: pending.path });
      }
      if (event.filePath) {
        setAgentCurrentFile(event.filePath);
        revealInTree(event.filePath);
      }
    }
    if (event.type === "agent.tool.completed") {
      if (event.action === "run" && event.command && streamingRunIndexRef.current != null) {
        void executeCommandIntoRun(streamingRunIndexRef.current, event.command);
      }
    }
    if (event.type === "agent.tool.failed") {
      setAgentActivity({ label: `${event.action ?? event.tool} a échoué`, detail: event.message ?? event.filePath ?? event.tool, action: event.action });
    }
    if (event.type === "agent.file.change") {
      const mutation = mutationFromFileChange(event, pendingFileOpRef.current);
      if (mutation.action !== "edit" && mutation.action !== "read") patchTreeCache(workspaceIdValue, mutation);
      pendingFileOpRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceIdValue] });
      if (activeFile === event.relativePath) void queryClient.invalidateQueries({ queryKey: ["work-file", workspaceIdValue, activeFile] });
      void refreshOpenFile(workspaceIdValue, event.relativePath);
      revealInTree(event.relativePath);
      setAgentCurrentFile(event.relativePath);
    }
    if (event.type === "agent.completed") {
      setAgentActivity({ label: "Terminé", action: "done" });
    }
    if (event.type === "agent.error") {
      setAgentActivity({ label: `Erreur: ${event.error.code}`, detail: event.error.message, action: "error" });
    }
    if (event.type === "agent.budget.exhausted") {
      setAgentActivity({ label: "Budget épuisé", detail: event.reason, action: "done" });
    }
    if (event.type === "agent.stalled") {
      setAgentActivity({ label: "Boucle détectée", detail: event.reason, action: "error" });
    }
    if (event.type === "agent.budget.low") {
      setAgentActivity({ label: "Budget presque épuisé", detail: event.message, action: "thinking" });
    }
  };

  const sendPrompt = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !workspaceId || streaming) return;
    if (!model) { setNotice({ title: "No model selected", description: "Pick a model to run the agent.", tone: "error" }); return; }
    const captureModel = model;
    const activeWorkspaceId = workspaceId;
    const attachedContext = await buildAttachedContext(activeWorkspaceId, attachedFiles);
    const fullText = attachedContext ? `${text}\n\n--- Contexte fichiers attachés ---\n${attachedContext}` : text;
    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      try {
        const created = await api.workCreateSession({
          title: text.slice(0, 60) || "Nouvelle session",
          workspaceId: activeWorkspaceId,
          providerId: captureModel.providerId,
          model: captureModel.name,
        });
        sessionId = created.session.id;
        activeSessionIdRef.current = sessionId;
        setActiveSessionId(sessionId);
        void queryClient.invalidateQueries({ queryKey: ["work-sessions"] });
      } catch (error) {
        setNotice({ title: "Impossible de créer la session", description: normalizeError(error).message, tone: "error" });
        return;
      }
    }
    setInput("");
    const runIndex = runsRef.current.length;
    streamingRunIndexRef.current = runIndex;
    setRuns((current) => [...current, { prompt: text, delta: "", reasoning: "", reasoningOpen: true, activity: [], changedFiles: [], error: null, done: false, thinking: true, startedAt: Date.now() }]);
    setAgentActivity({ label: "Travail en cours…", detail: text, action: "thinking" });
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const team = teamRequest(teamMode, teamRoles);
    try {
      for await (const event of api.workStreamAgent({ workspaceId: activeWorkspaceId, providerId: captureModel.providerId, model: captureModel.name, messages: [{ role: "user", content: fullText }], instructions: workModeById(mode).instructions, team }, controller.signal)) {
        handleAgentEvent(event, activeWorkspaceId);
        setRuns((current) => applyAgentEventToRuns(current, event, runIndex));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setAgentActivity({ label: "Arrêté", detail: normalizeError(error).message, action: "error" });
      setRuns((current) => {
        const target = current[runIndex] ?? current[current.length - 1];
        if (!target) return current;
        return current.map((run, index) => (index === runIndex ? { ...run, error: normalizeError(error).message, done: true, thinking: false, durationMs: Date.now() - run.startedAt } : run));
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
      streamingRunIndexRef.current = null;
      window.setTimeout(() => flushActiveSession(), 400);
    }
  };

  /** Resume an interrupted run from its saved checkpoint: the local agent
   * receives the full prior conversation and continues exactly where it stopped
   * instead of re-analyzing the whole task from scratch. */
  const continueRun = async (index: number) => {
    const run = runsRef.current[index];
    if (!run || !run.checkpoint || !workspaceId || streaming) return;
    if (!model) { setNotice({ title: "No model selected", description: "Pick a model to run the agent.", tone: "error" }); return; }
    const captureModel = model;
    const activeWorkspaceId = workspaceId;
    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      try {
        const created = await api.workCreateSession({
          title: run.prompt.slice(0, 60) || "Nouvelle session",
          workspaceId: activeWorkspaceId,
          providerId: captureModel.providerId,
          model: captureModel.name,
        });
        sessionId = created.session.id;
        activeSessionIdRef.current = sessionId;
        setActiveSessionId(sessionId);
        void queryClient.invalidateQueries({ queryKey: ["work-sessions"] });
      } catch (error) {
        setNotice({ title: "Impossible de créer la session", description: normalizeError(error).message, tone: "error" });
        return;
      }
    }
    setInput("");
    streamingRunIndexRef.current = index;
    setRuns((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, done: false, error: null, thinking: true, stalledReason: undefined, startedAt: Date.now(), budget: entry.budget ? { ...entry.budget, status: "active" } : undefined } : entry)));
    setAgentActivity({ label: "Reprise de la tâche…", detail: run.prompt, action: "thinking" });
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const team = teamRequest(teamMode, teamRoles);
    try {
      for await (const event of api.workStreamAgent({
        workspaceId: activeWorkspaceId,
        providerId: captureModel.providerId,
        model: captureModel.name,
        messages: [{ role: "user", content: run.prompt }],
        instructions: workModeById(mode).instructions,
        resume: { messages: run.checkpoint.messages, changedFiles: run.changedFiles },
        team,
      }, controller.signal)) {
        handleAgentEvent(event, activeWorkspaceId);
        setRuns((current) => applyAgentEventToRuns(current, event, index));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setAgentActivity({ label: "Arrêté", detail: normalizeError(error).message, action: "error" });
      setRuns((current) => current.map((runEntry, runIndex) => (runIndex === index ? { ...runEntry, error: normalizeError(error).message, done: true, thinking: false, durationMs: Date.now() - runEntry.startedAt } : runEntry)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      streamingRunIndexRef.current = null;
      window.setTimeout(() => flushActiveSession(), 400);
    }
  };

  const stop = () => abortRef.current?.abort();

  /** Read attached files and fold their content into the prompt as explicit
   * context blocks, so the model sees them without any extra tool call. */
  const buildAttachedContext = async (workspaceIdValue: string, paths: string[]) => {
    if (!paths.length) return "";
    const blocks: string[] = [];
    for (const path of paths) {
      try {
        const file = await api.workReadFile(workspaceIdValue, path);
        blocks.push(`<file path="${path}">\n${file.content.slice(0, 12_000)}\n</file>`);
      } catch {
        blocks.push(`<file path="${path}">(lecture impossible)</file>`);
      }
    }
    return blocks.join("\n\n");
  };

  const attachFile = useCallback((relativePath: string) => {
    setAttachedFiles((current) => (current.includes(relativePath) ? current : [...current, relativePath].slice(-8)));
  }, []);

  const removeAttachedFile = useCallback((relativePath: string) => {
    setAttachedFiles((current) => current.filter((path) => path !== relativePath));
  }, []);

  const renderRun = (run: RunState, index: number) => {
    const isStreaming = streaming && streamingRunIndexRef.current === index;
    const toolsRunning = run.activity.some((item) => item.kind === "tool" && item.state === "running");
    const phase = run.thinking ? "thinking" : toolsRunning ? "acting" : isStreaming && run.delta ? "writing" : run.done ? "done" : "idle";
    const hasChanges = run.changedFiles.length > 0;
    const interrupted = run.budget?.status === "exhausted" || run.budget?.status === "stalled" || Boolean(run.stalledReason);
    const budgetPct = run.budget && run.budget.total > 0 ? Math.min(100, Math.round((run.budget.used / run.budget.total) * 100)) : 0;
    const remaining = run.budget ? Math.max(0, run.budget.total - run.budget.used) : undefined;

    return (
      <motion.div key={index} className="work-run" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
        <motion.div
          className={`work-run__prompt ${run.memberId ? "work-run__prompt--member" : ""}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
        >
          <div className="work-run__prompt-meta">
            <span className="work-run__prompt-name">{run.memberId ? "Équipe" : "Vous"}</span>
            <span className="work-run__time">{new Date(run.startedAt).toLocaleTimeString()}</span>
          </div>
          <div className="work-run__prompt-text">{run.memberId ? `${run.memberName ?? "Agent"} — ${run.memberRole ?? ""}` : run.prompt}</div>
        </motion.div>

        <motion.article
          className={`v3-msg__card work-run__card ${isStreaming ? "v3-msg--streaming" : ""}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.06 }}
        >
          <span className="work-run__glow" data-phase={phase} aria-hidden="true" />

          <header className="v3-msg__head">
            <motion.span
              className={`v3-msg__avatar work-avatar ${isStreaming ? "work-avatar--live" : ""}`}
              animate={isStreaming ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={isStreaming ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            >
              {isStreaming ? <AegisCore state={coreStateFromActivity(agentActivity, true)} size={16} /> : model ? <ProviderIcon provider={modelBrandSlug(model, providerSlug(model.providerKind || model.providerName || ""))} size={16} /> : <AegisLogo size={16} />}
              {isStreaming && <i className="work-avatar__ping" aria-hidden="true" />}
            </motion.span>
            <span className="v3-msg__identity">
              <strong className="v3-msg__model">{run.memberId ? run.memberName ?? "Agent spécialisé" : model?.name || "Aegis Agent"}</strong>
              <span className="v3-msg__provider"><AegisIcon name="agent" size={9} />{run.memberId ? run.memberRole ?? "work mode" : model?.providerName || "work mode"}</span>
            </span>
            {isStreaming && (
              <span className="v3-msg__live" data-phase={phase}>
                <i />
                {phase === "thinking" ? "Réflexion" : phase === "acting" ? "Exécution" : "Écriture"}
              </span>
            )}
            <div className="v3-msg__actions">
              {isStreaming && (
                <Button size="sm" variant="secondary" onClick={stop}><CircleStop size={13} />Stop</Button>
              )}
            </div>
          </header>

          {run.activity.length > 0 && (
            <div className="work-run__actions">
              {run.activity.map((item, i) => {
                const key = item.kind === "file" ? `${item.kind}-${item.relativePath}` : item.kind === "approval" ? `${item.kind}-${item.approvalId}` : `${item.kind}-${item.tool}-${i}`;
                return (
                  <WorkActionCard
                    key={key}
                    item={item}
                    onPreviewFile={openFile}
                    onApprove={(id) => resolveApproval.mutate({ id, approved: true })}
                    onReject={(id) => resolveApproval.mutate({ id, approved: false })}
                    busy={resolveApproval.isPending}
                  />
                );
              })}
            </div>
          )}

          {run.budget && (
            <div className="work-run__budget" data-status={run.budget.status} data-testid="work-budget">
              <div className="work-run__budget-head">
                <span className="work-run__budget-title"><Gauge size={12} />Progression agent</span>
                <span className="work-run__budget-value">{run.budget.used}<i>/</i>{run.budget.total} budget</span>
              </div>
              <div className="work-run__budget-track" role="progressbar" aria-valuenow={budgetPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de l'agent">
                <i style={{ width: `${budgetPct}%` }} />
              </div>
              <div className="work-run__budget-meta">
                <span>{run.budget.actions} actions effectuées</span>
                {remaining !== undefined && <span>~{remaining} restantes estimées</span>}
                <span>{run.changedFiles.length} fichier{run.changedFiles.length > 1 ? "s" : ""} modifié{run.changedFiles.length > 1 ? "s" : ""}</span>
                <span>{run.budget.testsRun} test{run.budget.testsRun > 1 ? "s" : ""} effectué{run.budget.testsRun > 1 ? "s" : ""}</span>
              </div>
              {run.budget.status === "low" && <div className="work-run__budget-note is-low">Budget presque épuisé — l&apos;agent finalise les étapes prioritaires.</div>}
              {run.budget.status === "exhausted" && (
                <div className="work-run__budget-note is-exhausted">
                  <p>Budget épuisé avant la fin de la tâche. L&apos;état de l&apos;agent est sauvegardé — tu peux reprendre exactement là où il s&apos;est arrêté.</p>
                  <Button size="sm" variant="secondary" disabled={!workspaceId || streaming || !run.checkpoint} onClick={() => continueRun(index)}>
                    <RotateCw size={13} />Continue task
                  </Button>
                </div>
              )}
              {run.stalledReason && (
                <div className="work-run__budget-note is-stalled">
                  <p>Boucle détectée : {run.stalledReason}</p>
                </div>
              )}
            </div>
          )}

          {run.reasoning && (
            <motion.div
              className={`v3-reason work-reason ${run.reasoningOpen ? "is-open" : ""}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                className="v3-reason__head"
                aria-expanded={run.reasoningOpen}
                onClick={() => setRuns((current) => current.map((r, i) => (i === index ? { ...r, reasoningOpen: !r.reasoningOpen } : r)))}
              >
                <AegisIcon name="think" size={13} />
                Réflexion
                {run.thinking && <span className="work-reason__dots"><i /><i /><i /></span>}
                <ChevronRight size={12} />
              </button>
              {run.reasoningOpen && <div className="v3-reason__body">Résumé de l&apos;activité de l&apos;agent pendant qu&apos;il inspecte le workspace. Le raisonnement détaillé reste privé.</div>}
            </motion.div>
          )}

          {run.delta ? (
            <div className="work-run__output">
              <MemoizedMarkdown content={run.delta} />
              {isStreaming && phase === "writing" && <span className="v3-stream-caret" aria-hidden="true" />}
            </div>
          ) : isStreaming && !run.done ? (
            <div className="work-run__live">
              <span className="work-run__dots"><i /><i /><i /></span>
              <span>{agentActivity?.label ?? "Travail en cours…"}{agentCurrentFile ? <code>{agentCurrentFile}</code> : null}</span>
            </div>
          ) : null}

          {run.done && !run.error && !interrupted && (
            <div className="work-run__done">
              <motion.span
                className="v3-loading__done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Check size={12} />Terminé en {((run.durationMs ?? 0) / 1000).toFixed(1)}s
              </motion.span>
              {hasChanges && (
                <Button size="sm" variant="secondary" disabled={!workspaceId || undoAgentChange.isPending} onClick={() => undoAgentChange.mutate()}>
                  <Trash2 size={12} />{undoAgentChange.isPending ? "Rollback…" : "Annuler la dernière modification"}
                </Button>
              )}
            </div>
          )}
          {run.error && <div role="alert" className="work-run__error">{run.error}</div>}
        </motion.article>
      </motion.div>
    );
  };

  const agentProcess = status.data?.agent?.process;
  const agentState = agentProcess === "online" ? "ok" : agentProcess === "offline" ? "off" : "check";
  const agentLabel = agentProcess === "online" ? "Agent online" : agentProcess === "offline" ? "Agent offline" : "Checking…";
  const agentAuthOk = status.data?.agent?.authentication === "authenticated";
  const providerReady = status.data?.providers?.status === "ready";
  const drawerNodes = useMemo(() => filterTree(treeNodes, drawerQuery.trim()), [treeNodes, drawerQuery]);

  const accent = modelBrandColor(model);
  const workAccentStyle = {
    "--model-accent": accent,
    "--model-accent-deep": darkenHex(accent, 0.62),
    "--model-accent-soft": hexToRgba(accent, 0.16),
    "--model-accent-soft-2": hexToRgba(accent, 0.06),
    "--model-accent-mid": hexToRgba(accent, 0.3),
    "--model-accent-strong": hexToRgba(accent, 0.5),
    "--model-accent-glow": hexToRgba(accent, 0.4),
  } as CSSProperties;

  return (
    <div className="work-root" style={workAccentStyle}>
      <header className="work-topbar">
        <button type="button" className="v3-nav-toggle" aria-label="Open navigation" onClick={openNav}>
          <Menu size={16} />
        </button>
        <AegisBrand size={19} label="AEGIS" className="work-topbar__brand" />
        <span className="work-topbar__divider" aria-hidden="true" />
        <button type="button" className="work-topbar__workspace" title={workspace?.root ?? "Ouvrir les fichiers"} onClick={() => { setFilesDrawerOpen(true); requestAnimationFrame(() => filesSearchRef.current?.focus()); }}>
          <AegisIcon name="folder" size={12} />{workspace?.name ?? "Work Mode"}
        </button>
        <span className="work-topbar__spacer" />
        <span className="work-status" data-state={agentState} data-testid="agent-status"><i />{agentLabel}</span>
        {streaming && (
          <div className="work-topbar__activity">
            <button type="button" className="aegis-activity" data-testid="agent-activity" aria-expanded={activityPopover} onClick={() => setActivityPopover((v) => !v)}>
              <AegisCore state={coreStateFromActivity(agentActivity, true)} size={16} />
              <span className="aegis-activity__label">{agentActivity?.label ?? "Travail en cours…"}</span>
            </button>
            {activityPopover && (
              <div className="work-topbar__activity-pop" role="tooltip">
                <span className="work-topbar__activity-pop-title">{agentActivity?.label ?? "Travail en cours…"}</span>
                {agentActivity?.detail && <code>{agentActivity.detail}</code>}
                {agentCurrentFile && <code>Fichier : {agentCurrentFile}</code>}
              </div>
            )}
          </div>
        )}
        <div className="work-topbar__actions">
          <button type="button" className="work-topbar__btn" onClick={() => { setFilesDrawerOpen(true); requestAnimationFrame(() => filesSearchRef.current?.focus()); }}>
            <AegisIcon name="folder" size={13} />Files
          </button>
          <button type="button" className="work-topbar__btn" onClick={() => setHistoryOpen(true)}>
            <History size={13} />Historique
          </button>
          <button type="button" className="work-topbar__btn" onClick={() => router.push("/settings")}>
            <Settings size={13} />Settings
          </button>
        </div>
      </header>

      <main className="work-main">
        <div className="v3-chat__scroll work-chat__scroll" ref={scrollRef}>
          <div className="v3-chat__column work-column">
            {agentProcess === "offline" && (
              <div className="work-banner" data-tone="off">
                <span><strong>Local Agent hors ligne.</strong> Démarre le superviseur local pour travailler avec l&apos;agent.</span>
                <Button size="sm" variant="secondary" onClick={() => { void queryClient.invalidateQueries({ queryKey: ["work-status"] }); }}><LoaderCircle size={12} className={status.isFetching ? "spin" : undefined} />Rafraîchir</Button>
              </div>
            )}
            {agentProcess === "online" && !agentAuthOk && (
              <div className="work-banner" data-tone="warn">
                <span><strong>Connexion requise.</strong> Authentifie l&apos;agent local avant d&apos;exécuter des tâches.</span>
                <Button size="sm" variant="primary" disabled={connectAgent.isPending} onClick={() => connectAgent.mutate()}>
                  {connectAgent.isPending ? <LoaderCircle className="spin" size={12} /> : <ShieldCheck size={12} />}{connectAgent.isPending ? "Connexion…" : "Connecter"}
                </Button>
              </div>
            )}
            {agentProcess === "online" && agentAuthOk && !providerReady && (
              <div className="work-banner" data-tone="warn">
                <span><strong>Aucun fournisseur configuré.</strong> Choisis un modèle IA dans les réglages pour faire travailler l&apos;agent.</span>
                <Button size="sm" variant="secondary" onClick={() => router.push("/providers")}>Configurer un fournisseur</Button>
              </div>
            )}

            {!workspaceId && (
              <div className="work-setup-card">
                <motion.span
                  className="work-hero__orb"
                  animate={{ scale: [1, 1.12, 1], rotate: [0, 8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <AegisIcon name="folder" size={26} />
                </motion.span>
                <strong>Connecte un dossier</strong>
                <p>L&apos;agent n&apos;accède qu&apos;aux dossiers que tu autorises explicitement sur cette machine.</p>
                <div className="work-setup">
                  <Button variant="primary" onClick={() => pickWorkspace.mutate()} disabled={pickWorkspace.isPending || trust.isPending}>
                    <FolderOpen size={14} />{pickWorkspace.isPending ? "Ouverture du sélecteur…" : "Choisir un dossier"}
                  </Button>
                  <form className="work-setup__input" onSubmit={(e) => { e.preventDefault(); const root = String(e.currentTarget.root?.value ?? "").trim(); if (root) trust.mutate(root); }}>
                    <label htmlFor="work-root">Chemin du dossier</label>
                    <div className="work-setup__row">
                      <input id="work-root" name="root" className="field" placeholder="C:\Users\you\projects\app" required />
                      <Button type="submit" variant="primary" disabled={trust.isPending}>{trust.isPending ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}Trust</Button>
                    </div>
                    {trust.isError && <p role="alert" className="form-error">{normalizeError(trust.error).message}</p>}
                  </form>
                </div>
              </div>
            )}

            {workspaceId && runs.length === 0 && !streaming && (
              <motion.div
                className="work-hero"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.span
                  className="work-hero__orb work-hero__orb--aegis"
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <AegisLogo size={44} />
                </motion.span>
                <strong>Aegis</strong>
                <p>Demande à l&apos;agent de lire, créer, modifier des fichiers ou exécuter des commandes dans <code>{workspace?.name}</code>. Les actions sensibles demandent ton approbation.</p>
                <div className="work-hero__chips">
                  <span><AegisIcon name="terminal" size={10} />runCommand</span>
                  <span><AegisIcon name="create" size={10} />writeFile</span>
                  <span><AegisIcon name="edit" size={10} />editFile</span>
                  <span><AegisIcon name="search" size={10} />searchFiles</span>
                </div>
                {workspace && workspaceList.length > 0 && (
                  <div className="work-hero__workspace">
                    <span>{workspace.mode}</span>
                    <button type="button" onClick={() => setMode.mutate({ id: workspace.id, mode: workspace.mode === "trusted" ? "restricted" : "trusted" })}>
                      Basculer en {workspace.mode === "trusted" ? "restreint" : "confiance"}
                    </button>
                    <button type="button" className="is-danger" onClick={() => { if (window.confirm(`Retirer la confiance du dossier ${workspace.name} ?`)) untrust.mutate(workspace.id); }}>
                      Retirer la confiance
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {(teamMode !== "single" || runs.some((run) => run.memberId)) && (
                <motion.div
                  className="work-team__bar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  <span className="work-team__bar-title"><Users size={12} />Équipe {teamMode === "auto" ? "(choisie par l'IA)" : teamMode === "custom" ? "(personnalisée)" : "(session)"}</span>
                  <div className="work-team__bar-roles">
                    {(teamMode === "custom"
                      ? (["dev" as WorkAgentRole, ...teamRoles] as WorkAgentRole[])
                      : (["dev", "design", "marketing", "content", "qa"] as WorkAgentRole[])
                    ).slice(0, 5).map((role) => {
                      const meta = workTeamRoleMeta(role);
                      const activeRun = runs.find((run) => run.memberId === `member-${role}`);
                      const state = activeRun?.done ? "done" : activeRun ? "active" : "waiting";
                      return (
                        <span key={role} className="work-team__bar-role" data-state={state} style={{ "--role-color": meta.color } as CSSProperties}>
                          <i aria-hidden="true" />
                          <span><strong>{meta.name}</strong><small>{state === "done" ? "Terminé" : state === "active" ? "En cours" : "En attente"}</small></span>
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              )}
              {runs.map(renderRun)}
            </AnimatePresence>
          </div>
        </div>

        <WorkComposer
          workspaceMode={workspace?.mode ?? null}
          workspaceName={workspace?.name}
          streaming={streaming}
          input={input}
          onInput={setInput}
          canSend={canSend}
          onSend={() => void sendPrompt()}
          onStop={stop}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          filePaths={treeNodes}
          attachedFiles={attachedFiles}
          onAttachFile={attachFile}
          onRemoveAttachedFile={removeAttachedFile}
          mode={mode}
          onModeChange={setAgentMode}
          teamMode={teamMode}
          teamRoles={teamRoles}
          onTeamChange={(nextMode, nextRoles) => { setTeamMode(nextMode); setTeamRoles(nextRoles); }}
        />
      </main>

      <WorkFilesDrawer
        open={filesDrawerOpen}
        title={workspace?.name ?? "Fichiers"}
        subtitle={workspace ? `${workspace.root} · ${workspace.fileCount ?? tree.data?.tree.length ?? 0} fichiers` : undefined}
        count={tree.data?.tree.length ?? 0}
        loading={tree.isLoading}
        error={tree.isError ? normalizeError(tree.error).message : null}
        refreshing={tree.isFetching}
        onRefresh={() => { void queryClient.invalidateQueries({ queryKey: ["work-tree", workspaceId] }); void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] }); }}
        onClose={() => setFilesDrawerOpen(false)}
        searchValue={drawerQuery}
        onSearch={setDrawerQuery}
        searchRef={filesSearchRef}
        scrollRef={filesScrollRef}
        workspaces={workspaceList.map(({ id, name, root }) => ({ id, name, root }))}
        activeWorkspaceId={workspaceId}
        onSelectWorkspace={switchWorkspace}
        onAddWorkspace={(root) => trust.mutate(root)}
        addPending={trust.isPending}
        addError={trust.isError ? normalizeError(trust.error).message : null}
      >
        {drawerNodes.length === 0 ? (
          <div className="work-empty" style={{ padding: "24px" }}>
            {drawerQuery.trim() ? (
              <p><strong>Aucun résultat pour « {drawerQuery.trim()} ».</strong></p>
            ) : (
              <>
                <p><strong>Ce dossier est vide.</strong></p>
                <p>Ajoute un dossier ci-dessus ou choisis un autre workspace pour naviguer dans ses fichiers.</p>
              </>
            )}
          </div>
        ) : (
          <div className="work-tree">{drawerNodes.map((node) => renderNode(node, 0))}</div>
        )}
      </WorkFilesDrawer>

      <WorkHistoryDrawer
        open={historyOpen}
        sessions={sessionsQuery.data?.sessions ?? []}
        loading={sessionsQuery.isLoading}
        saving={savingSession}
        activeSessionId={activeSessionId}
        activeProject={sessionsQuery.data?.sessions.find((session) => session.id === activeSessionId)?.project ?? null}
        projects={projects}
        onClose={() => setHistoryOpen(false)}
        onNew={newSession}
        onSelect={(id) => void loadSession(id)}
        onRename={renameSession}
        onDelete={(id) => deleteSession.mutate(id)}
        onSetProject={(projectId) => {
          const id = activeSessionIdRef.current;
          if (id) linkProject.mutate({ sessionId: id, projectId });
        }}
        onCreateProject={(input) => createWorkProject.mutate(input)}
      />

      <WorkFilePreview
        open={previewOpen && Boolean(activeFile)}
        onClose={() => setPreviewOpen(false)}
        tabs={openFiles}
        activeFile={activeFile ?? ""}
        onOpenTab={openFile}
        onCloseTab={closeFile}
        dirty={Boolean(activeFile && dirtyFiles.has(activeFile))}
        content={activeFile ? (drafts[activeFile] ?? "") : ""}
        onContent={(value) => { if (!activeFile) return; setDraftContent(value); setDrafts((current) => ({ ...current, [activeFile]: value })); setDirtyFiles((current) => new Set(current).add(activeFile)); }}
        onSave={() => saveFile.mutate()}
        saving={saveFile.isPending}
        onReject={() => {
          if (!activeFile) return;
          const original = file.data?.content ?? "";
          setDraftContent(original);
          setDrafts((current) => ({ ...current, [activeFile]: original }));
          setDirtyFiles((current) => { const next = new Set(current); next.delete(activeFile); return next; });
        }}
        loading={file.isLoading}
        error={file.isError ? normalizeError(file.error).message : null}
        highlightRef={highlightRef}
        syncHighlight={syncHighlight}
        line={editorLine}
        onLineChange={setEditorLine}
        size={file.data?.size}
      />
    </div>
  );
}