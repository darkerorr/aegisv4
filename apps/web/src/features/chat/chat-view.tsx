"use client";

import type { Attachment, ChatMessage, Model } from "@aegis/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Cloud,
  Copy,
  Cpu,
  FileText,
  Github,
  Laptop,
  Mail,
  Menu,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AegisIconButton } from "@/components/ui/icon-button";
import { StatePanel } from "@/components/feedback/state-panel";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { useWorkspaceNav } from "@/components/workspace/workspace-shell";
import { conversationsApi } from "@/lib/api/conversations";
import { api } from "@/lib/api/client";
import { normalizeError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import { ModelSelector } from "./model-selector";
import { useModelSelection } from "./model-selection-store";
import { darkenHex, hexToRgba, modelBrandColor, modelBrandSlug, providerSlug } from "./model-brand";
import { ToolsPopover, type ToolMode } from "./tools-popover";
import { useChatAppearance } from "@/features/settings/chat-appearance-store";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_MAX_SIZE_MB,
  ALLOWED_ATTACHMENT_TYPES,
} from "@/lib/config/attachments";
const MemoizedMarkdown = dynamic(
  () => import("./markdown").then((module) => module.MemoizedMarkdown),
  { ssr: false },
);
import { WebResearchActivity, WebSources, type WebActivityItem } from "./web-sources";
import type { WebSearchResultView } from "@/lib/api/web-results";
import { HomeLanding } from "./home-landing";

const PENDING_SOURCES_KEY = "__pending__";

type ChatSubmissionStatus =
  | "idle"
  | "validating"
  | "creating-conversation"
  | "saving-user-message"
  | "planning-tools"
  | "calling-provider"
  | "waiting-first-token"
  | "streaming"
  | "finalizing"
  | "completed"
  | "cancelled"
  | "interrupted"
  | "failed";

