import { ChevronDown, Command, PanelRight, Terminal } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useChat } from "../contexts/ChatContext";
import { AegisBadge, AegisIconButton, AegisStatus } from "./ui/AegisUI";

export function Topbar() {
  const { user, status } = useAuth();
  const { view, navigate } = useSidebar();
  const { selectedModel, selectedProvider, streaming, currentConversation } = useChat();
  const title = view === "Chat" || view === "Chats" || view === "NewChat" ? currentConversation?.title || "New conversation" : view;
  const local = status === "local" || selectedProvider?.kind === "ollama" || selectedProvider?.kind === "lmstudio";
  return <header className="desktop-topbar">
    <div className="topbar-title"><h1>{title}</h1>{(view === "Chat" || view === "Chats" || view === "NewChat") && <span>{selectedModel || "Choose a model"}</span>}</div>
    <div className="topbar-model">{selectedProvider && <AegisBadge tone="blue">{selectedProvider.name}</AegisBadge>}{selectedModel && <AegisBadge tone="orange">{selectedModel}</AegisBadge>}<AegisStatus tone={local ? "blue" : "success"} label={local ? "Local only" : "Synced"} />{streaming && <AegisStatus tone="orange" label="Generating" />}</div>
    <div className="topbar-actions"><button className="command-hint" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}><Command size={14} /><span>Search</span><kbd>Ctrl K</kbd></button><AegisIconButton label="CLI sessions" onClick={() => navigate("CLISessions")}><Terminal size={16} /></AegisIconButton><AegisIconButton label="Context panel" onClick={() => window.dispatchEvent(new Event("aegis:toggle-context"))}><PanelRight size={16} /></AegisIconButton><button className="topbar-account" onClick={() => navigate("Account")}><span>{user?.displayName?.[0]?.toUpperCase() || (status === "local" ? "L" : "A")}</span><ChevronDown size={13} /></button></div>
  </header>;
}
