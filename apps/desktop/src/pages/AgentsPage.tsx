import { Bot, MessageSquare, ShieldCheck } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { AegisButton, AegisEmptyState } from "../components/ui/AegisUI";

export function AgentsPage() {
  const { navigate } = useSidebar();
  return <section className="feature-page"><header className="feature-heading"><div><p className="eyebrow">Guarded automation</p><h1>Agents</h1><p>Agents expose every proposed command and file change before execution.</p></div></header><AegisEmptyState icon={<Bot size={24} />} title="No agent is running" description="Start from a conversation when you have a concrete objective. Aegis will show the plan, progress and approvals here." action={<div className="empty-actions"><AegisButton variant="primary" onClick={() => navigate("Chat")}><MessageSquare size={15} /> Open Chat</AegisButton><AegisButton onClick={() => navigate("Settings")}><ShieldCheck size={15} /> Review safety settings</AegisButton></div>} /></section>;
}
