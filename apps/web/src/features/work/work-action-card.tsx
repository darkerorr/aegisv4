"use client";
import { Fragment, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Clock, Copy, LoaderCircle, Shield, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/features/work/file-icon";
import { diffHunks, diffStats } from "@/features/work/diff";
import { AegisIcon, iconForTool, type AegisIconName } from "@/components/aegis/aegis-icons";
import type { WorkAgentEvent } from "@aegis/api-client";

export type RunActivity =
  | { kind: "tool"; tool: string; state: "requested" | "running" | "done" | "failed"; detail?: string; command?: string; output?: { command: string; stdout: string; stderr: string; exitCode: number | null }; durationMs?: number }
  | { kind: "approval"; approvalId: string; action: Extract<WorkAgentEvent, { type: "agent.approval.required" }>["action"]; reason?: string; resolved?: boolean; approved?: boolean }
  | { kind: "file"; relativePath: string; action?: "create" | "edit" | "delete" | "move" | "copy"; patch?: NonNullable<Extract<WorkAgentEvent, { type: "agent.file.change" }>["patch"]> };

export function toolLabel(tool: string): string {
  switch (tool) {
    case "searchFiles":
      return "Analyser";
    case "readFile":
      return "Lire";
    case "editFile":
      return "Éditer";
    case "writeFile":
      return "Créer";
    case "deleteFile":
    case "deleteFolder":
      return "Supprimer";
    case "runCommand":
      return "Commande";
    case "listFiles":
      return "Lister";
    case "moveFile":
    case "copyFile":
      return "Déplacer";
    case "webSearch":
      return "Web research";
    default:
      return tool.replace(/File$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

export function toolGlyph(tool: string): AegisIconName {
  return iconForTool(tool);
}

function CommandOutput({ output, durationMs }: { output: NonNullable<Extract<RunActivity, { kind: "tool" }>["output"]>; durationMs?: number }) {
  const [copied, setCopied] = useState(false);
  const text = `$ ${output.command}\n${output.stdout}${output.stderr ? `\n${output.stderr}` : ""}`;
  return (
    <div className="work-action__command">
      <div className="work-action__command-meta">
        <span className={`work-action__exit ${output.exitCode === 0 ? "is-ok" : "is-fail"}`}>
          {output.exitCode === 0 ? <Check size={11} /> : <X size={11} />}exit {output.exitCode ?? "signal"}
        </span>
        {durationMs !== undefined && durationMs !== null && (
          <span className="work-action__dur"><Clock size={11} />{(durationMs / 1000).toFixed(2)}s</span>
        )}
        <button
          type="button"
          className="work-action__copy"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? "Copié" : "Copier"}
        </button>
      </div>
      <details className="work-action__output">
        <summary>
          <ChevronRight size={11} />
          Voir la sortie
        </summary>
        <pre><code>{text}</code></pre>
      </details>
    </div>
  );
}

interface WorkActionCardProps {
  item: RunActivity;
  onPreviewFile: (relativePath: string) => void;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  busy: boolean;
}

function FilePatch({ patch }: { patch: NonNullable<Extract<RunActivity, { kind: "file" }>["patch"]> }) {
  const hunks = useMemo(() => diffHunks(patch.before, patch.after), [patch.before, patch.after]);
  const stats = useMemo(() => diffStats(patch.before, patch.after), [patch.before, patch.after]);
  const totalLines = hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
  const [open, setOpen] = useState(totalLines <= 80);
  return (
    <div className="work-diff">
      <div className="work-diff__head">
        <span className={`work-diff__stats ${stats.adds ? "is-add" : ""}`}>+{stats.adds}</span>
        <span className={`work-diff__stats ${stats.dels ? "is-del" : ""}`}>−{stats.dels}</span>
        <button type="button" className="work-diff__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{open ? "Masquer le diff" : "Voir le diff"}
        </button>
      </div>
      {open && (
        <div className="work-diff__body">
          {hunks.map((hunk, hunkIndex) => (
            <Fragment key={hunkIndex}>
              <div className="work-diff__hunk">
                @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
              </div>
              {hunk.lines.map((line, lineIndex) => (
                <div key={lineIndex} className={`work-diff__line is-${line.type}`}>
                  <span className="work-diff__num">{line.oldLine ?? ""}</span>
                  <span className="work-diff__num work-diff__num--new">{line.newLine ?? ""}</span>
                  <span className="work-diff__mark">{line.type === "del" ? "−" : line.type === "add" ? "+" : " "}</span>
                  <code className="work-diff__text">{line.text || " "}</code>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkActionCard({ item, onPreviewFile, onApprove, onReject, busy }: WorkActionCardProps) {
  if (item.kind === "file") {
    const slashIndex = item.relativePath.lastIndexOf("/");
    const name = slashIndex === -1 ? item.relativePath : item.relativePath.slice(slashIndex + 1);
    const folder = slashIndex === -1 ? "" : item.relativePath.slice(0, slashIndex);
    const stats = item.patch ? diffStats(item.patch.before, item.patch.after) : { adds: 0, dels: 0 };
    return (
      <motion.div
        className="work-action work-action--file"
        data-action={item.action ?? "edit"}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="work-action__head">
          <span className="work-action__glyph"><AegisIcon name={item.action === "create" ? "create" : item.action === "delete" ? "delete" : item.action === "move" || item.action === "copy" ? "move" : "edit"} size={14} /></span>
          <FileTypeIcon name={item.relativePath} size={13} />
          <div className="work-action__meta">
            <strong className="work-action__path">{name}</strong>
            {folder && <code className="work-action__dir">{folder}</code>}
          </div>
          {(stats.adds > 0 || stats.dels > 0) && (
            <span className="work-action__stats">
              {stats.adds > 0 && <b className="is-add">+{stats.adds}</b>}
              {stats.dels > 0 && <b className="is-del">−{stats.dels}</b>}
            </span>
          )}
          <Button size="sm" variant="secondary" className="work-action__open" onClick={() => onPreviewFile(item.relativePath)}>
            Voir
          </Button>
        </div>
        {item.patch && <FilePatch patch={item.patch} />}
      </motion.div>
    );
  }

  if (item.kind === "approval") {
    return (
      <motion.div
        className={`work-approval ${item.resolved ? "is-resolved" : "is-pending"}`}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28 }}
      >
        <span className="work-approval__head">
          {item.resolved && item.approved ? <ShieldCheck size={13} /> : <Shield size={13} />}
          {item.resolved ? (item.approved ? "Approuvé" : "Refusé") : "Approbation requise"}
          {item.reason ? <em>— {item.reason}</em> : null}
        </span>
        <pre>{item.action.type === "terminal" ? item.action.command : item.action.type === "write" ? `WRITE ${item.action.relativePath}\n${item.action.summary ?? ""}` : `EDIT ${item.action.relativePath}`}</pre>
        {item.action.type !== "terminal" && item.action.patch ? (
          <details className="work-approval__review">
            <summary>Review diff</summary>
            <pre>{`--- ${item.action.patch.relativePath}\n${item.action.patch.before ? item.action.patch.before.split("\n").map((line) => `- ${line}`).join("\n") : "(new file)"}\n+++ ${item.action.patch.relativePath}\n${item.action.patch.after ? item.action.patch.after.split("\n").map((line) => `+ ${line}`).join("\n") : "(deleted)"}`}</pre>
          </details>
        ) : null}
        {item.resolved ? (
          <span className="work-approval__status" data-approved={item.approved}>{item.approved ? "Approved" : "Denied"}</span>
        ) : (
          <span className="work-approval__actions">
            <Button data-kind="approve" size="sm" disabled={busy} onClick={() => onApprove(item.approvalId)}><Check size={12} />Apply</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => onReject(item.approvalId)}><X size={12} />Reject</Button>
          </span>
        )}
      </motion.div>
    );
  }

  const state = item.state;
  return (
    <motion.div
      className={`work-action work-action--tool is-${state}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <span className="work-action__glyph" aria-hidden="true"><AegisIcon name={toolGlyph(item.tool)} size={14} /></span>
      <div className="work-action__body">
        <div className="work-action__line">
          <strong>{toolLabel(item.tool)}</strong>
          {item.detail && <code>{item.detail}</code>}
          {state === "running" && <LoaderCircle className="spin work-action__spinner" size={12} />}
          {state === "done" && <Check className="work-action__check" size={12} />}
          {state === "failed" && <X className="work-action__fail" size={12} />}
        </div>
        {state === "done" && item.command && item.output && (
          <CommandOutput output={item.output} durationMs={item.durationMs} />
        )}
      </div>
    </motion.div>
  );
}