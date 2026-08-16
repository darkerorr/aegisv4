import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { CommandPalette } from "../components/CommandPalette";
import { useSettings } from "../contexts/SettingsContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useChat } from "../contexts/ChatContext";
import { useAuth } from "../contexts/AuthContext";
import { AegisBadge, AegisIconButton, AegisStatus } from "../components/ui/AegisUI";

export function DesktopAppShell({ children }: { children: ReactNode }) {
  const { animations } = useSettings();
  const { view } = useSidebar();
  const { selectedModel, selectedProvider, currentConversation } = useChat();
  const { status } = useAuth();
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => { const toggle = () => setContextOpen((value) => !value); window.addEventListener("aegis:toggle-context", toggle); return () => window.removeEventListener("aegis:toggle-context", toggle); }, []);
  return <div className="desktop-shell">
    <Sidebar />
    <section className="desktop-stage">
      <Topbar />
      <main className={`desktop-content ${view === "Chat" || view === "Chats" || view === "NewChat" ? "desktop-content-chat" : ""}`}>
        <AnimatePresence mode="wait"><motion.div key={view} className="desktop-page" initial={animations ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={animations ? { opacity: 0, y: -6 } : undefined} transition={{ duration: .2 }}>{children}</motion.div></AnimatePresence>
      </main>
    </section>
    {contextOpen && <aside className="context-panel" aria-label="Conversation context"><header><div><p className="eyebrow">Context</p><h2>{currentConversation?.title || "New conversation"}</h2></div><AegisIconButton label="Close context panel" onClick={() => setContextOpen(false)}><X size={16} /></AegisIconButton></header><section><h3>Active model</h3><strong>{selectedModel || "No model selected"}</strong><p>{selectedProvider?.name || "Connect a provider to begin"}</p><div className="context-badges"><AegisStatus tone={status === "local" ? "blue" : "success"} label={status === "local" ? "Local only" : "Synced"} />{selectedProvider && <AegisBadge tone={selectedProvider.kind === "ollama" || selectedProvider.kind === "lmstudio" ? "blue" : "orange"}>{selectedProvider.kind === "ollama" || selectedProvider.kind === "lmstudio" ? "On device" : "Online"}</AegisBadge>}</div></section><section><h3>Project context</h3><p>No project files are attached. Aegis will never add files without your action.</p></section></aside>}
    <CommandPalette />
  </div>;
}
