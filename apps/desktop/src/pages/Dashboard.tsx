import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Cpu,
  FolderOpen,
  MessageSquare,
  Plus,
  Settings,
  Terminal,
  Wifi,
} from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useModelStore } from "../features/models/modelStore";
import { api } from "../api/client";
import { AegisBadge, AegisButton, AegisCard, AegisStatus } from "../components/ui/AegisUI";

export function Dashboard() {
  const { navigate } = useSidebar();
  const { user, status: authStatus } = useAuth();
  const { fetchConversations, conversations } = useChat();
  const { providers, models, selectedModel, selectedProvider } = useModelStore();
  const [ollamaStatus, setOllamaStatus] = useState<"online" | "offline" | "checking">("checking");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:11434/api/tags");
        if (!cancelled) setOllamaStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setOllamaStatus("offline");
      }
      try {
        await api.listProviders();
      } catch {
        // offline
      }
      try {
        await fetchConversations();
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [fetchConversations]);

  const recentChats = useMemo(() => conversations.slice(0, 5), [conversations]);
  const activeProvider = selectedProvider ?? providers.find((p) => p.active) ?? null;
  const activeModel = selectedModel || models.find((m) => m.available !== false)?.name || null;
  const localModelCount = models.filter((m) => m.local).length;
  const onlineModelCount = models.filter((m) => !m.local).length;

  const statusCards = [
    {
      label: "Ollama",
      status: ollamaStatus,
      icon: <Bot size={20} />,
      action: () => navigate("Providers"),
    },
    {
      label: "Connection",
      status: authStatus === "authenticated" ? "online" : "local",
      icon: <Wifi size={20} />,
      action: () => navigate("Settings"),
    },
    {
      label: "CLI",
      status: "offline" as const,
      icon: <Terminal size={20} />,
      action: () => navigate("CLISessions"),
    },
  ];

  const quickActions = [
    { icon: <MessageSquare size={18} />, label: "New Chat", onClick: () => navigate("NewChat") },
    { icon: <FolderOpen size={18} />, label: "Open Project", onClick: () => navigate("Projects") },
    { icon: <Wifi size={18} />, label: "Connect Provider", onClick: () => navigate("Providers") },
    { icon: <Cpu size={18} />, label: "Browse Models", onClick: () => navigate("Models") },
    { icon: <Terminal size={18} />, label: "CLI Sessions", onClick: () => navigate("CLISessions") },
    { icon: <Settings size={18} />, label: "Settings", onClick: () => navigate("Settings") },
  ];

  return (
    <motion.div
      className="dashboard page-stack"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <header className="feature-heading dashboard-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            {user?.displayName
              ? `Welcome back, ${user.displayName}`
              : "Welcome to Aegis"}
          </h1>
          <p>
            {activeProvider
              ? `${activeProvider.name} is ready${activeModel ? ` · ${activeModel}` : ""}.`
              : "Connect a provider or start a local model to begin."}
          </p>
        </div>
        <AegisButton variant="primary" onClick={() => navigate("NewChat")}>
          <Plus size={15} /> New chat
        </AegisButton>
      </header>

      {/* Quick actions */}
      <div className="quick-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {quickActions.map((action) => (
          <button
            key={action.label}
            className="action-card"
            onClick={action.onClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 16px",
              border: "1px solid var(--aegis-border)",
              borderRadius: 12,
              background: "var(--aegis-surface)",
              color: "var(--aegis-text)",
              fontSize: 12.5,
              fontWeight: 550,
              cursor: "pointer",
              transition: "border-color .16s ease, background .16s ease, transform .16s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--aegis-border-highlight)";
              e.currentTarget.style.background = "rgba(22,137,245,.07)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--aegis-border)";
              e.currentTarget.style.background = "var(--aegis-surface)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <span style={{ color: "var(--aegis-blue-light)" }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Status grid */}
      <div className="status-grid-dashboard" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {statusCards.map((card) => (
          <div
            key={card.label}
            className="status-card-dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 18px",
              border: "1px solid var(--aegis-border)",
              borderRadius: 14,
              background: "var(--aegis-surface)",
              cursor: "pointer",
              transition: "border-color .16s ease, transform .16s ease",
            }}
            onClick={card.action}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--aegis-border-highlight)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--aegis-border)"; e.currentTarget.style.transform = "none"; }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background:
                  card.status === "online" || card.status === "local"
                    ? "rgba(54,213,138,.1)"
                    : "rgba(143,162,191,.07)",
                color:
                  card.status === "online" || card.status === "local"
                    ? "var(--aegis-success)"
                    : "var(--aegis-text-muted)",
              }}
            >
              {card.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--aegis-text-muted)" }}>{card.label}</p>
              <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      card.status === "online" || card.status === "local"
                        ? "var(--aegis-success)"
                        : "var(--aegis-offline)",
                    boxShadow:
                      card.status === "online" || card.status === "local"
                        ? "0 0 8px var(--aegis-success)"
                        : "none",
                  }}
                />
                {card.status === "online"
                  ? "Online"
                  : card.status === "local"
                  ? "Local"
                  : card.status === "checking"
                  ? "Checking…"
                  : "Offline"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Active model + provider summary */}
      <div className="dashboard-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <AegisCard raised className="dashboard-summary-card" style={{ padding: 16 }}>
          <div className="card-title">
            <span className="card-icon"><Cpu size={18} /></span>
            <div>
              <h2>Active model</h2>
              <p>{activeModel || "No model selected"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <AegisBadge tone="blue">{localModelCount} local</AegisBadge>
            <AegisBadge tone="orange">{onlineModelCount} online</AegisBadge>
          </div>
          <AegisButton variant="ghost" onClick={() => navigate("Models")} style={{ marginTop: 12 }}>
            Browse models <ArrowRight size={13} />
          </AegisButton>
        </AegisCard>

        <AegisCard raised className="dashboard-summary-card" style={{ padding: 16 }}>
          <div className="card-title">
            <span className="card-icon"><Wifi size={18} /></span>
            <div>
              <h2>Active provider</h2>
              <p>{activeProvider?.name || "No provider connected"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {activeProvider ? (
              <AegisStatus tone={activeProvider.kind === "ollama" || activeProvider.kind === "lmstudio" ? "blue" : "success"} label={activeProvider.kind === "ollama" || activeProvider.kind === "lmstudio" ? "On device" : "Online"} />
            ) : (
              <AegisStatus tone="danger" label="Not connected" />
            )}
          </div>
          <AegisButton variant="ghost" onClick={() => navigate("Providers")} style={{ marginTop: 12 }}>
            Manage providers <ArrowRight size={13} />
          </AegisButton>
        </AegisCard>
      </div>

      {/* Recent conversations */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Recent conversations</h2>
          {recentChats.length > 0 && (
            <button className="text-button" onClick={() => navigate("Chat")} style={{ fontSize: 12 }}>
              View all
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ display: "grid", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="aegis-skeleton" style={{ height: 58, borderRadius: 12 }} />
            ))}
          </div>
        ) : recentChats.length === 0 ? (
          <AegisCard className="aegis-empty-state" style={{ minHeight: 220, marginTop: 0 }}>
            <span className="aegis-empty-icon"><MessageSquare size={22} /></span>
            <h2>No conversations yet</h2>
            <p>Start a chat and your recent conversations will appear here.</p>
            <AegisButton variant="primary" onClick={() => navigate("NewChat")}>
              <Plus size={14} /> Start a chat
            </AegisButton>
          </AegisCard>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentChats.map((conv) => (
              <div
                key={conv.id}
                className="conversation-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  border: "1px solid var(--aegis-border)",
                  borderRadius: 12,
                  background: "var(--aegis-surface)",
                  cursor: "pointer",
                  transition: "border-color .16s ease, transform .16s ease",
                }}
                onClick={() => navigate("Chat")}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--aegis-border-highlight)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--aegis-border)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 550, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {conv.title}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--aegis-text-muted)" }}>
                    {conv.model} · {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10.5,
                    padding: "3px 9px",
                    borderRadius: 99,
                    background: "rgba(22,137,245,.1)",
                    color: "var(--aegis-blue-light)",
                  }}
                >
                  {conv.messages.length} messages
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Providers section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Providers</h2>
          <button className="text-button" onClick={() => navigate("Providers")} style={{ fontSize: 12 }}>
            Manage
          </button>
        </div>
        {providers.length === 0 ? (
          <AegisCard className="aegis-empty-state" style={{ minHeight: 200, marginTop: 0 }}>
            <span className="aegis-empty-icon"><Wifi size={22} /></span>
            <h2>No providers configured</h2>
            <p>Connect NVIDIA, OpenRouter, Ollama or LM Studio to start chatting.</p>
            <AegisButton variant="primary" onClick={() => navigate("Providers")}>
              <Wifi size={14} /> Configure provider
            </AegisButton>
          </AegisCard>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {providers.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  border: "1px solid var(--aegis-border)",
                  borderRadius: 12,
                  background: "var(--aegis-surface)",
                }}
              >
                <span className="card-icon" style={{ width: 34, height: 34 }}>
                  {p.kind === "ollama" ? <Bot size={16} /> : p.kind === "lmstudio" || p.kind === "lm-studio" ? <Cpu size={16} /> : <Wifi size={16} />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <AegisStatus tone={p.active ? "success" : "neutral"} label={p.active ? "Active" : "Inactive"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}