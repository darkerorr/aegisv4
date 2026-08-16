"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileCode2, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTypeIcon, fileLanguage } from "@/features/work/file-icon";
import { escapeHtml, highlightToHtml } from "@/features/work/syntax-highlight";

interface WorkFilePreviewProps {
  open: boolean;
  onClose: () => void;
  tabs: string[];
  activeFile: string;
  onOpenTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  dirty: boolean;
  content: string;
  onContent: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  onReject: () => void;
  loading: boolean;
  error: string | null;
  highlightRef: React.RefObject<HTMLPreElement | null>;
  syncHighlight: () => void;
  line: number;
  onLineChange: (line: number) => void;
  size?: number;
}

export function WorkFilePreview(props: WorkFilePreviewProps) {
  const { open, onClose, tabs, activeFile, onOpenTab, onCloseTab, dirty, content, onContent, onSave, saving, onReject, loading, error, highlightRef, syncHighlight, line, onLineChange, size } = props;
  const language = fileLanguage(activeFile);

  return (
    <AnimatePresence>
      {open && activeFile && (
        <>
          <motion.div
            className="work-preview__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.section
            className="work-preview"
            role="dialog"
            aria-label={`Aperçu de ${activeFile}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="work-preview__head">
              <div className="work-editor__tabs" role="tablist" aria-label="Fichiers ouverts">
                {tabs.map((path) => (
                  <button key={path} type="button" role="tab" aria-selected={path === activeFile} className={path === activeFile ? "is-active" : ""} onClick={() => onOpenTab(path)} title={path}>
                    <FileTypeIcon name={path} size={12} /><span>{path.split("/").pop()}</span>
                    <span className="work-editor__tab-close" role="button" aria-label={`Fermer ${path}`} onClick={(event) => { event.stopPropagation(); onCloseTab(path); }}>
                      <X size={10} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="work-preview__actions">
                <span className={`work-editor__language work-file-icon--${language}`}>{language}</span>
                {dirty ? <span className="work-editor__dirty">Non sauvegardé</span> : null}
                <Button size="sm" variant="secondary" disabled={!dirty} onClick={onReject} title="Abandonner les modifications locales"><Trash2 size={12} />Rejeter</Button>
                <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={onSave}><Save size={12} />{saving ? "Sauvegarde…" : "Sauvegarder"}</Button>
                <button type="button" className="work-preview__close" aria-label="Fermer l'aperçu" onClick={onClose}><X size={16} /></button>
              </div>
            </div>
            <div className="work-preview__body">
              {loading ? (
                <p className="work-empty" style={{ padding: "32px" }}>Lecture du fichier…</p>
              ) : error ? (
                <p className="work-empty" role="alert" style={{ padding: "32px" }}>{error}</p>
              ) : (
                <div className="work-editor" data-language={language}>
                  <div className="work-editor__gutter" aria-hidden="true">{content.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div>
                  <div className="work-editor__body">
                    <pre ref={highlightRef} className="work-editor__highlight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightToHtml(content, escapeHtml) }} />
                    <textarea
                      aria-label={`Éditer ${activeFile}`}
                      spellCheck={false}
                      value={content}
                      onChange={(event) => onContent(event.target.value)}
                      onScroll={syncHighlight}
                      onClick={(event) => onLineChange(event.currentTarget.value.slice(0, event.currentTarget.selectionStart).split("\n").length)}
                      onKeyUp={(event) => onLineChange(event.currentTarget.value.slice(0, event.currentTarget.selectionStart).split("\n").length)}
                      onKeyDown={(event) => {
                        if (event.key === "Tab") {
                          event.preventDefault();
                          const target = event.currentTarget;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          onContent(`${target.value.slice(0, start)}  ${target.value.slice(end)}`);
                          requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 2; });
                        }
                        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                          event.preventDefault();
                          if (dirty) onSave();
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="work-preview__status">
              <span><FileCode2 size={11} />{activeFile}</span>
              <span>Ln {line} · {language} · {size ?? 0} octets</span>
              <span className="work-preview__saved">{dirty ? <Check size={11} /> : null}{dirty ? "modifié" : "à jour"}</span>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}