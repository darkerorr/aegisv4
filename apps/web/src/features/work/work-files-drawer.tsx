"use client";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, FolderPlus, LoaderCircle, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

export type WorkWorkspaceOption = { id: string; name: string; root: string };

interface WorkFilesDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  count: number;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
  searchValue: string;
  onSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  workspaces: WorkWorkspaceOption[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onAddWorkspace: (root: string) => void;
  addPending: boolean;
  addError: string | null;
  children: React.ReactNode;
}

export function WorkFilesDrawer({
  open, title, subtitle, count, loading, error, refreshing, onRefresh, onClose,
  searchValue, onSearch, searchRef, scrollRef,
  workspaces, activeWorkspaceId, onSelectWorkspace, onAddWorkspace, addPending, addError,
  children,
}: WorkFilesDrawerProps) {
  const [adding, setAdding] = useState(false);

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
            className="work-drawer work-drawer--files"
            aria-label="Workspace files"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="work-drawer__head">
              <div className="work-drawer__title">
                <FolderOpen size={15} />
                <div>
                  <strong>{title}</strong>
                  <span>{subtitle ?? `${count} entrées`}</span>
                </div>
              </div>
              <div className="work-drawer__actions">
                <button type="button" className="work-drawer__icon" title="Rafraîchir l'arborescence" onClick={onRefresh}>
                  <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
                </button>
                <button type="button" className="work-drawer__icon" title="Fermer" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="work-drawer__workspaces">
              {workspaces.length > 1 && (
                <select
                  className="work-drawer__select"
                  aria-label="Choisir un workspace"
                  value={activeWorkspaceId ?? ""}
                  onChange={(event) => onSelectWorkspace(event.target.value)}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name} · {workspace.root}
                    </option>
                  ))}
                </select>
              )}
              {adding ? (
                <form
                  className="work-drawer__add-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const root = String(event.currentTarget.root?.value ?? "").trim();
                    if (root) onAddWorkspace(root);
                  }}
                >
                  <input name="root" className="field" placeholder="C:\chemin\du\dossier" aria-label="Chemin du dossier" required />
                  <button type="submit" className="work-drawer__add-submit" disabled={addPending} title="Autoriser ce dossier">
                    {addPending ? <LoaderCircle size={13} className="spin" /> : <ShieldCheck size={13} />}
                  </button>
                  <button type="button" className="work-drawer__add-cancel" onClick={() => setAdding(false)} aria-label="Annuler">
                    <X size={14} />
                  </button>
                  {addError && <p role="alert" className="form-error">{addError}</p>}
                </form>
              ) : (
                <button type="button" className="work-drawer__add" onClick={() => setAdding(true)}>
                  <FolderPlus size={13} /> Ajouter un dossier
                </button>
              )}
            </div>

            <div className="work-drawer__search">
              <Search size={14} />
              <input
                ref={searchRef}
                aria-label="Rechercher des fichiers"
                placeholder="Rechercher dans le workspace… (Ctrl+P)"
                value={searchValue}
                onChange={(event) => onSearch(event.target.value)}
              />
            </div>
            <div className="work-drawer__body" ref={scrollRef}>
              {loading ? (
                <p className="work-empty" style={{ padding: "24px" }}>Chargement de l&apos;arborescence…</p>
              ) : error ? (
                <p className="work-empty" role="alert" style={{ padding: "24px" }}>{error}</p>
              ) : (
                children
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
