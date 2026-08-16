"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, File, FileText, Folder, Grid2X2, HardDrive, Image as ImageIcon, List, Search, ShieldCheck, Sheet, X } from "lucide-react";
import type { DriveFile } from "@aegis/api-client";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import { StatePanel } from "@/components/feedback/state-panel";
import { Skeleton } from "@/components/ui/skeleton";

function fileIcon(file: DriveFile) {
  const type = file.mimeType || "";
  if (type.includes("folder")) return { icon: Folder, color: "#e8e8e8" };
  if (type.includes("image")) return { icon: ImageIcon, color: "#cfcfcf" };
  if (type.includes("sheet")) return { icon: Sheet, color: "#e0e0e0" };
  if (type.includes("document") || type.includes("pdf")) return { icon: FileText, color: "#ffffff" };
  if (type.includes("presentation")) return { icon: FileText, color: "#c0c0c0" };
  return { icon: File, color: "var(--aegis-muted)" };
}

function fmtSize(size?: number | null) {
  if (size == null) return "";
  if (size >= 1e9) return `${(size / 1e9).toFixed(1)} GB`;
  if (size >= 1e6) return `${(size / 1e6).toFixed(1)} MB`;
  if (size >= 1e3) return `${Math.round(size / 1e3)} KB`;
  return `${size} B`;
}

export function DriveView() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<DriveFile>();
  const query = useQuery({ queryKey: queryKeys.drive, queryFn: () => api.listDriveFiles({ pageSize: 50 }) });
  const files = useMemo(() => (query.data?.files || []).filter((file) => file.name.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const totalSize = useMemo(() => files.reduce((acc, file) => acc + (file.size ?? 0), 0), [files]);

  if (query.isError) return <StatePanel state="permission" title="Drive unavailable" message={normalizeError(query.error).message} onRetry={() => query.refetch()} />;

  return (
    <div>
      <section className="aegis-page-hero">
        <div>
          <span className="page-kicker"><HardDrive size={12} />Google Drive</span>
          <h2>Your documents, inside the workspace.</h2>
          <p>Browse real Drive metadata with clear ownership, type and modified-time context.</p>
        </div>
        <div className="aegis-metric-row" style={{ gridTemplateColumns: "repeat(3,minmax(80px,1fr))" }}>
          <div className="aegis-metric"><b>{files.length}</b><span>visible files</span></div>
          <div className="aegis-metric"><b>{totalSize ? fmtSize(totalSize) : "—"}</b><span>total size</span></div>
          <div className="aegis-metric"><b><ShieldCheck size={12} /></b><span>scoped access</span></div>
        </div>
      </section>

      <div className="aegis-toolbar">
        <label className="aegis-toolbar-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Drive" />
        </label>
        <button className="aegis-pill-filter" data-active={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={14} />Grid</button>
        <button className="aegis-pill-filter" data-active={view === "list"} onClick={() => setView("list")}><List size={14} />List</button>
      </div>

      <div className="aegis-drive-layout">
        <div style={{ flex: 1, minWidth: 0 }}>
          {query.isLoading ? <div className="aegis-drive-grid">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div>
            : files.length === 0 ? <div className="empty-premium-state"><HardDrive size={34} /><h2>No Drive files</h2><p>No files match this view, or Drive has not returned metadata for this permission scope.</p></div>
            : view === "grid" ? (
              <motion.div className="aegis-drive-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.025 } } }}>
                {files.map((file) => {
                  const { icon: Icon, color } = fileIcon(file);
                  return (
                    <motion.article key={file.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="aegis-drive-file" data-selected={selected?.id === file.id} onClick={() => setSelected(file)}>
                      <span className="aegis-drive-icon" style={{ color }}>{<Icon size={18} />}</span>
                      <h3>{file.name}</h3>
                      <p>{file.owners[0]?.displayName || file.owners[0]?.emailAddress || "Unknown owner"}</p>
                      <p style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <time>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : "No date"}</time>
                        {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noreferrer" aria-label={`Open ${file.name}`} onClick={(e) => e.stopPropagation()}><ExternalLink size={14} style={{ color: "var(--aegis-faint)" }} /></a>}
                      </p>
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : (
              <div className="aegis-settings-stack">
                {files.map((file) => {
                  const { icon: Icon, color } = fileIcon(file);
                  return (
                    <button key={file.id} className="aegis-search-result" style={{ cursor: "pointer", textAlign: "left", width: "100%" }} data-selected={selected?.id === file.id} onClick={() => setSelected(file)}>
                      <span className="aegis-drive-icon" style={{ width: 30, height: 30, color }}>{<Icon size={15} />}</span>
                      <div><strong>{file.name}</strong><small>{file.owners[0]?.displayName || file.owners[0]?.emailAddress || "Unknown"} · {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : "No date"}{file.size != null ? ` · ${fmtSize(file.size)}` : ""}</small></div>
                      {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--aegis-faint)" }} aria-label={`Open ${file.name}`} onClick={(e) => e.stopPropagation()}><ExternalLink size={14} /></a>}
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {selected && (
          <motion.aside className="aegis-drive-preview" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <div className="aegis-drive-preview-head">
              <strong>Details</strong>
              <button type="button" className="v3-icon-btn" aria-label="Close preview" onClick={() => setSelected(undefined)}><X size={15} /></button>
            </div>
            <div className="aegis-drive-preview-body">
              {(() => {
                const { icon: PreviewIcon, color: previewColor } = fileIcon(selected);
                if (selected.thumbnailLink) {
                  // eslint-disable-next-line @next/next/no-img-element -- Drive thumbnail URLs are remote and dynamic.
                  return <img src={selected.thumbnailLink} alt="" className="aegis-drive-preview-thumb" />;
                }
                return <div className="aegis-drive-preview-icon"><PreviewIcon size={30} style={{ color: previewColor }} /></div>;
              })()}
              <h3>{selected.name}</h3>
              <dl className="aegis-drive-preview-meta">
                <div><dt>Type</dt><dd>{selected.mimeType?.split(".").pop() || "file"}</dd></div>
                <div><dt>Size</dt><dd>{fmtSize(selected.size) || "—"}</dd></div>
                <div><dt>Modified</dt><dd>{selected.modifiedTime ? new Date(selected.modifiedTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</dd></div>
                <div><dt>Owner</dt><dd>{selected.owners[0]?.displayName || selected.owners[0]?.emailAddress || "—"}</dd></div>
              </dl>
              {!selected.contentAvailable && selected.permissionMessage && (
                <p className="aegis-drive-permission"><ShieldCheck size={12} />{selected.permissionMessage}</p>
              )}
              {selected.webViewLink && (
                <a href={selected.webViewLink} target="_blank" rel="noreferrer" className="rb-btn rb-btn--primary" style={{ width: "100%" }}><ExternalLink size={14} />Open in Drive</a>
              )}
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}
