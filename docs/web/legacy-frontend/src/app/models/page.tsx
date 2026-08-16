"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Cpu, Search, Star, Globe, Wifi, RefreshCw, ChevronDown } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api } from "../../lib/api";

type ModelInfo = { id: string; name: string; providerId: string; providerName?: string; providerKind?: string; local?: boolean; favorite?: boolean; visible?: boolean; available?: boolean; contextLength?: number; capabilities?: string[] };

function ModelsContent() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites" | "local">("all");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<{ models: ModelInfo[] }>("/models/refresh", { method: "POST", signal });
      if (!signal?.aborted) setModels(result.models);
    } catch { /* ignore */ } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function toggleFavorite(modelName: string) {
    try {
      const result = await api<{ model: ModelInfo }>(`/models/${encodeURIComponent(modelName)}`, { method: "PATCH", body: JSON.stringify({ favorite: true }) });
      setModels((prev) => prev.map((m) => m.name === modelName ? { ...m, favorite: !m.favorite } : m));
    } catch { /* ignore */ }
  }

  const filtered = models.filter((m) => {
    if (filter === "favorites" && !m.favorite) return false;
    if (filter === "local" && !m.local) return false;
    if (search && !`${m.name} ${m.providerName}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Models</p>
          <h1 className="mt-2 text-4xl font-semibold">Available Models</h1>
          <p className="mt-3 max-w-2xl text-[var(--aegis-text-muted)]">Browse and manage models from all connected providers.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/5 disabled:opacity-50"><RefreshCw size={16} className={`mr-2 inline ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aegis-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="control w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" placeholder="Search models..." />
        </div>
        <div className="flex gap-2">
          {(["all", "favorites", "local"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-2 text-xs transition ${filter === f ? "bg-[var(--aegis-blue)]/20 text-[var(--aegis-blue-light)]" : "text-[var(--aegis-text-muted)] hover:bg-white/5"}`}>
              {f === "all" ? "All" : f === "favorites" ? "Favorites" : "Local"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-20 grid place-items-center text-[var(--aegis-text-muted)]"><LoaderCircle className="animate-spin" size={24} /></div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((model) => (
            <div key={`${model.providerId}:${model.name}`} className="surface rounded-2xl p-4 transition hover:border-[var(--aegis-blue)]/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]">
                    {model.local ? <Wifi size={15} /> : <Globe size={15} />}
                  </span>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[180px]">{model.name}</p>
                    <p className="text-xs text-[var(--aegis-text-muted)]">{model.providerName}</p>
                  </div>
                </div>
                <button onClick={() => toggleFavorite(model.name)} className={`p-1 transition ${model.favorite ? "text-[var(--aegis-orange)]" : "text-[var(--aegis-text-muted)] hover:text-[var(--aegis-orange)]"}`} aria-label={model.favorite ? "Remove from favorites" : "Add to favorites"}>
                  <Star size={14} fill={model.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              {model.contextLength && <p className="mt-3 text-xs text-[var(--aegis-text-muted)]">Context: {(model.contextLength / 1000).toFixed(0)}K tokens</p>}
              {model.capabilities && model.capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {model.capabilities.slice(0, 4).map((cap) => (
                    <span key={cap} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--aegis-text-muted)]">{cap}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${model.available ? "bg-[var(--aegis-success)]" : "bg-red-400"}`} />
                <span className="text-xs text-[var(--aegis-text-muted)]">{model.available ? "Available" : "Unavailable"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="mt-20 grid place-items-center text-[var(--aegis-text-muted)]">
          <Cpu size={40} className="mb-4 opacity-30" />
          <p className="text-sm">No models found{search ? " matching your search" : ""}.</p>
        </div>
      )}
    </div>
  );
}

export default function ModelsPage() {
  return <Protected><ModelsContent /></Protected>;
}
