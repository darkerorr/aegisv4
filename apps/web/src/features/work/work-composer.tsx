"use client";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowUp, CircleStop, Cloud, Laptop, Shield, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/features/chat/model-selector";
import { useModelSelection } from "@/features/chat/model-selection-store";
import { FileTypeIcon } from "@/features/work/file-icon";
import { AegisIcon, type AegisIconName } from "@/components/aegis/aegis-icons";
import { WORK_MODES, type WorkAgentMode } from "@/features/work/work-modes";
import { DEFAULT_TEAM_ROLES, WORK_TEAM_ROLES, type TeamSelectionMode } from "@/features/work/work-team";
import type { WorkAgentRole } from "@aegis/api-client";

interface WorkComposerProps {
  workspaceMode: string | null;
  workspaceName?: string;
  streaming: boolean;
  input: string;
  onInput: (value: string) => void;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
  notice: { title: string; description: string; tone?: "error" } | null;
  onDismissNotice: () => void;
  filePaths: Array<{ name: string; relativePath: string; type: string }>;
  attachedFiles: string[];
  onAttachFile: (relativePath: string) => void;
  onRemoveAttachedFile: (relativePath: string) => void;
  mode: WorkAgentMode;
  onModeChange: (mode: WorkAgentMode) => void;
  teamMode: TeamSelectionMode;
  teamRoles: WorkAgentRole[];
  onTeamChange: (mode: TeamSelectionMode, roles: WorkAgentRole[]) => void;
}

interface ToolItem {
  label: string;
  icon: AegisIconName;
  prompt: string;
}
interface ToolGroup {
  title: string;
  items: ToolItem[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Développement",
    items: [
      { label: "Lire un fichier", icon: "read", prompt: "Lis le fichier [chemin] et explique-le." },
      { label: "Éditer un fichier", icon: "edit", prompt: "Modifie le fichier [chemin] : [changement]" },
      { label: "Créer un fichier", icon: "create", prompt: "Crée le fichier [chemin] avec : [contenu attendu]" },
      { label: "Supprimer un fichier", icon: "delete", prompt: "Supprime le fichier [chemin]." },
      { label: "Déplacer un fichier", icon: "move", prompt: "Déplace [source] vers [destination]." },
      { label: "Chercher dans le workspace", icon: "search", prompt: "Cherche [motif] dans le workspace et résume les correspondances." },
    ],
  },
  {
    title: "Terminal",
    items: [
      { label: "Exécuter une commande", icon: "terminal", prompt: "Exécute la commande : [commande]" },
      { label: "Lancer les tests", icon: "test", prompt: "Exécute les tests du projet (détecte le script approprié) et corrige les échecs." },
      { label: "Lancer le build", icon: "build", prompt: "Lance le build de production et corrige les erreurs." },
      { label: "Lancer le lint", icon: "tool", prompt: "Lance le lint et corrige les erreurs." },
      { label: "Lancer le typecheck", icon: "think", prompt: "Lance le typecheck et corrige les erreurs de types." },
    ],
  },
  {
    title: "Git",
    items: [
      { label: "Statut git", icon: "git", prompt: "Montre le statut git du workspace." },
      { label: "Diff git", icon: "git", prompt: "Montre le diff git non commité." },
      { label: "Créer une branche", icon: "plan", prompt: "Crée une branche git [nom]." },
      { label: "Committer", icon: "success", prompt: "Prépare et committe les changements pertinents avec un message clair." },
    ],
  },
  {
    title: "Web",
    items: [
      { label: "Recherche web", icon: "web", prompt: "Fais une recherche web sur : [sujet]" },
      { label: "Ouvrir une URL", icon: "web", prompt: "Ouvre et résume : [URL]" },
    ],
  },
  {
    title: "Debug",
    items: [
      { label: "Analyser une erreur", icon: "debug", prompt: "Analyse cette erreur et propose une correction : [erreur]" },
      { label: "Inspecter les logs", icon: "list", prompt: "Inspecte les logs et diagnostique les problèmes récents." },
      { label: "Diagnostiquer le build", icon: "build", prompt: "Diagnostique l'échec du build et corrige-le." },
    ],
  },
];

function flattenTree(nodes: Array<{ name: string; relativePath: string; type: string }>): string[] {
  const out: string[] = [];
  const walk = (list: Array<{ name: string; relativePath: string; type: string }>) => {
    for (const node of list) {
      if (node.type === "file") out.push(node.relativePath);
      if (node.type === "directory") walk((node as { children?: Array<{ name: string; relativePath: string; type: string }> }).children ?? []);
    }
  };
  walk(nodes);
  return out;
}

