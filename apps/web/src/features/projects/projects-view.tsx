"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FolderKanban, Layers3, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatePanel } from "@/components/feedback/state-panel";
import { normalizeError } from "@/lib/api/errors";

const projectsKey = ["projects"] as const;

export function ProjectsView() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: projectsKey, queryFn: () => api.listProjects() });
  const create = useMutation({
    mutationFn: (form: FormData) => api.createProject({ name: String(form.get("name")), description: String(form.get("description") || ""), instructions: String(form.get("instructions") || ""), defaultModel: String(form.get("defaultModel") || "") }),
    onSuccess: () => { setOpen(false); void queryClient.invalidateQueries({ queryKey: projectsKey }); },
  });
  const projects = query.data?.projects || [];

  return <>
    <section className="product-hero compact">
      <div>
        <span className="eyebrow"><Layers3 size={14} /> Persistent context</span>
        <h2>Projects that keep the thread of the work.</h2>
        <p>Group instructions, conversations and model choices into durable workspaces without changing provider boundaries.</p>
      </div>
      <Button onClick={() => setOpen(true)}><Plus size={15} />New project</Button>
    </section>
    {query.isError ? <StatePanel state="error" title="Projects unavailable" message={normalizeError(query.error).message} onRetry={() => query.refetch()} />
      : projects.length ? <motion.div className="project-grid premium-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}>
        {projects.map((project) => <motion.div key={project.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <Link href={`/projects/${project.id}`} className="premium-project-card">
            <span><FolderKanban size={20} /></span>
            <small>{project.conversationCount || 0} conversations</small>
            <h2>{project.name}</h2>
            <p>{project.description || "No description yet. Add instructions to make this workspace feel intentional."}</p>
            <footer><b>{project.defaultModel || "Workspace default"}</b><ArrowRight size={15} /></footer>
          </Link>
        </motion.div>)}
      </motion.div>
      : <div className="empty-premium-state"><FolderKanban size={34} /><h2>{query.isLoading ? "Loading projects" : "No projects yet"}</h2><p>Create your first project to pin durable instructions, files and model preferences to a real workflow.</p><Button onClick={() => setOpen(true)}><Plus size={15} />Create project</Button></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="New project" description="Create durable context without adding fictional data."><form className="project-form premium-form" action={(form) => create.mutate(form)}><label>Project name<input autoFocus className="field" name="name" required maxLength={100} /></label><label>Description<textarea className="field" name="description" maxLength={1000} /></label><label>Default model<input className="field" name="defaultModel" placeholder="Optional technical model ID" /></label><label>Instructions<textarea className="field" name="instructions" placeholder="How should Aegis work inside this project?" /></label>{create.isError && <p role="alert" className="form-error">{normalizeError(create.error).message}</p>}<div><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={create.isPending}>{create.isPending ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}Create project</Button></div></form></DialogContent></Dialog>
  </>;
}