export function ChatView({ conversationId }: { conversationId?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openNav, railCollapsed, toggleRail } = useWorkspaceNav();
  const requestedProjectId = searchParams.get("projectId");
  const controller = useRef<AbortController | null>(null);
  const submitLock = useRef(false);
  /** Monotonic token so an aborted send's finally block never clobbers the
   * state of the send that replaced it ("send while streaming"). */
  const sendToken = useRef(0);
  /** Remembers the conversation this view is writing to so follow-up messages
   * reuse the same conversation even before the router prop catches up after
   * creating it (otherwise a second message would spawn a duplicate
   * conversation with an empty history). */
  const activeConversationRef = useRef<string | null>(null);
  const resumeController = useRef<AbortController | null>(null);
  const resumeLock = useRef(false);
  const resumedConversationRef = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const { selectedModel: model, modelHydrationStatus } = useModelSelection();
  const { appearance } = useChatAppearance();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<ChatSubmissionStatus>("idle");
  const [generationStatus, setGenerationStatus] = useState("");
  const [toolStates, setToolStates] = useState<
    Record<string, "requested" | "running" | "done" | "failed">
  >({});
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [liveElapsed, setLiveElapsed] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState<number>();
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("auto");
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  /** Web search results emitted by the backend (`web.results`) keyed by the
   * assistant message id. While streaming, the message id is unknown, so
   * results are bound to PENDING_SOURCES_KEY and moved to the final id on
   * `message.completed`. */
  const [webSources, setWebSources] = useState<Record<string, WebSearchResultView[]>>({});
  const [webActivity, setWebActivity] = useState<Record<string, WebActivityItem[]>>({});
  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.get(conversationId!),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (!conversationId) return;
    try {
      const saved = window.localStorage.getItem(`aegis.chat.sources.${conversationId}`);
      if (saved) setWebSources(JSON.parse(saved) as Record<string, WebSearchResultView[]>);
      const savedActivity = window.localStorage.getItem(`aegis.chat.activity.${conversationId}`);
      if (savedActivity) setWebActivity(JSON.parse(savedActivity) as Record<string, WebActivityItem[]>);
    } catch { /* stale source cache is non-critical */ }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !Object.keys(webSources).length) return;
    try { window.localStorage.setItem(`aegis.chat.sources.${conversationId}`, JSON.stringify(webSources)); } catch { /* quota errors must not affect chat */ }
  }, [conversationId, webSources]);

  useEffect(() => {
    if (!conversationId || !Object.keys(webActivity).length) return;
    try { window.localStorage.setItem(`aegis.chat.activity.${conversationId}`, JSON.stringify(webActivity)); } catch { /* activity cache is non-critical */ }
  }, [conversationId, webActivity]);

  // After a refresh the server may still be generating an answer for this
  // conversation (the assistant message is persisted with status "streaming").
  // Re-attach to the live generation instead of showing a dead partial answer.
  useEffect(() => {
    if (!conversation.data) return;
    const loadedMessages = conversation.data.conversation.messages || [];
    setMessages(loadedMessages);
    if (!conversationId || resumeLock.current) return;
    const last = loadedMessages[loadedMessages.length - 1];
    const inFlight =
      last?.role === "assistant" &&
      (last.status === "streaming" || (last.status === undefined && (last as { generationId?: string }).generationId));
    if (!inFlight) return;
    if (resumedConversationRef.current === conversationId) return;
    resumedConversationRef.current = conversationId;
    const streamingMessageId = last.id || "";
    void resumeGeneration(conversationId, streamingMessageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.data, conversationId]);

  /** Reconnect to a generation that survived a page refresh: replay the
   * persisted content, then keep receiving new chunks until it completes. */
  async function resumeGeneration(activeConversationId: string, streamingMessageId: string) {
    if (resumeLock.current) return;
    resumeLock.current = true;
    const signalController = new AbortController();
    resumeController.current = signalController;
    setStreaming(true);
    setSubmissionStatus("streaming");
    setGenerationStatus("Reconnecting to the running response…");
    try {
      for await (const event of conversationsApi.resume(
        { conversationId: activeConversationId, clientMessageId: streamingMessageId || undefined },
        signalController.signal,
      )) {
        if (event.type === "message.resync") {
          setMessages((previous) => {
            const targetIndex = previous.findIndex(
              (msg) => (msg.id && streamingMessageId && msg.id === streamingMessageId) || msg.id === event.messageId,
            );
            const resolved: ChatMessage = {
              ...(targetIndex >= 0 ? previous[targetIndex] : {}),
              role: "assistant",
              content: event.content,
              reasoning: event.reasoning ?? undefined,
              status: event.status,
              id: event.messageId ?? previous[targetIndex]?.id,
              createdAt: previous[targetIndex]?.createdAt ?? new Date().toISOString(),
            };
            if (targetIndex >= 0) {
              return previous.map((msg, index) => (index === targetIndex ? resolved : msg));
            }
            return [...previous, resolved];
          });
          setGenerationStatus(
            event.status === "streaming" ? "Resuming…" : event.status === "error" ? "The generation was interrupted." : "",
          );
        }
        if (event.type === "message.delta") {
          setMessages((previous) => {
            const targetIndex = previous.findIndex(
              (msg) => msg.role === "assistant" && Boolean(streamingMessageId) && msg.id === streamingMessageId,
            );
            if (targetIndex >= 0) {
              return previous.map((msg, index) =>
                index === targetIndex ? { ...msg, content: msg.content + event.delta } : msg,
              );
            }
            // Resync may have replaced ids; fall back to the last assistant slot.
            const lastIndex = previous.length - 1;
            if (lastIndex >= 0 && previous[lastIndex].role === "assistant") {
              return previous.map((msg, index) =>
                index === lastIndex ? { ...msg, content: msg.content + event.delta } : msg,
              );
            }
            return previous;
          });
        }
        if (event.type === "message.reasoning") {
          setMessages((previous) => {
            const lastIndex = previous.length - 1;
            if (lastIndex < 0 || previous[lastIndex].role !== "assistant") return previous;
            return previous.map((msg, index) =>
              index === lastIndex ? { ...msg, reasoning: (msg.reasoning ?? "") + event.delta } : msg,
            );
          });
        }
        if (event.type === "tool.requested" || event.type === "tool.started" || event.type === "tool.completed" || event.type === "tool.failed") updateWebActivity(event);
        if (event.type === "message.completed") {
          setSubmissionStatus("completed");
          setGenerationStatus("");
          setStreaming(false);
        }
        if (event.type === "message.error") {
          setSubmissionStatus("failed");
          setError(event.error.message);
          setGenerationStatus("");
          setStreaming(false);
        }
      }
    } catch (cause) {
      if (!signalController.signal.aborted) {
        setSubmissionStatus("failed");
        setError(normalizeError(cause).message);
        setGenerationStatus("");
        setStreaming(false);
      }
    } finally {
      resumeLock.current = false;
      resumeController.current = null;
    }
    await queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
  }

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      stickToBottom.current = distanceFromBottom < 80;
      setShowScrollBottom(distanceFromBottom > 120);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (messages.length === 0 || !streaming) return;
    if (!stickToBottom.current) return;
    const node = scrollRef.current;
    if (node)
      requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }));
  }, [messages, streaming]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () =>
      setShowScrollBottom(node.scrollHeight - node.scrollTop - node.clientHeight > 120);
    update();
    const observer = new ResizeObserver(() => window.requestAnimationFrame(update));
    observer.observe(node);
    const column = node.querySelector<HTMLElement>(".v3-chat__column");
    if (column) observer.observe(column);
    return () => observer.disconnect();
  }, [messages.length]);

  useEffect(() => {
    if (submissionStatus === "waiting-first-token" && startedAt === null) setStartedAt(Date.now());
    if (submissionStatus === "completed") setElapsedMs(startedAt ? Date.now() - startedAt : null);
  }, [submissionStatus, startedAt]);

  useEffect(() => {
    if (submissionStatus !== "streaming" || startedAt === null) return;
    const id = window.setInterval(() => setLiveElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [submissionStatus, startedAt]);

  function formatElapsed(ms: number) {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function updateWebActivity(event: {
    type: "tool.requested" | "tool.started" | "tool.completed" | "tool.failed";
    tool: string;
    label?: string;
    query?: string;
    activityId?: string;
    url?: string;
    title?: string;
    domain?: string;
    site?: string;
  }) {
    if (event.tool !== "web.search" && event.tool !== "web.readPage") return;
    const id = event.activityId || `${event.tool}:${event.url || event.query || "web"}`;
    const kind = event.tool === "web.search" ? "search" : "page";
    const state = event.type === "tool.failed" ? "failed" : event.type === "tool.completed" ? "done" : event.type === "tool.started" ? "running" : "requested";
    setWebActivity((current) => {
      const previous = current[PENDING_SOURCES_KEY] ?? [];
      const existing = previous.find((item) => item.id === id);
      const item: WebActivityItem = {
        id,
        kind,
        state,
        query: event.query || existing?.query,
        url: event.url || existing?.url,
        title: event.title || existing?.title,
        domain: event.domain || existing?.domain,
        site: event.site || existing?.site,
      };
      const nextItems = existing ? previous.map((entry) => entry.id === id ? item : entry) : [...previous, item];
      return { ...current, [PENDING_SOURCES_KEY]: nextItems.slice(-8) };
    });
  }

  async function send(overrideContent?: string) {
    const content = (overrideContent ?? input).trim();
    if (!content || !model || submitLock.current) return;
    // Sending while a previous generation is still streaming replaces it: abort
    // the in-flight stream (the API keeps the partial answer, marked
    // "interrupted") and start the new one immediately.
    if (streaming) {
      controller.current?.abort();
      resumeController.current?.abort();
    }
    const token = ++sendToken.current;
    submitLock.current = true;
    stickToBottom.current = true;
    setStartedAt(null);
    setElapsedMs(null);
    setToolStates({});
    setWebActivity((current) => ({ ...current, [PENDING_SOURCES_KEY]: [] }));

    const clientMessageId = crypto.randomUUID();
    const idempotencyKey = clientMessageId;
    const captureInput = content;
    const captureMessages = messages.slice();
    const captureAttachments = attachments.slice();
    const captureEnabledTools = enabledTools.slice();
    const captureToolMode = toolMode;
    const captureModel = model;

    setInput("");
    setError("");
    setSubmissionStatus("validating");
    setGenerationStatus("Preparing message...");

    try {
      let activeConversationId = conversationId ?? activeConversationRef.current ?? undefined;
      let newConversationId: string | null = null;
      setSubmissionStatus("creating-conversation");
      setGenerationStatus("Creating conversation...");

      if (!activeConversationId) {
        const created = await api.createConversation({
          providerId: captureModel.providerId,
          model: captureModel.name,
          title: captureInput.slice(0, 80) || "New conversation",
          idempotencyKey,
        });
        activeConversationId = created.conversation.id;
        newConversationId = created.conversation.id;
        activeConversationRef.current = created.conversation.id;
        // Bind the browser URL before the first provider token arrives. A
        // refresh during a first response must reopen this exact conversation
        // so the durable streaming message can be resumed.
        router.replace(`/chat/${encodeURIComponent(newConversationId)}`, { scroll: false });
        if (requestedProjectId)
          await api.linkConversationToProject(requestedProjectId, created.conversation.id);
      } else {
        activeConversationRef.current = activeConversationId;
      }

      setSubmissionStatus("saving-user-message");
      setGenerationStatus("Saving message...");
      const user: ChatMessage = {
        role: "user",
        content: captureInput,
        id: clientMessageId,
        createdAt: new Date().toISOString(),
      };
      setMessages((previous) => [...previous, user]);

      // Full history for the provider: the local in-memory messages when
      // available, otherwise the server-persisted ones (the query may not have
      // resolved yet right after a remount). Only a brand-new conversation
      // starts without history.
      const historyMessages =
        newConversationId === null && captureMessages.length === 0
          ? (conversation.data?.conversation.messages ?? [])
          : captureMessages;

      setSubmissionStatus("calling-provider");
      setGenerationStatus("Connecting to model...");
      controller.current = new AbortController();
      const streamSignal = controller.current.signal;

      let reconnectAttempts = 0;
      let interrupted = false;
      assistantStreamLoop: while (true) {
        setMessages((previous) => {
          if (previous.length > 0 && previous[previous.length - 1].role === "assistant")
            return previous;
          return [...previous, { role: "assistant" as const, content: "" }];
        });
        setStreaming(true);
        setSubmissionStatus("waiting-first-token");

        let streamError: Error | null = null;
        let streamContent = "";
        let streamReasoning = "";
        let completed = false;
        let cancelled = false;
        let connectionLost = false;
        let assistantMessageId = "";

        try {
          for await (const event of conversationsApi.stream(
            {
              conversationId: activeConversationId,
              clientMessageId,
              idempotencyKey,
              providerId: captureModel.providerId,
              model: captureModel.name,
              messages: [...historyMessages, user],
              privacyMode: captureModel.local ? "local" : "remote-provider",
              attachmentIds: captureAttachments.map((a) => a.id),
              toolMode: captureToolMode,
              enabledTools: captureEnabledTools,
            },
            streamSignal,
          )) {
            if (event.type === "message.started") {
              setSubmissionStatus("streaming");
              if (event.messageId) assistantMessageId = event.messageId;
            }
            if (event.type === "web.results") {
              const results = event.results.map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                publishedAt: r.publishedAt,
                source: r.source,
                rank: r.rank,
                site: r.site,
                domain: r.domain,
                score: r.score,
                sourceType: r.sourceType,
              }));
              setWebSources((current) => ({ ...current, [PENDING_SOURCES_KEY]: results }));
              setGenerationStatus(`Found ${results.length} web results`);
            }
            if (event.type === "message.delta") {
              setGenerationStatus("");
              streamContent += event.delta;
              setMessages((previous) =>
                previous.map((msg, index) => {
                  if (index === previous.length - 1 && msg.role === "assistant") {
                    return { ...msg, content: streamContent, reasoning: streamReasoning };
                  }
                  return msg;
                }),
              );
            }
            if (event.type === "message.reasoning") {
              setGenerationStatus("");
              streamReasoning += event.delta;
              setMessages((previous) =>
                previous.map((msg, index) => {
                  if (index === previous.length - 1 && msg.role === "assistant") {
                    return { ...msg, content: streamContent, reasoning: streamReasoning };
                  }
                  return msg;
                }),
              );
            }
            if (event.type === "generation.status") {
              setGenerationStatus(
                event.status === "model-reasoning"
                  ? "Model is reasoning..."
                  : event.status === "persisting"
                    ? "Saving response..."
                    : event.status === "writing-answer"
                      ? "Writing answer..."
                      : event.status === "provider-waiting"
                        ? (event.message ?? "Provider is temporarily limited, retrying…")
                        : event.status === "provider-active"
                          ? "Provider is active..."
                          : "",
              );
            }
            if (event.type === "message.notice") {
              setGenerationStatus(event.message);
            }
            if (
              event.type === "tool.requested" ||
              event.type === "tool.started" ||
              event.type === "tool.completed" ||
              event.type === "tool.failed"
            ) {
              setGenerationStatus(
                event.label ||
                  (event.type === "tool.requested"
                    ? `Preparing ${event.tool}...`
                    : event.type === "tool.started"
                      ? `Using ${event.tool}...`
                      : "Tool finished"),
              );
              updateWebActivity(event);
              setToolStates((current) => ({
                ...current,
                [event.tool]:
                  event.type === "tool.started"
                    ? "running"
                    : event.type === "tool.completed"
                      ? "done"
                      : event.type === "tool.failed"
                        ? "failed"
                        : "requested",
              }));
            }
            if (event.type === "message.completed") {
              completed = true;
              setSubmissionStatus("completed");
              const finalMessageId = event.messageId || assistantMessageId;
              if (finalMessageId) setMessages((previous) => previous.map((message, index) => index === previous.length - 1 && message.role === "assistant" ? { ...message, id: finalMessageId, status: "completed" } : message));
              if (finalMessageId) {
                setWebSources((current) => {
                  const pending = current[PENDING_SOURCES_KEY];
                  if (!pending) return current;
                  const next = { ...current };
                  delete next[PENDING_SOURCES_KEY];
                  next[finalMessageId] = pending;
                  return next;
                });
                setWebActivity((current) => {
                  const pending = current[PENDING_SOURCES_KEY];
                  if (!pending) return current;
                  const next = { ...current };
                  delete next[PENDING_SOURCES_KEY];
                  next[finalMessageId] = pending;
                  return next;
                });
              }
            }
            if (event.type === "message.error") {
              streamError = new Error(event.error.message);
              break;
            }
            if (event.type === "message.interrupted") {
              // The provider cut the stream mid-answer. Keep the partial content
              // (never discard it) and mark the message interrupted so the user
              // can press "Continuer" to resume into the same message.
              interrupted = true;
              assistantMessageId = event.messageId || assistantMessageId;
              streamContent = event.content;
              streamReasoning = event.reasoning ?? streamReasoning;
              setMessages((previous) =>
                previous.map((message, index) =>
                  index === previous.length - 1 && message.role === "assistant"
                    ? {
                        ...message,
                        id: event.messageId || message.id,
                        content: event.content,
                        reasoning: event.reasoning ?? message.reasoning,
                        status: "interrupted" as const,
                      }
                    : message,
                ),
              );
              if (event.messageId) {
                setWebSources((current) => {
                  const pending = current[PENDING_SOURCES_KEY];
                  if (!pending) return current;
                  const next = { ...current };
                  delete next[PENDING_SOURCES_KEY];
                  next[event.messageId] = pending;
                  return next;
                });
                setWebActivity((current) => {
                  const pending = current[PENDING_SOURCES_KEY];
                  if (!pending) return current;
                  const next = { ...current };
                  delete next[PENDING_SOURCES_KEY];
                  next[event.messageId] = pending;
                  return next;
                });
              }
            }
          }
        } catch (cause: unknown) {
          if (streamSignal.aborted || token !== sendToken.current) {
            cancelled = true;
            setSubmissionStatus("cancelled");
            setGenerationStatus("Generation cancelled.");
          } else {
            connectionLost = true;
            streamError = cause instanceof Error ? cause : new Error("Stream failed unexpectedly.");
          }
        }

        // A dropped fetch stream is recoverable: the API owns the persisted
        // assistant row and keeps the generation alive independently of this
        // browser connection. Re-attach before surfacing an error to the user.
        if (connectionLost && !cancelled && activeConversationId && reconnectAttempts < 2) {
          reconnectAttempts += 1;
          setGenerationStatus(`Connection lost. Reconnecting (${reconnectAttempts}/2)…`);
          streamError = null;
          try {
            for await (const event of conversationsApi.resume({ conversationId: activeConversationId }, streamSignal)) {
              if (event.type === "message.resync") {
                streamContent = event.content;
                streamReasoning = event.reasoning ?? "";
                setMessages((previous) => {
                  const index = previous.findIndex((msg) => msg.id === event.messageId);
                  const target = index >= 0 ? index : previous.length - 1;
                  if (target < 0) return previous;
                  return previous.map((msg, itemIndex) => itemIndex === target ? { ...msg, id: event.messageId ?? msg.id, content: streamContent, reasoning: streamReasoning, status: event.status } : msg);
                });
              } else if (event.type === "message.delta") {
                streamContent += event.delta;
                setMessages((previous) => previous.map((msg, index) => index === previous.length - 1 && msg.role === "assistant" ? { ...msg, content: streamContent, status: "streaming" } : msg));
              } else if (event.type === "message.reasoning") {
                streamReasoning += event.delta;
                setMessages((previous) => previous.map((msg, index) => index === previous.length - 1 && msg.role === "assistant" ? { ...msg, reasoning: streamReasoning } : msg));
              } else if (event.type === "message.interrupted") {
                // Resume replayed an already-interrupted message: keep the
                // partial answer and surface the "Continuer" affordance.
                interrupted = true;
                streamContent = event.content;
                assistantMessageId = event.messageId || assistantMessageId;
                setMessages((previous) =>
                  previous.map((msg, index) =>
                    index === previous.length - 1 && msg.role === "assistant"
                      ? { ...msg, id: event.messageId ?? msg.id, content: event.content, status: "interrupted" as const }
                      : msg,
                  ),
                );
              } else if (event.type === "message.completed") {
                completed = true;
                setSubmissionStatus("completed");
                setGenerationStatus("");
              } else if (event.type === "message.error") {
                streamError = new Error(event.error.message);
                break;
              }
            }
          } catch (resumeCause) {
            streamError = resumeCause instanceof Error ? resumeCause : new Error("Reconnection failed.");
          }
          if (!completed && streamError) {
            // The generation may have finished between the disconnect and the
            // resume request. Prefer the durable conversation state if so.
            const latest = await conversationsApi.get(activeConversationId).catch(() => null);
            const persisted = latest?.conversation.messages?.at(-1);
            if (persisted?.role === "assistant" && persisted.status === "completed") {
              setMessages(latest?.conversation.messages ?? []);
              completed = true;
              streamError = null;
            }
          }
        }

        if (token !== sendToken.current) return;

        if (interrupted) {
          setSubmissionStatus("interrupted");
          setGenerationStatus("");
          setStreaming(false);
          await queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
          submitLock.current = false;
          return;
        }

        if (!cancelled && !streamError && !completed) {
          streamError = new Error(
            "The provider stream ended before a terminal event was received.",
          );
        }
        if (cancelled) return;

        if (streamError) {
          setSubmissionStatus("failed");
          setError(streamError.message);
          setGenerationStatus("");
          setStreaming(false);
          setInput(captureInput);
          submitLock.current = false;
          return;
        }

        break;
      }

      setSubmissionStatus("finalizing");
      setGenerationStatus("Updating...");
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      if (activeConversationId) {
        await queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
      }
      setAttachments([]);
      setSubmissionStatus("completed");
      setGenerationStatus("");
    } catch (cause: unknown) {
      if (controller.current?.signal.aborted) {
        setSubmissionStatus("cancelled");
        setGenerationStatus("Generation cancelled.");
      } else {
        setSubmissionStatus("failed");
        if (!error) setError(normalizeError(cause).message);
        const err = normalizeError(cause);
        if (err.message.includes("conversation") || err.message.includes("create")) {
          setInput(captureInput);
        }
      }
    } finally {
      if (token === sendToken.current) {
        setStreaming(false);
        submitLock.current = false;
        controller.current = null;
      }
    }
  }

  /** Resume an interrupted generation INTO THE SAME message. The partial answer
   * already on screen is preserved; the backend passes it back as context and
   * new deltas append to the same row until completion. */
  async function continueMessage(messageId: string) {
    if (!conversationId || !model || submitLock.current) return;
    controller.current?.abort();
    resumeController.current?.abort();
    const token = ++sendToken.current;
    submitLock.current = true;
    stickToBottom.current = true;
    setError("");
    setStreaming(true);
    setSubmissionStatus("streaming");
    setGenerationStatus("Continuing response…");
    const continueController = new AbortController();
    controller.current = continueController;
    const signal = continueController.signal;
    try {
      for await (const event of conversationsApi.continue(
        {
          conversationId,
          messageId,
          providerId: model.providerId,
          model: model.name,
        },
        signal,
      )) {
        if (event.type === "message.delta") {
          setGenerationStatus("");
          setMessages((previous) =>
            previous.map((message, index) =>
              index === previous.length - 1 && message.role === "assistant"
                ? { ...message, content: message.content + event.delta, status: "streaming" as const }
                : message,
            ),
          );
        }
        if (event.type === "message.reasoning") {
          setGenerationStatus("");
          setMessages((previous) =>
            previous.map((message, index) =>
              index === previous.length - 1 && message.role === "assistant"
                ? { ...message, reasoning: (message.reasoning ?? "") + event.delta }
                : message,
            ),
          );
        }
        if (event.type === "generation.status") {
          setGenerationStatus(
            event.status === "provider-waiting"
              ? (event.message ?? "Provider is temporarily limited, retrying…")
              : event.status === "writing-answer"
                ? "Writing answer…"
                : event.status === "persisting"
                  ? "Saving response…"
                  : "",
          );
        }
        if (event.type === "message.notice") setGenerationStatus(event.message);
        if (event.type === "message.completed") {
          setSubmissionStatus("completed");
          setGenerationStatus("");
          setStreaming(false);
          setMessages((previous) =>
            previous.map((message, index) =>
              index === previous.length - 1 && message.role === "assistant"
                ? { ...message, status: "completed" as const }
                : message,
            ),
          );
        }
        if (event.type === "message.interrupted") {
          setSubmissionStatus("interrupted");
          setGenerationStatus("");
          setStreaming(false);
          setMessages((previous) =>
            previous.map((message, index) =>
              index === previous.length - 1 && message.role === "assistant"
                ? { ...message, content: event.content, status: "interrupted" as const }
                : message,
            ),
          );
        }
        if (event.type === "message.error") {
          setSubmissionStatus("failed");
          setError(event.error.message);
          setGenerationStatus("");
          setStreaming(false);
          break;
        }
      }
    } catch (cause) {
      if (!signal.aborted && token === sendToken.current) {
        setSubmissionStatus("failed");
        setError(normalizeError(cause).message);
        setGenerationStatus("");
      }
    } finally {
      if (token === sendToken.current) {
        setStreaming(false);
        submitLock.current = false;
        controller.current = null;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 8 - attachments.length);
    if (!list.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of list) {
        if (file.size > ATTACHMENT_MAX_SIZE_BYTES)
          throw new Error(`${file.name} is larger than ${ATTACHMENT_MAX_SIZE_MB} MB.`);
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.readAsDataURL(file);
        });
        const result = await api.uploadAttachment({
          name: file.name,
          mimeType: file.type || "text/plain",
          size: file.size,
          dataBase64,
        });
        setAttachments((current) => [...current, result.attachment]);
      }
    } catch (cause) {
      setError(normalizeError(cause).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAttachment(attachment: Attachment) {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    await api.deleteAttachment(attachment.id).catch(() => undefined);
  }

  function stop() {
    controller.current?.abort();
    resumeController.current?.abort();
  }

  function retry() {
    if (streaming || !model) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content.trim()) return;
    setInput(lastUser.content);
    void send(lastUser.content);
  }

  async function copy(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopied(index);
    setTimeout(() => setCopied(undefined), 1400);
  }

  if (conversation.isError)
    return (
      <div className="p-6">
        <StatePanel
          state="error"
          title="Conversation unavailable"
          message={normalizeError(conversation.error).message}
          onRetry={() => conversation.refetch()}
        />
      </div>
    );

  const accent = modelBrandColor(model);
  const wallpaperStyle = {
    "--chat-wallpaper-dominant": appearance.dominant,
    "--chat-wallpaper-accent": appearance.accent,
    "--chat-wallpaper-luminance": appearance.luminance,
    "--chat-surface": `rgba(8,8,8,${appearance.ensureContrast ? Math.max(0.72, appearance.dim / 100) : appearance.dim / 100})`,
    "--chat-border": "rgba(255,255,255,.13)",
    "--chat-text": "#fff",
    "--chat-muted": "#a5a5a5",
    "--chat-wallpaper-image":
      appearance.wallpaper === "custom" && appearance.customImage
        ? `url(${appearance.customImage})`
        : "none",
    "--chat-wallpaper-blur": `${appearance.blur}px`,
    "--chat-wallpaper-dim": appearance.dim / 100,
    "--chat-wallpaper-contrast": `${appearance.contrast}%`,
    "--model-accent": accent,
    "--model-accent-deep": darkenHex(accent, 0.62),
    "--model-accent-soft": hexToRgba(accent, 0.16),
    "--model-accent-soft-2": hexToRgba(accent, 0.06),
    "--model-accent-mid": hexToRgba(accent, 0.3),
    "--model-accent-strong": hexToRgba(accent, 0.5),
    "--model-accent-glow": hexToRgba(accent, 0.4),
  } as React.CSSProperties;

  return (
    <div
      className="v3-chat"
      data-wallpaper={appearance.wallpaper}
      data-vignette={appearance.vignette}
      data-grain={appearance.grain}
      style={wallpaperStyle}
    >
      <motion.header
        className="v3-topbar"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <button
          type="button"
          className="v3-nav-toggle"
          aria-label="Open navigation"
          onClick={openNav}
        >
          <Menu size={16} />
        </button>
        <button
          type="button"
          className="v3-rail-toggle"
          aria-label={railCollapsed ? "Show conversation history" : "Hide conversation history"}
          aria-pressed={!railCollapsed}
          title={railCollapsed ? "Show conversations" : "Hide conversations"}
          onClick={toggleRail}
        >
          {railCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <div className="v3-topbar__title">
          <span className="v3-kicker">
            <ShieldCheck size={11} /> Protected workspace
          </span>
          <h1>{conversation.data?.conversation.title || "New conversation"}</h1>
          <p className="v3-topbar__meta">
            {model ? (
              <>
                <strong>{model.name}</strong>
                <em>{model.providerName}</em>
              </>
            ) : (
              <em>Choose a model to begin</em>
            )}
            {messages.length > 0 && (
              <>
                <i />
                {messages.length} message{messages.length > 1 ? "s" : ""}
              </>
            )}
            {submissionStatus === "streaming" && startedAt !== null && (
              <>
                <i />
                <span className="v3-topbar__live">
                  <Timer size={10} />
                  {formatElapsed(liveElapsed)}
                </span>
              </>
            )}
            {elapsedMs !== null && !streaming && (
              <>
                <i />
                <span>{formatElapsed(elapsedMs)}</span>
              </>
            )}
          </p>
        </div>
        <div className="v3-topbar__actions">
          {model && (
            <span className={`v3-badge ${model.local ? "v3-badge--local" : "v3-badge--cloud"}`}>
              {model.local ? <Laptop size={10} /> : <Cloud size={10} />}
              {model.local ? "LOCAL" : "CLOUD"}
            </span>
          )}
        </div>
      </motion.header>

      <div className="v3-chat__scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <HomeLanding
            model={model}
            modelHydrationStatus={modelHydrationStatus}
            onPick={setInput}
          />
        ) : (
          <div className="v3-chat__column">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const lastIndex = messages.length - 1;
                const isStreaming = isUser ? false : index === lastIndex && streaming;
                const showTime = message.createdAt
                  ? new Date(message.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                const toolEntries = Object.entries(toolStates);
                const toolsRunning = toolEntries.some(
                  ([, state]) => state === "running" || state === "requested",
                );
                return (
                  <motion.div
                    key={message.id ?? `${message.role}-${index}`}
                    className={`v3-msg ${isUser ? "v3-msg--user" : "v3-msg--assistant"} ${isStreaming ? "v3-msg--streaming" : ""}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 1, 0.36, 1],
                      delay: index === lastIndex ? 0 : Math.min(index * 0.04, 0.2),
                    }}
                  >
                    {isUser ? (
                      <div className="v3-msg__bubble-group">
                        <div className="v3-msg__bubble">{message.content}</div>
                        <div className="v3-msg__bubble-meta">
                          <time>{showTime}</time>
                          <AegisIconButton
                            icon={copied === index ? Check : Copy}
                            label={copied === index ? "Copied" : "Copy message"}
                            accent={copied === index ? "green" : "neutral"}
                            size="sm"
                            onClick={() => void copy(message.content, index)}
                          />
                        </div>
                      </div>
                    ) : (
                      <article className="v3-msg__card">
                        <header className="v3-msg__head">
                          <span className="v3-msg__avatar">
                            {model ? (
                              <ProviderIcon
                                variant="color"
                                provider={modelBrandSlug(
                                  model,
                                  providerSlug(model.providerKind || model.providerName || ""),
                                )}
                                size={16}
                              />
                            ) : (
                              <Bot size={13} />
                            )}
                          </span>
                          <span className="v3-msg__identity">
                            <strong className="v3-msg__model">
                              {model?.name || conversation.data?.conversation.model || "Aegis"}
                            </strong>
                            <span className="v3-msg__provider">
                              <Cpu size={8} />
                              {model?.providerName || "model"}
                            </span>
                          </span>
                          {isStreaming && (
                            <span className="v3-msg__live">
                              <i />
                              Generating
                            </span>
                          )}
                          <div className="v3-msg__actions">
                            <AegisIconButton
                              icon={copied === index ? Check : Copy}
                              label={copied === index ? "Copied" : "Copy response"}
                              accent={copied === index ? "green" : "neutral"}
                              size="sm"
                              onClick={() => void copy(message.content, index)}
                            />
                            <AegisIconButton
                              icon={RotateCcw}
                              label="Retry"
                              size="sm"
                              disabled={streaming || !model}
                              onClick={retry}
                            />
                            <AegisIconButton
                              icon={RefreshCw}
                              label="Regenerate"
                              size="sm"
                              disabled
                            />
                            <AegisIconButton icon={Copy} label="Bookmark" size="sm" disabled />
                          </div>
                        </header>
                        {toolEntries.length > 0 && (
                          <div className="v3-msg__tools">
                            {toolEntries.map(([tool, state]) => (
                              <motion.span
                                key={tool}
                                className={`v3-tool-badge is-${state}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                              >
                                <i />
                                {tool}
                                {state === "done" ? <Check size={9} /> : null}
                              </motion.span>
                            ))}
                          </div>
                        )}
                        <WebResearchActivity activities={webActivity[message.id ?? PENDING_SOURCES_KEY] ?? []} />
                        {webSources[message.id ?? ""]?.length ? (
                          <WebSources
                            query=""
                            results={webSources[message.id ?? ""] ?? []}
                          />
                        ) : null}
                        {message.content ? (
                          <>
                            <MemoizedMarkdown content={message.content} />
                            {isStreaming && <span className="v3-stream-caret" aria-hidden="true" />}
                            {!isUser && message.status === "interrupted" && (
                              <div className="v3-msg__interrupted">
                                <span>
                                  La réponse a été interrompue. Le texte partiel est conservé.
                                </span>
                                <button
                                  type="button"
                                  disabled={streaming || submitLock.current || !message.id}
                                  onClick={() => message.id && void continueMessage(message.id)}
                                >
                                  <RefreshCw size={12} />
                                  Continuer
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="v3-loading">
                            <span className="v3-loading__dots">
                              <i />
                              <i />
                              <i />
                            </span>
                            <span>{generationStatus || "Thinking..."}</span>
                            {toolsRunning && (
                              <span className="v3-loading__tools">
                                <Wrench size={11} />
                                {Object.keys(toolStates).length} tool
                                {Object.keys(toolStates).length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}
                        <footer className="v3-msg__foot">
                          {index === lastIndex && isStreaming && startedAt !== null && (
                            <span>
                              <Timer size={11} />
                              {formatElapsed(liveElapsed)}
                            </span>
                          )}
                          {index === lastIndex && elapsedMs !== null && !streaming ? (
                            <span>
                              <Timer size={11} />
                              {formatElapsed(elapsedMs)}
                            </span>
                          ) : null}
                          {toolEntries.length > 0 && !isStreaming && !toolsRunning && (
                            <span>
                              <Wrench size={11} />
                              {toolEntries.length} tool{toolEntries.length > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="v3-msg__foot-model">
                            <Cpu size={11} />
                            {model?.name || conversation.data?.conversation.model || "Aegis"}
                          </span>
                          {showTime && <time>{showTime}</time>}
                        </footer>
                      </article>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="v3-chat__glow" aria-hidden="true" />

      <div className="v3-chat__footer">
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              type="button"
              className="v3-scroll-bottom"
              aria-label="Scroll to bottom"
              title="Scroll to bottom"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={() => {
                const node = scrollRef.current;
                if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
                stickToBottom.current = true;
                setShowScrollBottom(false);
              }}
            >
              <ChevronDown size={17} />
            </motion.button>
          )}
        </AnimatePresence>
        <Composer
          input={input}
        onInput={setInput}
        onSend={() => void send()}
        onStop={stop}
        streaming={streaming}
        canSend={
          Boolean(input.trim()) &&
          Boolean(model) &&
          modelHydrationStatus !== "loading" &&
          !uploading
        }
        model={model}
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        enabledTools={enabledTools}
        onToggleTool={(id) =>
          setEnabledTools((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        attachments={attachments}
        uploading={uploading}
        fileInput={fileInput}
        onPickFiles={() => fileInput.current?.click()}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        onFiles={uploadFiles}
        status={submissionStatus}
        error={error}
        onDismissError={() => setError("")}
        accept={(() => {
          const extMap: Record<string, string> = {
            "application/pdf": ".pdf",
            "text/plain": ".txt",
            "text/markdown": ".md",
            "application/json": ".json",
            "text/csv": ".csv",
            "image/png": ".png",
            "image/jpeg": ".jpeg,.jpg",
            "image/webp": ".webp",
            "text/typescript": ".ts,.tsx",
            "text/javascript": ".js,.jsx",
            "text/x-python": ".py",
            "text/css": ".css",
            "text/html": ".html",
          };
          return ALLOWED_ATTACHMENT_TYPES.map((m) => extMap[m] || m).join(",");
        })()}
      />
      </div>
    </div>
  );
}

function Composer({
  input,
  onInput,
  onSend,
  onStop,
  streaming,
  canSend,
  model,
  toolMode,
  onToolModeChange,
  enabledTools,
  onToggleTool,
  attachments,
  uploading,
  fileInput,
  onPickFiles,
  onRemoveAttachment,
  onFiles,
  status,
  error,
  onDismissError,
  accept,
}: {
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  canSend: boolean;
  model: Model | null;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  enabledTools: string[];
  onToggleTool: (id: string) => void;
  attachments: Attachment[];
  uploading: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onPickFiles: () => void;
  onRemoveAttachment: (a: Attachment) => void;
  onFiles: (files: FileList | File[]) => void;
  status: ChatSubmissionStatus;
  error: string;
  onDismissError: () => void;
  accept: string;
}) {
  return (
    <div className="v3-composer-dock">
      <span className="sr-only" role="status" aria-live="polite">
        {status === "idle" ? "" : status.replaceAll("-", " ")}
      </span>
      <p className="v3-composer__disclaimer">
        AI can make mistakes. Verify important information and provider boundaries.
      </p>
      <motion.div
        className="v3-composer"
        data-streaming={streaming}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={fileInput}
          hidden
          type="file"
          multiple
          accept={accept}
          onChange={(event) => event.target.files && void onFiles(event.target.files)}
        />
        {attachments.length > 0 && (
          <div className="v3-composer__attachments">
            {attachments.map((attachment) => (
              <span key={attachment.id} className="v3-composer__attachment">
                <FileText size={13} />
                <b>{attachment.name}</b>
                <small>{Math.ceil(attachment.size / 1024)} KB</small>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment)}
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="v3-composer__row">
          <textarea
            aria-label="Message Aegis"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onPaste={(event) => {
              const files = event.clipboardData.files;
              if (files.length) void onFiles(files);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                // Sending while streaming interrupts the current generation.
                if (canSend) onSend();
              }
            }}
            placeholder={
              !model
                ? "Choose a model to begin..."
                : input
                  ? ""
                  : streaming
                    ? "Generating… press Enter to send a new message"
                    : `Message ${model.name}…`
            }
            disabled={!model}
          />
          <div className="v3-composer__sendbox">
            {streaming ? (
              <motion.button
                type="button"
                className="v3-composer__stop"
                onClick={onStop}
                whileTap={{ scale: 0.92 }}
                aria-label="Stop generation"
              >
                <CircleStop size={16} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                className="v3-composer__send"
                onClick={onSend}
                disabled={!canSend}
                whileHover={canSend ? { scale: 1.06 } : undefined}
                whileTap={canSend ? { scale: 0.92 } : undefined}
                aria-label="Send message"
              >
                <ArrowUp size={16} />
              </motion.button>
            )}
          </div>
        </div>
        <div className="v3-composer__toolbar">
          <div className="v3-composer__left">
            <ModelSelector />
            <AegisIconButton
              icon={Paperclip}
              label={uploading ? "Uploading file" : "Attach file"}
              accent="blue"
              loading={uploading}
              onClick={onPickFiles}
              tooltip="Attach a file"
            />
            <ToolsPopover
              mode={toolMode}
              onModeChange={onToolModeChange}
              enabled={enabledTools}
              onToggle={onToggleTool}
            />
            <span className="v3-composer__divider" aria-hidden="true" />
            <AegisIconButton
              icon={Github}
              label="GitHub"
              accent={enabledTools.includes("github.listRepositories") ? "violet" : "neutral"}
              active={enabledTools.includes("github.listRepositories")}
              onClick={() => onToggleTool("github.listRepositories")}
              tooltip="Toggle GitHub access"
            />
            <AegisIconButton
              icon={Mail}
              label="Gmail"
              accent={enabledTools.includes("gmail.getLatestMessage") ? "violet" : "neutral"}
              active={enabledTools.includes("gmail.getLatestMessage")}
              onClick={() => onToggleTool("gmail.getLatestMessage")}
              tooltip="Toggle Gmail access"
            />
            <AegisIconButton
              icon={SlidersHorizontal}
              label="Settings"
              tooltip="Composer settings"
              disabled
            />
          </div>
          <div className="v3-composer__right">
            {enabledTools.length > 0 && (
              <span className="v3-composer__chip">
                {enabledTools.length} tool{enabledTools.length > 1 ? "s" : ""}
              </span>
            )}
            {model && (
              <span className={`v3-composer__mode ${model.local ? "is-local" : "is-cloud"}`}>
                {model.local ? <Laptop size={11} /> : <Cloud size={11} />}
                {model.local ? "LOCAL" : "CLOUD"}
              </span>
            )}
          </div>
        </div>
        {model && (
          <div className="v3-composer__meta">
            <span className="v3-composer__hint">
              <kbd>Enter</kbd> send · <kbd>Shift Enter</kbd> new line
            </span>
            <span className="v3-composer__context">
              {model.contextLength ? (
                <>Context {formatTokens(model.contextLength)}</>
              ) : (
                <>Context —</>
              )}
              {model.pricing?.input != null && model.pricing.output != null && (
                <b>
                  {" "}
                  · ${formatPrice(model.pricing.input)} / ${formatPrice(model.pricing.output)} M
                </b>
              )}
            </span>
          </div>
        )}
      </motion.div>
      {error && (
        <div role="alert" className="v3-composer__error">
          <span>{error}</span>
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

function formatPrice(value: number) {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(2);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
