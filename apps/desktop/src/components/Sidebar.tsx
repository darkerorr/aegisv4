import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, Bot, ChevronRight, Cpu, FolderOpen, Home, Link2, MessageSquare, PanelLeftClose, Pin, Plus, Search, Settings, ShieldCheck, Terminal, Trash2, Wifi } from "lucide-react";
import { useSidebar, type View } from "../contexts/SidebarContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import logoUrl from "../assets/aegis-logo.png";

type NavItem = { view: View; label: string; icon: ReactNode };
const NAV: NavItem[] = [
  { view: "Home", label: "Home", icon: <Home size={17} /> },
  { view: "Projects", label: "Projects", icon: <FolderOpen size={17} /> },
  { view: "Agents", label: "Agents", icon: <Bot size={17} /> },
  { view: "Models", label: "Models", icon: <Cpu size={17} /> },
  { view: "Providers", label: "Providers", icon: <Wifi size={17} /> },
  { view: "Connections", label: "Connections", icon: <Link2 size={17} /> },
  { view: "Security", label: "Security", icon: <ShieldCheck size={17} /> },
  { view: "CLISessions", label: "CLI Sessions", icon: <Terminal size={17} /> },
  { view: "Diagnostics", label: "Diagnostics", icon: <Activity size={17} /> },
  { view: "Settings", label: "Settings", icon: <Settings size={17} /> },
];
const pinKey = "aegis-pinned-conversations";

export function Sidebar() {
  const { collapsed, toggle, view, navigate } = useSidebar();
  const { status, user } = useAuth();
  const { conversations, selectConversation, clearChat, deleteConversation, renameConversation } = useChat();
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(pinKey) || "[]") as string[]; } catch { return []; } });
  const visible = useMemo(() => conversations.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id))).slice(0, 16), [conversations, pinned, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") { event.preventDefault(); toggle(); } }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  function togglePin(id: string) { const next = pinned.includes(id) ? pinned.filter((item) => item !== id) : [...pinned, id]; setPinned(next); localStorage.setItem(pinKey, JSON.stringify(next)); }
  function newChat() { clearChat(); navigate("Chat"); }
  function openConversation(id: string) { void selectConversation(id); navigate("Chat"); }

  return <motion.aside className="desktop-sidebar" animate={{ width: collapsed ? 72 : 274 }} transition={{ duration: .22, ease: [0.2, 0.8, 0.2, 1] }}>
    <div className="desktop-sidebar-brand"><button onClick={newChat} aria-label="Open Aegis Chat"><img src={logoUrl} alt="Aegis" />{!collapsed && <span>Aegis</span>}</button><button className="sidebar-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={16} /> : <PanelLeftClose size={16} />}</button></div>
    <button className="new-chat-button" onClick={newChat}><Plus size={17} />{!collapsed && <span>New chat</span>}</button>
    {!collapsed && <div className="sidebar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></div>}

    <nav className="desktop-sidebar-scroll" aria-label="Aegis navigation">
      {!collapsed && <p className="sidebar-section-label">Conversations</p>}
      {collapsed && <button className={`sidebar-link ${view === "Chat" ? "active" : ""}`} onClick={() => navigate("Chat")} title="Conversations"><MessageSquare size={17} /></button>}
      {!collapsed && <div className="conversation-list">{visible.map((conversation) => <div key={conversation.id} className="conversation-item"><button onClick={() => openConversation(conversation.id)} onDoubleClick={() => { const next = prompt("Rename conversation", conversation.title); if (next?.trim()) void renameConversation(conversation.id, next.trim()); }}><MessageSquare size={14} /><span>{conversation.title}</span>{pinned.includes(conversation.id) && <Pin size={11} className="pinned" />}</button><div className="conversation-actions"><button onClick={() => togglePin(conversation.id)} aria-label={pinned.includes(conversation.id) ? "Unpin conversation" : "Pin conversation"}><Pin size={12} /></button><button onClick={() => { if (confirm(`Delete ${conversation.title}?`)) void deleteConversation(conversation.id); }} aria-label="Delete conversation"><Trash2 size={12} /></button></div></div>)}{!visible.length && <p className="sidebar-empty">{query ? "No matching conversations" : "Your conversations will appear here"}</p>}</div>}

      {!collapsed && <p className="sidebar-section-label">Workspace</p>}
      {NAV.map((item) => <button key={item.view} className={`sidebar-link ${view === item.view ? "active" : ""}`} onClick={() => navigate(item.view)} title={collapsed ? item.label : undefined}>{item.icon}{!collapsed && <span>{item.label}</span>} {view === item.view && <i />}</button>)}
    </nav>

    <footer className="desktop-sidebar-footer"><button className={`sidebar-account ${view === "Account" ? "active" : ""}`} onClick={() => navigate("Account")}><span className="sidebar-avatar">{user?.displayName?.[0]?.toUpperCase() || (status === "local" ? "L" : "A")}</span>{!collapsed && <span><strong>{user?.displayName || (status === "local" ? "Local mode" : "Aegis account")}</strong><small>{status === "authenticated" ? "Synced" : "On this device"}</small></span>}</button><button className="sidebar-settings" onClick={() => navigate("Settings")} aria-label="Settings"><Settings size={17} /></button></footer>
  </motion.aside>;
}
