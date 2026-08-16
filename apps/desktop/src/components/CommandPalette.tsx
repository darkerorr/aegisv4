import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FolderOpen, HardDrive, MessageSquarePlus, Search, Settings, Terminal, Wifi } from "lucide-react";
import { useSidebar, type View } from "../contexts/SidebarContext";
import { useChat } from "../contexts/ChatContext";
import { AegisGlass, AegisInput } from "./ui/AegisUI";
import { useAuth } from "../contexts/AuthContext";

const actions: Array<{ label: string; hint: string; view: View; icon: React.ReactNode }> = [
  { label: "New chat", hint: "Ctrl N", view: "Chat", icon: <MessageSquarePlus size={17} /> },
  { label: "Search conversations", hint: "Chat history", view: "Chat", icon: <Search size={17} /> },
  { label: "Open project", hint: "Ctrl O", view: "Projects", icon: <FolderOpen size={17} /> },
  { label: "Change model", hint: "AI models", view: "Models", icon: <Bot size={17} /> },
  { label: "Connect provider", hint: "NVIDIA, OpenRouter, local", view: "Providers", icon: <Wifi size={17} /> },
  { label: "Open terminal sessions", hint: "CLI", view: "CLISessions", icon: <Terminal size={17} /> },
  { label: "Open settings", hint: "Ctrl ,", view: "Settings", icon: <Settings size={17} /> },
  { label: "Switch local mode", hint: "Keep conversations on this device", view: "Chat", icon: <HardDrive size={17} /> },
];

export function CommandPalette() {
  const { navigate } = useSidebar();
  const { clearChat } = useChat();
  const { goLocal } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => actions.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") { event.preventDefault(); clearChat(); navigate("Chat"); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") { event.preventDefault(); navigate("Projects"); }
      if ((event.ctrlKey || event.metaKey) && event.key === ",") { event.preventDefault(); navigate("Settings"); }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearChat, navigate]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); else setQuery(""); }, [open]);
  useEffect(() => setSelectedIndex(0), [query]);
  function runSelected(index: number) {
    const item = filtered[index];
    if (!item) return;
    if (item.label === "New chat") clearChat();
    if (item.label === "Switch local mode") goLocal();
    navigate(item.view);
    setOpen(false);
  }
  if (!open) return null;
  return <div className="command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
    <AegisGlass strong className="command-palette" role="dialog" aria-modal="true" aria-label="Aegis command palette" onMouseDown={(event) => event.stopPropagation()}>
      <div className="command-search"><Search size={18} /><AegisInput ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((value) => Math.min(filtered.length - 1, value + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((value) => Math.max(0, value - 1)); } if (event.key === "Enter") { event.preventDefault(); runSelected(selectedIndex); } }} placeholder="Search actions..." /></div>
      <div className="command-results" role="listbox">{filtered.map((item, index) => <button key={item.label} className={selectedIndex === index ? "selected" : ""} aria-selected={selectedIndex === index} onMouseEnter={() => setSelectedIndex(index)} onClick={() => runSelected(index)}><span>{item.icon}<strong>{item.label}</strong></span><small>{item.hint}</small></button>)}{!filtered.length && <p>No actions found.</p>}</div>
      <footer><span>Up/Down Navigate</span><span>Enter Select</span><span>Esc Close</span></footer>
    </AegisGlass>
  </div>;
}
