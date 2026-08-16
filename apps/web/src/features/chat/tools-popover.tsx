"use client";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, GitBranch, Mail, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AegisIconButton } from "@/components/ui/icon-button";
import { integrationsApi } from "@/lib/api/integrations";
import { queryKeys } from "@/lib/query/keys";

export type ToolMode = "auto" | "ask" | "manual";
type ToolItem={id:string;name:string;description:string;icon:LucideIcon;integration?:string;implemented:boolean};
const tools:ToolItem[] = [
  { id: "gmail.getLatestMessage", name: "Gmail", description: "Read and search your email", icon: Mail, integration: "google", implemented: true },
  { id: "drive.searchFiles", name: "Google Drive", description: "Find files and metadata", icon: FileText, integration: "google", implemented: false },
  { id: "github.listRepositories", name: "GitHub", description: "Inspect repositories and issues", icon: GitBranch, integration: "github", implemented: true },
  { id: "attachments.readText", name: "Attachments", description: "Read uploaded text and code", icon: FileText, implemented: true },
];

export function ToolsPopover({ mode, onModeChange, enabled, onToggle }: { mode: ToolMode; onModeChange: (mode: ToolMode) => void; enabled: string[]; onToggle: (id: string) => void }) {
  const googleQuery = useQuery({ queryKey: queryKeys.integrations, queryFn: () => integrationsApi.google(), staleTime: 30_000 });
  const githubQuery = useQuery({ queryKey: ["github-status"], queryFn: () => integrationsApi.githubStatus(), staleTime: 30_000, retry: false });
  const google = googleQuery.data?.integration;
  const github = githubQuery.data;
  const isConnected = (integration?: string) => {
    if (!integration) return true; // No integration needed (web search)
    if (integration === "google") return google?.status === "connected";
    if (integration === "github") return github?.status === "connected";
    return false;
  };
  return <Popover><PopoverTrigger asChild><AegisIconButton icon={Wrench} label="Tools" accent="violet" /></PopoverTrigger><PopoverContent side="top" align="start" className="tools-popover" aria-label="Conversation tools">
    <header><div><strong>Tools</strong><span>Aegis only uses tools shown here.</span></div></header>
    <div className="tool-mode" role="radiogroup" aria-label="Tool mode">{(["auto","ask","manual"] as const).map(value=><button type="button" role="radio" aria-checked={mode===value} data-active={mode===value} key={value} onClick={()=>onModeChange(value)}>{value === "ask" ? "Ask" : value[0].toUpperCase()+value.slice(1)}</button>)}</div>
    <div className="tool-list">{tools.map(tool=>{const connected=isConnected(tool.integration);const available=tool.implemented&&connected;const active=enabled.includes(tool.id);return <button type="button" key={tool.id} disabled={!available} onClick={()=>onToggle(tool.id)} aria-pressed={active}><tool.icon size={18}/><span><strong>{tool.name}</strong><small>{tool.description}</small></span><b>{!tool.implemented?"Coming soon":!connected?"Connect":active?<><Check size={13}/> On</>:mode==="auto"?"Auto":"Off"}</b></button>})}</div>
  </PopoverContent></Popover>;
}
