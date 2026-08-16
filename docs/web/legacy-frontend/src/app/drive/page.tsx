"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { LoaderCircle, HardDrive, Search, RefreshCw, AlertTriangle, File, Loader } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";
import type { DriveFile, GoogleIntegration } from "@aegis/api-client";

function DriveContent() {
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [contentAvailable, setContentAvailable] = useState(false);

  const load = useCallback(async (signal?: AbortSignal, pageToken?: string) => {
    setBusy(true); setError("");
    try {
      const [intResult, fileResult] = await Promise.all([
        api<{ integration: GoogleIntegration }>("/integrations/google", { signal }),
        api<{ files: DriveFile[]; nextPageToken?: string; contentAvailable: boolean }>(`/integrations/google/drive/files?pageSize=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, { signal }),
      ]);
      if (!signal?.aborted) {
        setIntegration(intResult.integration);
        setFiles(pageToken ? [...files, ...fileResult.files] : fileResult.files);
        setNextToken(fileResult.nextPageToken);
        setContentAvailable(fileResult.contentAvailable);
      }
    } catch (err) { if (!signal?.aborted) setError(formatApiError(err)); }
    finally { if (!signal?.aborted) { setBusy(false); setLoading(false); } }
  }, []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, []);

  async function doSearch() {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const result = await api<{ files: DriveFile[]; nextPageToken?: string; contentAvailable: boolean }>(`/integrations/google/drive/search?q=${encodeURIComponent(search)}`);
      setFiles(result.files);
      setNextToken(result.nextPageToken);
      setContentAvailable(result.contentAvailable);
    } catch (err) { setError(formatApiError(err)); } finally { setBusy(false); }
  }

  function fileIcon(mimeType?: string) {
    if (mimeType?.includes("pdf")) return "📄";
    if (mimeType?.includes("image")) return "🖼️";
    if (mimeType?.includes("video")) return "🎬";
    if (mimeType?.includes("sheet") || mimeType?.includes("excel")) return "📊";
    if (mimeType?.includes("document") || mimeType?.includes("word")) return "📝";
    return "📁";
  }

  if (!integration?.configured) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="surface rounded-2xl p-8 text-center">
          <HardDrive size={48} className="mx-auto mb-4 text-[var(--aegis-text-muted)]" />
          <h2 className="text-xl font-semibold">Google not configured</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Connect Google Workspace to access Drive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Drive</p>
          <h1 className="mt-2 text-4xl font-semibold">Google Drive</h1>
          <p className="mt-3 text-sm text-[var(--aegis-text-muted)]">{integration?.account?.email || "Loading..."}</p>
        </div>
        <button onClick={() => void load()} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={16} className={`mr-2 inline ${busy ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      {!contentAvailable && (
        <div className="surface mt-6 rounded-2xl p-4 border-amber-400/20 bg-amber-400/5">
          <div className="flex items-center gap-3 text-sm text-amber-100">
            <AlertTriangle size={16} className="shrink-0" />
            <span>Additional Drive permission required to read file contents. Metadata is available.</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aegis-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }} className="control w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" placeholder="Search Drive..." />
        </div>
        <button onClick={doSearch} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Search</button>
      </div>

      {loading ? (
        <div className="mt-20 grid place-items-center text-[var(--aegis-text-muted)]"><LoaderCircle className="animate-spin" size={24} /></div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <a key={file.id} href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="surface rounded-xl p-4 transition hover:border-[var(--aegis-blue)]/30">
              <div className="text-2xl mb-2">{fileIcon(file.mimeType)}</div>
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="mt-1 text-xs text-[var(--aegis-text-muted)]">
                {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ""}
                {file.size ? ` · ${(file.size / 1024).toFixed(0)} KB` : ""}
              </p>
              {file.owners?.[0] && <p className="mt-1 text-xs text-[var(--aegis-text-muted)] truncate">{file.owners[0].displayName}</p>}
            </a>
          ))}
          {files.length === 0 && (
            <div className="col-span-full mt-10 grid place-items-center text-[var(--aegis-text-muted)]">
              <HardDrive size={40} className="mb-4 opacity-30" />
              <p className="text-sm">No files found.</p>
            </div>
          )}
        </div>
      )}
      {nextToken && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => void load(undefined, nextToken)} disabled={busy} className="rounded-xl border border-white/10 px-6 py-2.5 text-sm hover:bg-white/5">
            {busy ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DrivePage() {
  return <Protected><Suspense fallback={<div className="p-8 text-sm text-[var(--aegis-text-muted)]">Loading Drive...</div>}><DriveContent /></Suspense></Protected>;
}
