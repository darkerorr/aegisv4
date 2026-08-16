"use client";

import { FormEvent, Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Send, Square, LoaderCircle, Trash2, Pencil, Check, X, PanelLeft, Search, MessageSquarePlus, ChevronDown, Globe, Wifi, Star } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError, streamChat } from "../../lib/api";
import { AegisLogo } from "@aegis/shared-ui";

type Message = { id?: string; role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; model: string; messages: Message[]; updatedAt: string };
type ProviderInfo = { id: string; name: string; kind: string };
type ModelInfo = { id: string; name: string; providerId: string; providerName?: string; local?: boolean; favorite?: boolean; visible?: boolean; available?: boolean; capabilities?: string[] };

function ChatInner() {
  const params = useSearchParams();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [text, setText] = useState("");
  const [model, setModel] = useState("llama-3.1-70b");
  const [providerId, setProviderId] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelInfo[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(params.get("conversation") || undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const scrollToBottom = useCallback((): void => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      const [providerResult, modelResult, conversationResult] = await Promise.allSettled([
        api<{ providers: ProviderInfo[] }>("/providers", { signal: controller.signal }),
        api<{ models: ModelInfo[] }>("/models", { signal: controller.signal }),
        api<{ conversations: Conversation[] }>("/conversations", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (providerResult.status === "fulfilled") {
        setProviders(providerResult.value.providers);
        setProviderId((current) => current || providerResult.value.providers[0]?.id || "");
      }
      if (modelResult.status === "fulfilled") {
        const available = modelResult.value.models.filter((item) => item.visible !== false);
        setModelOptions(available);
        const preferred = available.find((item) => item.favorite) ?? available[0];
        if (preferred) { setModel(preferred.name); setProviderId(preferred.providerId); }
      }
      if (conversationResult.status === "fulfilled") setConversations(conversationResult.value.conversations);
    }

    void loadWorkspace();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!conversationId) return () => controller.abort();

    async function loadConversation() {
      try {
        const result = await api<{ conversation: Conversation }>(`/conversations/${conversationId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setMessages(result.conversation.messages);
        if (result.conversation.model) setModel(result.conversation.model);
      } catch {
        if (!controller.signal.aborted) setError("Could not load conversation");
      }
    }

    void loadConversation();
    return () => controller.abort();
  }, [conversationId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || !model || busy) return;
    const userMessage: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMessage];
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");

    try {
      abortRef.current = new AbortController();
      let newId = conversationId;
      let assistantContent = "";
      for await (const event of streamChat({ conversationId: conversationId || undefined, providerId: providerId || undefined, model, messages: next, privacyMode: "remote-provider" }, abortRef.current.signal)) {
        if (event.type === "message.started") newId = event.conversationId;
        else if (event.type === "message.delta") { assistantContent += event.delta; setMessages([...next, { role: "assistant", content: assistantContent }]); }
        else if (event.type === "message.completed") newId = event.conversationId;
        else if (event.type === "message.error") throw new Error(event.error.message);
      }
      if (newId) setConversationId(newId);
      setMessages([...next, { role: "assistant", content: assistantContent }]);
      // Refresh conversation list
      api<{ conversations: Conversation[] }>("/conversations").then((r) => setConversations(r.conversations)).catch(() => undefined);
      if (newId && params.get("conversation") !== newId) {
        router.replace(`/chat?conversation=${newId}`, { scroll: false });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(formatApiError(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function newConversation() {
    setConversationId(undefined);
    setMessages([]);
    setError("");
    router.replace("/chat", { scroll: false });
  }

  async function renameConversation(id: string, title: string) {
    try {
      await api(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    } catch {
      // API route not yet available
    }
    setEditingId(null);
  }

  async function deleteConversation(id: string) {
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) { setConversationId(undefined); setMessages([]); router.replace("/chat", { scroll: false }); }
    } catch {
      // API route not yet available
    }
  }

  const filteredConversations = conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-7xl gap-4">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-white/10 bg-[#0b1220] pt-16 transition-transform lg:static lg:translate-x-0 lg:pt-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold">Conversations</h2>
          <button onClick={newConversation} className="rounded-lg p-1.5 text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white" aria-label="New conversation"><MessageSquarePlus size={18} /></button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aegis-text-muted)]" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="control w-full rounded-lg py-2 pl-8 pr-3 text-sm" placeholder="Search..." />
          </div>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-2" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {filteredConversations.length === 0 && <p className="px-3 py-6 text-center text-xs text-[var(--aegis-text-muted)]">No conversations yet.</p>}
          {filteredConversations.map((c) => (
            <div key={c.id} className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${c.id === conversationId ? "bg-white/10" : "hover:bg-white/5"}`}>
              {editingId === c.id ? (
                <form onSubmit={(e) => { e.preventDefault(); renameConversation(c.id, editTitle); }} className="flex w-full items-center gap-1">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="control flex-1 rounded px-2 py-1 text-xs" autoFocus />
                  <button type="submit" className="p-1 text-green-400"><Check size={14} /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-1 text-red-400"><X size={14} /></button>
                </form>
              ) : (
                <button onClick={() => { setConversationId(c.id); setSidebarOpen(false); router.replace(`/chat?conversation=${c.id}`, { scroll: false }); }} className="flex-1 truncate text-left">{c.title}</button>
              )}
              <div className="hidden gap-0.5 group-hover:flex">
                <button onClick={() => { setEditingId(c.id); setEditTitle(c.title); }} className="rounded p-1 text-[var(--aegis-text-muted)] hover:text-white" aria-label="Rename"><Pencil size={12} /></button>
                <button onClick={() => deleteConversation(c.id)} className="rounded p-1 text-[var(--aegis-text-muted)] hover:text-red-400" aria-label="Delete"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat */}
      <section className="surface flex flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" aria-label="Toggle sidebar"><PanelLeft size={18} /></button>
          <h1 className="font-semibold">Aegis Chat</h1>
          {providers.length > 0 && (
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="ml-auto rounded-lg border border-white/10 bg-transparent px-2 py-1 text-xs text-[var(--aegis-text-muted)]">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="relative ml-auto"><button type="button" onClick={() => setModelMenuOpen((open) => !open)} className="flex max-w-[270px] items-center gap-2 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-xs text-slate-200 hover:border-[var(--aegis-orange)]/50" aria-haspopup="listbox" aria-expanded={modelMenuOpen}>{modelOptions.find((item) => item.name === model)?.local ? <Wifi size={13} className="text-green-300" /> : <Globe size={13} className="text-[var(--aegis-blue-light)]" />}<span className="truncate">{modelOptions.find((item) => item.name === model)?.providerName ?? "Model"} · {model}</span><ChevronDown size={14} /></button>{modelMenuOpen && <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-white/10 bg-[#10203a]/95 p-3 shadow-2xl backdrop-blur-xl"><input autoFocus value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} className="control w-full rounded-lg px-3 py-2 text-xs" placeholder="Search models..." aria-label="Search models" />{modelOptions.filter((item) => `${item.name} ${item.providerName ?? ""} ${(item.capabilities ?? []).join(" ")}`.toLowerCase().includes(modelSearch.toLowerCase())).slice(0, 80).map((item) => <button key={`${item.providerId}:${item.id}`} type="button" onClick={() => { setModel(item.name); setProviderId(item.providerId); setModelMenuOpen(false); setModelSearch(""); }} className={`mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/10 ${item.name === model ? "bg-[var(--aegis-orange)]/10 text-white" : "text-slate-300"}`} role="option" aria-selected={item.name === model}>{item.local ? <Wifi size={13} className="text-green-300" /> : <Globe size={13} className="text-[var(--aegis-blue-light)]" />}<span className="min-w-0 flex-1 truncate">{item.providerName} · {item.name}</span>{item.favorite && <Star size={12} className="text-[var(--aegis-orange)]" fill="currentColor" />}</button>)}{!modelOptions.length && <p className="p-3 text-xs text-[var(--aegis-text-muted)]">Connect a provider to discover models.</p>}<Link href="/models" className="mt-2 block border-t border-white/10 pt-3 text-xs text-[var(--aegis-blue-light)]">Manage models →</Link></div>}</div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-5" role="log" aria-label="Chat messages">
          {messages.length === 0 && (
            <div className="grid min-h-[40vh] place-items-center text-center text-[var(--aegis-text-muted)]">
              <div><AegisLogo src="/aegis-logo.png" size={58} /><p className="mt-5 text-lg text-slate-300">Start a conversation</p><p className="mt-2 text-sm">Choose a provider and model, then send your first message.</p></div>
            </div>
          )}
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`animate-fade-in group ${message.role === "user" ? "ml-auto max-w-2xl" : "max-w-3xl"}`}>
              <div className={`rounded-xl p-4 ${message.role === "user" ? "bg-[var(--aegis-blue)]/10" : ""}`}>
                <p className="mb-2 text-xs uppercase tracking-widest text-[var(--aegis-text-muted)]">{message.role}</p>
                {message.role === "assistant" ? (
                  <div className="prose prose-invert max-w-none text-sm prose-pre:overflow-auto prose-pre:rounded-lg prose-pre:bg-[#05070d] prose-pre:p-4 prose-code:text-[var(--aegis-blue-light)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(message.content); }}
                      className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--aegis-text-muted)] opacity-0 transition hover:bg-white/5 hover:text-white group-hover:opacity-100"
                      aria-label="Copy message"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                )}
              </div>
            </article>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-[var(--aegis-blue-light)]">
              <LoaderCircle className="animate-spin" size={16} /> Aegis is thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p role="alert" className="mx-5 mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}<button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></p>}

        <form onSubmit={send} className="flex items-end gap-3 border-t border-white/10 p-4">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
              className="control w-full resize-none rounded-xl px-4 py-3 pr-12 text-sm"
              placeholder="Ask Aegis..."
              aria-label="Chat input"
            />
          </div>
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl bg-red-500/20 p-3 text-red-400 hover:bg-red-500/30" aria-label="Stop generating"><Square size={18} /></button>
          ) : (
            <button type="submit" disabled={!text.trim()} className="rounded-xl bg-[var(--aegis-orange)] p-3 text-white transition hover:brightness-110 disabled:opacity-30" aria-label="Send message"><Send size={18} /></button>
          )}
        </form>
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Protected>
      <Suspense fallback={<div className="grid min-h-[70vh] place-items-center text-sm text-[var(--aegis-text-muted)]"><LoaderCircle className="animate-spin" size={24} /></div>}>
        <ChatInner />
      </Suspense>
    </Protected>
  );
}
