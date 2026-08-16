import { useMemo, useState } from "react";
import { Folder, FolderOpen, MessageSquare, Plus, Terminal, Trash2 } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { AegisBadge, AegisButton, AegisCard, AegisEmptyState, AegisInput } from "../components/ui/AegisUI";

type LocalProject = { id: string; name: string; path: string; lastOpenedAt: string; trusted: boolean };
const storageKey = "aegis-desktop-projects";
function loadProjects(): LocalProject[] { try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as LocalProject[]; } catch { return []; } }

export function ProjectsPage() {
  const { navigate } = useSidebar();
  const [projects, setProjects] = useState(loadProjects);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const sorted = useMemo(() => [...projects].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)), [projects]);
  function save(next: LocalProject[]) { setProjects(next); localStorage.setItem(storageKey, JSON.stringify(next)); }
  function add() { if (!name.trim() || !path.trim()) return; save([...projects, { id: crypto.randomUUID(), name: name.trim(), path: path.trim(), lastOpenedAt: new Date().toISOString(), trusted: false }]); setName(""); setPath(""); setAdding(false); }
  function open(project: LocalProject) { save(projects.map((item) => item.id === project.id ? { ...item, lastOpenedAt: new Date().toISOString() } : item)); navigate("Chat"); }
  return <section className="feature-page"><header className="feature-heading"><div><p className="eyebrow">Local workspace</p><h1>Projects</h1><p>Keep project references on this device. Files are never synchronized automatically.</p></div><AegisButton variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add project</AegisButton></header>
    {adding && <AegisCard raised className="project-create"><AegisInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" /><AegisInput value={path} onChange={(event) => setPath(event.target.value)} placeholder="Local folder path" /><div><AegisButton onClick={() => setAdding(false)}>Cancel</AegisButton><AegisButton variant="primary" disabled={!name.trim() || !path.trim()} onClick={add}>Save project</AegisButton></div></AegisCard>}
    {!sorted.length ? <AegisEmptyState icon={<FolderOpen size={24} />} title="No projects yet" description="Add a local folder reference to chat about a codebase without uploading it." action={<AegisButton variant="primary" onClick={() => setAdding(true)}>Add your first project</AegisButton>} /> : <div className="feature-grid">{sorted.map((project) => <AegisCard key={project.id} className="project-card"><div className="card-title"><span className="card-icon"><Folder size={19} /></span><div><h2>{project.name}</h2><p title={project.path}>{project.path}</p></div><AegisBadge tone={project.trusted ? "success" : "neutral"}>{project.trusted ? "Trusted" : "Not trusted"}</AegisBadge></div><p className="card-meta">Last opened {new Date(project.lastOpenedAt).toLocaleString()}</p><div className="card-actions"><AegisButton variant="primary" onClick={() => open(project)}><MessageSquare size={15} /> Chat</AegisButton><AegisButton onClick={() => navigate("CLISessions")}><Terminal size={15} /> CLI</AegisButton><AegisButton variant="ghost" aria-label={`Remove ${project.name}`} onClick={() => { if (confirm(`Remove ${project.name} from Aegis?`)) save(projects.filter((item) => item.id !== project.id)); }}><Trash2 size={15} /></AegisButton></div></AegisCard>)}</div>}
  </section>;
}
