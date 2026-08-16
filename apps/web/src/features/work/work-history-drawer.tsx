"use client";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, History, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Project, WorkSession } from "@aegis/api-client";
import { Button } from "@/components/ui/button";

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString();
}

interface WorkHistoryDrawerProps {
  open: boolean;
  sessions: WorkSession[];
  loading: boolean;
  saving: boolean;
  activeSessionId: string | null;
  activeProject: { id: string; name: string; color: string } | null;
  projects: Project[];
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSetProject: (projectId: string | null) => void;
  onCreateProject: (input: { name: string; description?: string }) => void;
}

export function WorkHistoryDrawer({
  open, sessions, loading, saving, activeSessionId, activeProject, projects,
  onClose, onNew, onSelect, onRename, onDelete, onSetProject, onCreateProject,
}: WorkHistoryDrawerProps) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const submitProject = (event: React.FormEvent) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    onCreateProject({ name, description: projectDescription.trim() || undefined });
    setProjectName("");
    setProjectDescription("");
    setCreatingProject(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="work-drawer__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="work-drawer work-drawer--history"
            aria-label="Historique des sessions de travail"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="work-drawer__head">
              <div className="work-drawer__title">
                <History size={15} />
                <div>
                  <strong>Historique</strong>
                  <span>{saving ? "Sauvegarde…" : `${sessions.length} session${sessions.length > 1 ? "s" : ""}`}</span>
                </div>
              </div>
              <div className="work-drawer__actions">
                <button type="button" className="work-drawer__icon" title="Fermer" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="work-history__new">
              <Button variant="primary" className="work-history__new-btn" disabled={loading} onClick={onNew}>
                <Plus size={14} />Nouvelle session
              </Button>
            </div>

            <div className="work-history__list">
              {loading ? (
                <div className="work-history__empty">
                  <LoaderCircle className="spin" size={16} />
                  <span>Chargement…</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="work-history__empty">
                  <History size={16} />
                  <span>Aucune session. Envoie un message pour en créer une.</span>
                </div>
              ) : (
                sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`work-history__item ${active ? "is-active" : ""}`}
                      onClick={() => onSelect(session.id)}
                    >
                      <button type="button" className="work-history__main" title={session.title}>
                        <span className="work-history__title">{session.title}</span>
                        <span className="work-history__meta">
                          {session.workspaceId && <span className="work-history__workspace"><FolderOpen size={10} />{session.workspaceId}</span>}
                          <time>{formatRelativeTime(session.updatedAt)}</time>
                        </span>
                        {session.project && (
                          <span className="work-history__project" data-color={session.project.color}>
                            <i aria-hidden="true" />{session.project.name}
                          </span>
                        )}
                      </button>
                      <div className="work-history__item-actions">
                        <button
                          type="button"
                          title="Renommer"
                          aria-label={`Renommer ${session.title}`}
                          onClick={(event) => { event.stopPropagation(); const next = window.prompt("Nouveau titre", session.title); if (next && next.trim() && next.trim() !== session.title) onRename(session.id, next.trim()); }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          aria-label={`Supprimer ${session.title}`}
                          onClick={(event) => { event.stopPropagation(); if (window.confirm(`Supprimer la session « ${session.title} » ?`)) onDelete(session.id); }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="work-history__projects">
              <div className="work-history__projects-head">
                <strong>Projet</strong>
                {activeProject && (
                  <button type="button" className="work-history__unlink" title="Retirer la liaison du projet" onClick={() => onSetProject(null)}>
                    Retirer
                  </button>
                )}
              </div>
              {activeProject ? (
                <span className="work-history__project work-history__project--current" data-color={activeProject.color}>
                  <i aria-hidden="true" />{activeProject.name}
                </span>
              ) : (
                <p className="work-history__projects-hint">La session courante n&apos;est liée à aucun projet.</p>
              )}

              <select
                className="work-drawer__select work-history__projects-select"
                aria-label="Lier un projet existant"
                value=""
                onChange={(event) => { if (event.target.value) onSetProject(event.target.value); }}
              >
                <option value="" disabled>Lier un projet existant…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>

              {creatingProject ? (
                <form className="work-history__project-form" onSubmit={submitProject}>
                  <input
                    className="field"
                    placeholder="Nom du projet"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    autoFocus
                    required
                  />
                  <input
                    className="field"
                    placeholder="Description (optionnel)"
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                  />
                  <div className="work-history__project-form-actions">
                    <Button type="submit" variant="primary" size="sm">Créer</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setCreatingProject(false)}>Annuler</Button>
                  </div>
                </form>
              ) : (
                <Button type="button" variant="secondary" className="work-history__project-create" onClick={() => setCreatingProject(true)}>
                  <Plus size={12} />Créer un projet
                </Button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
