"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, FolderKanban, Github, LoaderCircle, MessageSquarePlus, MessageSquareText, Pencil, Save, Settings, Trash2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { normalizeError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/feedback/state-panel";

type ProjectTab = "overview" | "chats" | "files" | "instructions" | "github" | "settings";

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<ProjectTab>("overview");
  const [conversationToAdd, setConversationToAdd] = useState("");
  const query = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const conversations = useQuery({ queryKey: ["conversations", "project-picker"], queryFn: () => api.listConversations() });
  const refreshProject = () => {
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };
  const update = useMutation({
    mutationFn: (input: Partial<{ name: string; description: string; instructions: string; githubRepository: string }>) => api.updateProject(projectId, input),
    onSuccess: refreshProject,
  });
  const linkConversation = useMutation({
    mutationFn: (conversationId: string) => api.linkConversationToProject(projectId, conversationId),
    onSuccess: () => { setConversationToAdd(""); refreshProject(); },
  });
  const unlinkConversation = useMutation({
    mutationFn: (conversationId: string) => api.unlinkConversationFromProject(projectId, conversationId),
    onSuccess: refreshProject,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); router.push("/projects"); },
  });

  if (query.isLoading) return <StatePanel state="loading" title="Loading project…" message="Reading project data from the API." />;
  if (query.isError || !query.data?.project) return <StatePanel state="error" title="Project not found" message={query.error ? normalizeError(query.error).message : "This project may have been deleted."} onRetry={() => query.refetch()} />;

  const project = query.data.project;
  const linkedIds = new Set((project.conversations || []).map((conversation) => conversation.id));
  const availableConversations = (conversations.data?.conversations || []).filter((conversation) => !linkedIds.has(conversation.id));
  const actionError = update.error || linkConversation.error || unlinkConversation.error;
  const tabs: Array<{ id: ProjectTab; label: string }> = [
    { id: "overview", label: "Overview" }, { id: "chats", label: "Chats" }, { id: "files", label: "Files" },
    { id: "instructions", label: "Instructions" }, { id: "github", label: "GitHub" }, { id: "settings", label: "Settings" },
  ];

  return <div className="project-detail">
    <div className="project-detail-header">
      <Link href="/projects" className="text-link"><ArrowLeft size={15} /> Projects</Link>
      <h2>{project.name}</h2><p>{project.description || "No description set."}</p>
    </div>
    <nav className="filter-row" aria-label="Project sections">{tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    {actionError && <p role="alert" className="form-error">{normalizeError(actionError).message}</p>}
    <div className="project-detail-sections">
      {tab === "overview" && <section className="settings-panel"><header><FolderKanban size={18} /><div><h2>Overview</h2><p>Project context stored by the API.</p></div></header><div className="project-detail-meta"><span><MessageSquareText size={15} /> {project.conversations?.length ?? 0} conversations</span><span><Settings size={15} /> Model: {project.defaultModel || "Workspace default"}</span><span><Github size={15} /> {project.githubRepository || "No GitHub repository"}</span></div></section>}

      {tab === "chats" && <section className="settings-panel"><header><MessageSquareText size={18} /><div><h2>Chats</h2><p>Start, move or remove conversations.</p></div></header><div className="flex flex-wrap gap-2"><Link className="button button-primary" href={`/chat?projectId=${encodeURIComponent(projectId)}`}><MessageSquarePlus size={15} /> Start chat in project</Link><select className="field" aria-label="Existing conversation" value={conversationToAdd} onChange={(event) => setConversationToAdd(event.target.value)}><option value="">Move an existing conversation…</option>{availableConversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select><Button variant="secondary" disabled={!conversationToAdd || linkConversation.isPending} onClick={() => linkConversation.mutate(conversationToAdd)}>Move to project</Button></div>{project.conversations?.length ? <div className="project-conversation-list">{project.conversations.map((conversation) => <div key={conversation.id} className="project-conversation-item"><Link href={`/chat/${conversation.id}`}><strong>{conversation.title}</strong><time>{new Date(conversation.updatedAt).toLocaleDateString()}</time></Link><Button variant="ghost" aria-label={`Remove ${conversation.title} from project`} onClick={() => unlinkConversation.mutate(conversation.id)}><Unlink size={14} /> Remove</Button></div>)}</div> : <StatePanel state="empty" title="No project chats" message="Start a chat here or move an existing conversation." />}</section>}

      {tab === "files" && <section className="settings-panel"><header><FileText size={18} /><div><h2>Files</h2><p>Project-scoped file storage is not available in this build.</p></div></header><StatePanel state="empty" title="Backend unavailable" message="Attachments remain attached to conversations; this page does not pretend they are project files." /></section>}

      {tab === "instructions" && <section className="settings-panel"><header><Pencil size={18} /><div><h2>Instructions</h2><p>System guidance for this project.</p></div></header><form action={(form) => update.mutate({ instructions: String(form.get("instructions") || "") })}><textarea className="field" name="instructions" rows={6} defaultValue={project.instructions || ""} placeholder="How should Aegis behave in this project?" /><Button disabled={update.isPending}>{update.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />} Save instructions</Button></form></section>}

      {tab === "github" && <section className="settings-panel"><header><Github size={18} /><div><h2>GitHub</h2><p>Repository context; access still requires a valid GitHub connection.</p></div></header><form action={(form) => update.mutate({ githubRepository: String(form.get("githubRepository") || "") })}><input className="field" name="githubRepository" defaultValue={project.githubRepository || ""} placeholder="owner/repository" /><Button disabled={update.isPending}>{update.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />} Save repository</Button></form></section>}

      {tab === "settings" && <><section className="settings-panel"><header><Settings size={18} /><div><h2>Settings</h2><p>Manage project details.</p></div></header><form action={(form) => update.mutate({ name: String(form.get("name")), description: String(form.get("description") || "") })}><label>Name<input className="field" name="name" defaultValue={project.name} required maxLength={100} /></label><label>Description<textarea className="field" name="description" defaultValue={project.description || ""} maxLength={1000} /></label><Button disabled={update.isPending}>{update.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />} Save changes</Button></form></section><section className="settings-panel danger-zone"><header><Trash2 size={18} /><div><h2>Delete project</h2><p>Conversations remain in the workspace.</p></div></header><Button onClick={() => { if (confirm("Delete this project? Conversations remain in the workspace.")) remove.mutate(); }} disabled={remove.isPending} variant="secondary"><Trash2 size={15} /> Delete project</Button></section></>}
    </div>
  </div>;
}