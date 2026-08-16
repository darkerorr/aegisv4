import { useMemo } from "react";
import { motion } from "framer-motion";
import { Bot, Cloud, HardDrive, RefreshCw, Search, Star } from "lucide-react";
import { AegisBadge, AegisButton, AegisCard, AegisEmptyState, AegisInput, AegisSkeleton, AegisStatus } from "../components/ui/AegisUI";
import { useModelStore, type ModelFilter } from "../features/models/modelStore";
import { useSidebar } from "../contexts/SidebarContext";

const FILTERS: Array<{ key: ModelFilter; label: string }> = [
  { key: "all", label: "All" }, { key: "local", label: "Local" }, { key: "online", label: "Online" },
  { key: "coding", label: "Coding" }, { key: "reasoning", label: "Reasoning" }, { key: "vision", label: "Vision" },
  { key: "tools", label: "Tools" }, { key: "free", label: "Free" }, { key: "favorites", label: "Favorites" },
];

function ModelCardSkeleton() {
  return (
    <AegisCard className="model-commercial-card" aria-hidden="true">
      <header>
        <AegisSkeleton width={27} height={27} />
        <div style={{ flex: 1 }}>
          <AegisSkeleton width="60%" height={13} />
          <AegisSkeleton width="40%" height={9} style={{ marginTop: 6 }} />
        </div>
        <AegisSkeleton width={30} height={30} />
      </header>
      <AegisSkeleton width="100%" height={36} style={{ marginTop: 14 }} />
      <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
        <AegisSkeleton width={48} height={20} />
        <AegisSkeleton width={56} height={20} />
        <AegisSkeleton width={42} height={20} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14, paddingBlock: 11, borderBlock: "1px solid var(--aegis-border)" }}>
        <AegisSkeleton width="70%" height={10} />
        <AegisSkeleton width="60%" height={10} />
        <AegisSkeleton width="65%" height={10} />
      </div>
      <AegisSkeleton width="100%" height={36} style={{ marginTop: 14 }} />
    </AegisCard>
  );
}

export function ModelsPage() {
  const { navigate } = useSidebar();
  const { models, loading, error, search, setSearch, filters, toggleFilter, favorites, toggleFavorite, selectModel, refresh } = useModelStore();
  const filtered = useMemo(() => models.filter((model) => {
    const query = search.trim().toLowerCase();
    if (query && !`${model.name} ${model.providerName ?? model.providerId} ${model.description ?? ""}`.toLowerCase().includes(query)) return false;
    if (filters.includes("local") && !model.local) return false;
    if (filters.includes("online") && model.local) return false;
    if (filters.includes("favorites") && !favorites.has(model.id)) return false;
    if (filters.includes("free") && !(model.local || model.pricing?.prompt === "0")) return false;
    for (const capability of ["coding", "reasoning", "vision", "tools"] as const) if (filters.includes(capability) && !(model.capabilities ?? []).includes(capability)) return false;
    return model.visible !== false;
  }), [favorites, filters, models, search]);

  return <motion.div className="models-page page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="section-heading"><div><p className="eyebrow">Unified catalog</p><h1>Models</h1><p className="muted">Search local and online models, inspect capabilities and choose the model used by the composer.</p></div><AegisButton onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</AegisButton></div>
    <div className="model-page-search"><Search size={16} /><AegisInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, provider or capability" /></div>
    <div className="model-page-filters">{FILTERS.map((filter) => <button key={filter.key} className={filters.includes(filter.key) ? "active" : ""} onClick={() => toggleFilter(filter.key)}>{filter.label}</button>)}</div>
    {error && <p className="aegis-alert aegis-alert-error">{error}</p>}
    {loading && !models.length ? <div className="model-commercial-grid">{Array.from({ length: 6 }).map((_, i) => <ModelCardSkeleton key={i} />)}</div> : !loading && !filtered.length ? <AegisEmptyState icon={<Bot size={23} />} title="No available models" description="Connect NVIDIA or OpenRouter, start Ollama, or load a model in LM Studio." action={<AegisButton variant="primary" onClick={() => navigate("Providers")}>Open providers</AegisButton>} /> : <div className="model-commercial-grid">{filtered.map((model) => <AegisCard key={model.id} raised className="model-commercial-card" tabIndex={0}>
      <header><span className={`model-provider-icon ${model.local ? "local" : "online"}`}>{model.local ? <HardDrive size={16} /> : <Cloud size={16} />}</span><div><h2>{model.name}</h2><p>{model.providerName ?? model.providerId}</p></div><button className={`model-favorite ${favorites.has(model.id) ? "active" : ""}`} onClick={() => toggleFavorite(model.id)} aria-label={favorites.has(model.id) ? "Remove from favorites" : "Add to favorites"}><Star size={15} fill={favorites.has(model.id) ? "currentColor" : "none"} /></button></header>
      <p className="model-description">{model.description || "Chat model available through this provider."}</p>
      <div className="model-capability-list">{(model.capabilities ?? ["chat"]).map((capability) => <AegisBadge key={capability} tone="neutral">{capability}</AegisBadge>)}</div>
      <dl><div><dt>Context</dt><dd>{model.contextLength ? `${Math.round(model.contextLength / 1000)}K` : "—"}</dd></div><div><dt>Location</dt><dd>{model.local ? "Local" : "Online"}</dd></div><div><dt>Status</dt><dd><AegisStatus tone={model.available === false ? "danger" : "success"} label={model.available === false ? "Unavailable" : "Available"} /></dd></div></dl>
      <footer><AegisButton variant="primary" onClick={() => { selectModel(model); navigate("Chat"); }}>Use in chat</AegisButton></footer>
    </AegisCard>)}</div>}
  </motion.div>;
}