export function WorkComposer({ workspaceMode, workspaceName, streaming, input, onInput, canSend, onSend, onStop, notice, onDismissNotice, filePaths, attachedFiles, onAttachFile, onRemoveAttachedFile, mode, onModeChange, teamMode, teamRoles, onTeamChange }: WorkComposerProps) {
  const { selectedModel: model, modelHydrationStatus } = useModelSelection();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const flatFiles = useMemo(() => flattenTree(filePaths), [filePaths]);
  const filteredFiles = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return q ? flatFiles.filter((path) => path.toLowerCase().includes(q)) : flatFiles;
  }, [flatFiles, pickerQuery]);

  const applyTool = (prompt: string) => {
    const base = prompt.replace(/\[[^\]]*\]/g, (placeholder) => placeholder);
    onInput(input.trim() ? `${input}\n${base}` : base);
    setToolsOpen(false);
  };

  return (
    <div className="work-composer-dock">
      <motion.div
        className="v3-composer work-composer"
        data-streaming={streaming}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {attachedFiles.length > 0 && (
          <div className="work-composer__attach">
            {attachedFiles.map((path) => (
              <motion.span key={path} className="work-capsule" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
                <FileTypeIcon name={path} size={13} />
                <span className="work-capsule__name">{path}</span>
                <button type="button" className="work-capsule__remove" aria-label={`Retirer ${path}`} onClick={() => onRemoveAttachedFile(path)}>
                  <X size={11} />
                </button>
              </motion.span>
            ))}
          </div>
        )}

        <div className="v3-composer__row">
          <textarea
            aria-label="Message the Work Mode agent"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder={!model ? "Choisis un modèle pour commencer..." : streaming ? "L'agent travaille…" : `Dis à l'agent quoi faire dans ${workspaceName ?? "ce workspace"}…`}
            disabled={streaming}
          />
          <div className="v3-composer__sendbox">
            {streaming ? (
              <motion.button type="button" className="v3-composer__stop" onClick={onStop} whileTap={{ scale: 0.92 }} aria-label="Stop generation">
                <CircleStop size={16} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                className="v3-composer__send"
                onClick={onSend}
                disabled={!canSend}
                whileHover={canSend ? { scale: 1.06 } : undefined}
                whileTap={canSend ? { scale: 0.92 } : undefined}
                aria-label="Send message"
              >
                <ArrowUp size={16} />
              </motion.button>
            )}
          </div>
        </div>

        <div className="v3-composer__toolbar">
          <div className="v3-composer__left">
            <ModelSelector />
            <span className="v3-composer__divider" aria-hidden="true" />

            <div className="work-composer__tools">
              <button type="button" className="work-tools__button" aria-expanded={toolsOpen} onClick={() => { setToolsOpen((v) => !v); setPickerOpen(false); }}>
                <AegisIcon name="tool" size={13} />Outils
              </button>
              {toolsOpen && (
                <div className="work-tools__menu" role="menu">
                  {TOOL_GROUPS.map((group) => (
                    <div className="work-tools__group" key={group.title}>
                      <span className="work-tools__group-title">{group.title}</span>
                      {group.items.map((item) => (
                        <button type="button" key={item.label} className="work-tools__item" role="menuitem" onClick={() => applyTool(item.prompt)}>
                          <AegisIcon name={item.icon} size={14} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="work-composer__tools">
              <button type="button" className="work-tools__button" aria-expanded={pickerOpen} onClick={() => { setPickerOpen((v) => !v); setToolsOpen(false); requestAnimationFrame(() => pickerRef.current?.focus()); }}>
                <AegisIcon name="file" size={13} />Fichier
              </button>
              {pickerOpen && (
                <div className="work-tools__menu work-filepicker">
                  <span className="work-tools__group-title">Attacher un fichier au contexte</span>
                  <input ref={pickerRef} className="work-filepicker__search" placeholder="Filtrer…" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} />
                  <div className="work-filepicker__list">
                    {filteredFiles.length === 0 ? (
                      <span className="work-filepicker__empty">Aucun fichier</span>
                    ) : (
                      filteredFiles.slice(0, 80).map((path) => (
                        <button type="button" key={path} className="work-tools__item" onClick={() => { onAttachFile(path); setPickerOpen(false); setPickerQuery(""); }}>
                          <FileTypeIcon name={path} size={13} />
                          <span className="work-filepicker__path">{path}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="v3-composer__divider" aria-hidden="true" />
            <span className="v3-composer__chip" style={{ cursor: "default" }}><Shield size={11} />{workspaceMode ?? "no workspace"}</span>
          </div>

          <div className="v3-composer__right">
            <div className="work-composer__tools work-team">
              <button
                type="button"
                className={`work-tools__button work-team__button ${teamMode === "custom" ? "is-active" : ""}`}
                aria-expanded={teamOpen}
                title="Équipe de 5 agents spécialisés"
                onClick={() => { setTeamOpen((v) => !v); setToolsOpen(false); setPickerOpen(false); }}
              >
                <Users size={13} />
                Équipe{teamMode === "custom" ? ` · ${teamRoles.length || DEFAULT_TEAM_ROLES.length}` : ""}
              </button>
              {teamOpen && (
                <div className="work-team__menu" role="dialog" aria-label="Équipe d'agents">
                  <header className="work-team__head">
                    <strong>Équipe de 5 agents</strong>
                    <span>Des IA spécialisées travaillent en séquence pour livrer un projet complet et rapide.</span>
                  </header>
                  <div className="work-team__mode" role="radiogroup" aria-label="Mode de sélection de l'équipe">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={teamMode === "auto"}
                      data-active={teamMode === "auto"}
                      onClick={() => onTeamChange("auto", teamRoles)}
                    >
                      <AegisIcon name="agent" size={13} />
                      Auto — l&apos;IA choisit
                      <small>Un orchestrateur (Développeur) sélectionne les 4 spécialistes adaptés à la demande.</small>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={teamMode === "custom"}
                      data-active={teamMode === "custom"}
                      onClick={() => onTeamChange("custom", teamRoles.length ? teamRoles : DEFAULT_TEAM_ROLES.slice(1))}
                    >
                      <Users size={13} />
                      Personnalisé — je choisis
                      <small>Sélectionne jusqu&apos;à 4 spécialistes en plus du Développeur.</small>
                    </button>
                  </div>
                  {teamMode === "custom" && (
                    <div className="work-team__roles">
                      {WORK_TEAM_ROLES.filter((entry) => entry.role !== "dev").map((entry) => {
                        const selected = teamRoles.includes(entry.role);
                        const maxed = !selected && teamRoles.length >= 4;
                        return (
                          <button
                            type="button"
                            key={entry.role}
                            className={`work-team__role ${selected ? "is-selected" : ""}`}
                            style={{ "--role-color": entry.color } as CSSProperties}
                            disabled={maxed}
                            aria-pressed={selected}
                            onClick={() => {
                              const next = selected ? teamRoles.filter((role) => role !== entry.role) : [...teamRoles, entry.role].slice(0, 4);
                              onTeamChange("custom", next);
                            }}
                          >
                            <i aria-hidden="true" />
                            <span><strong>{entry.name}</strong><small>{entry.description}</small></span>
                            <b>{selected ? "On" : "Off"}</b>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="work-modes" role="group" aria-label="Mode de l'agent">
              {WORK_MODES.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={`work-modes__btn ${mode === entry.id ? "is-active" : ""}`}
                  title={entry.hint}
                  aria-pressed={mode === entry.id}
                  onClick={() => onModeChange(entry.id)}
                >
                  <AegisIcon name={entry.icon} size={12} />
                  {entry.label}
                </button>
              ))}
            </div>
            {model && <span className={`v3-composer__mode ${model.local ? "is-local" : "is-cloud"}`}>{model.local ? <Laptop size={11} /> : <Cloud size={11} />}{model.local ? "LOCAL" : "CLOUD"}</span>}
          </div>
        </div>

        <div className="v3-composer__meta">
          <span className="v3-composer__hint"><kbd>Entrée</kbd> envoyer · <kbd>Maj + Entrée</kbd> nouvelle ligne · <kbd>Ctrl+P</kbd> fichiers{attachedFiles.length > 0 ? ` · ${attachedFiles.length} fichier(s) attaché(s)` : ""}</span>
          <span className="v3-composer__context"><AegisIcon name="terminal" size={10} />Work Mode · agent local sur cette machine{modelHydrationStatus === "loading" && !model ? " · chargement des modèles…" : ""}</span>
        </div>
      </motion.div>
      {notice && (
        <div role="alert" className="v3-composer__error" data-tone={notice.tone ?? "info"}>
          <span><b>{notice.title}: </b>{notice.description}</span>
          <Button size="sm" variant="ghost" onClick={onDismissNotice}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}
