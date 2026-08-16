"use client";
import type { Model } from "@aegis/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioLines,
  BrainCircuit,
  Camera,
  Check,
  Coins,
  Cpu,
  Eye,
  Image as ImageIcon,
  Layers3,
  Laptop,
  Mic,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
  X,
} from "lucide-react";
import { modelsApi } from "@/lib/api/models";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { AegisIconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";

type ProviderFilter = "all" | "nvidia" | "openrouter" | "xai" | "ollama" | "lmstudio" | "other";
type CapFilter = "free" | "paid" | "local" | "cloud" | "vision" | "reasoning" | "tools" | "image" | "audio" | "streaming" | "favorite" | "available";

const providerFilters: Array<[ProviderFilter, string]> = [["all", "All"], ["openrouter", "OpenRouter"], ["nvidia", "NVIDIA"], ["xai", "xAI"], ["ollama", "Ollama"], ["lmstudio", "LM Studio"], ["other", "Other"]];
const capFilters: Array<[CapFilter, string]> = [["free", "Free"], ["paid", "Paid"], ["local", "Local"], ["cloud", "Cloud"], ["vision", "Vision"], ["reasoning", "Reasoning"], ["tools", "Tools"], ["image", "Image"], ["audio", "Audio"], ["streaming", "Streaming"], ["favorite", "Favorites"], ["available", "Available"]];

export function ModelsCatalog() {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [filters, setFilters] = useState<CapFilter[]>([]);
  const [family, setFamily] = useState<string>("all");
  const [detail, setDetail] = useState<Model | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.models, queryFn: () => modelsApi.list() });
  const refresh = useMutation({ mutationFn: () => modelsApi.refresh(), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.models }) });
  const toggleFavorite = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => modelsApi.update(id, { favorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.models }),
  });

  const families = useMemo(() => {
    const seen = new Set<string>();
    (query.data?.models ?? []).forEach((model) => { if (model.family) seen.add(model.family); });
    return ["all", ...Array.from(seen).sort()];
  }, [query.data]);

  const list = useMemo(() => {
    const source = query.data?.models ?? [];
    return source.filter((model) => {
      if (!matchesProvider(model, provider)) return false;
      if (family !== "all" && model.family !== family) return false;
      if (!filters.every((filter) => matchesFilter(model, filter))) return false;
      return `${model.name} ${model.providerName} ${model.family || ""}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [query.data, provider, filters, search, family]);

  const totals = useMemo(() => {
    const all = query.data?.models ?? [];
    return {
      total: all.length,
      free: all.filter((m) => m.local || m.free || (m.pricing && m.pricing.input === 0 && m.pricing.output === 0)).length,
      local: all.filter((m) => m.local).length,
      vision: all.filter((m) => m.capabilities?.includes("vision") || m.modalities?.input?.includes("image")).length,
      families: families.length - 1,
    };
  }, [query.data, families]);

  function toggleFilter(filter: CapFilter) {
    setFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  }

  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetail(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [detail]);

  if (query.isError) return <StatePanel state="error" title="Models unavailable" message={normalizeError(query.error).message} onRetry={() => query.refetch()} />;

  return (
    <div className="aegis-models">
      <motion.section className="v3-page-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
        <div>
          <span className="v3-kicker">Model library</span>
          <h2>The intelligence you can reach.</h2>
          <p>Browse every model discovered from your connected providers. Filter by price, modality and capability.</p>
        </div>
        <div className="v3-page-hero__stats">
          <span className="v3-page-hero__stat"><b>{totals.total}</b><small>models</small></span>
          <span className="v3-page-hero__stat"><b>{totals.free}</b><small>free tier</small></span>
          <span className="v3-page-hero__stat"><b>{totals.vision}</b><small>vision</small></span>
          <span className="v3-page-hero__stat"><b>{totals.families}</b><small>families</small></span>
        </div>
      </motion.section>

      <div className="v3-toolbar">
        <label className="v3-toolbar__search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models, providers, families…" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
        </label>
        {providerFilters.map(([value, label]) => (
          <button key={value} type="button" className="v3-toolbar__filter" data-active={provider === value} onClick={() => setProvider(value)}>{label}</button>
        ))}
        <span className="v3-toolbar__sep" />
        <label className="v3-toolbar__filter" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Layers3 size={12} />
          <select value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Filter by family" style={{ background: "transparent", border: 0, outline: "none", color: "inherit", fontSize: 11, cursor: "pointer" }}>
            {families.map((value) => <option key={value} value={value}>{value === "all" ? "All families" : value}</option>)}
          </select>
        </label>
        <span className="v3-toolbar__sep" />
        {capFilters.map(([value, label]) => (
          <button key={value} type="button" className="v3-toolbar__filter" data-active={filters.includes(value)} onClick={() => toggleFilter(value)}>{label}</button>
        ))}
        <AegisIconButton icon={RefreshCw} label="Refresh models" loading={refresh.isPending} onClick={() => refresh.mutate()} />
      </div>

      {query.isLoading ? (
        <div className="aegis-models__grid">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aegis-models__card-skeleton" />)}</div>
      ) : list.length === 0 ? (
        <StatePanel state="empty" title="No models match" message="Connect a provider or change the active filters." />
      ) : (
        <motion.div className="aegis-models__grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <AnimatePresence mode="popLayout">
            {list.map((model, index) => (
              <motion.article
                key={`${model.providerId}:${model.id}`}
                className="aegis-model-card"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.3), ease: "easeOut" }}
                onClick={() => setDetail(model)}
              >
                <header className="aegis-model-card__head">
                  <span className="aegis-model-card__logo"><ProviderIcon provider={providerSlug(model.providerKind || model.providerName || "")} size={20} /></span>
                  <div className="aegis-model-card__badges">
                    {model.local && <em className="is-local"><Laptop size={10} />Local</em>}
                    {!model.local && <em className="is-cloud"><Cpu size={10} />Cloud</em>}
                    {model.free === true || (model.pricing && model.pricing.input === 0 && model.pricing.output === 0) ? <em className="is-free">Free</em> : null}
                  </div>
                  <button
                    type="button"
                    className={`aegis-model-card__star ${model.favorite ? "is-fav" : ""}`}
                    aria-pressed={model.favorite}
                    aria-label={model.favorite ? `Remove ${model.name} from favorites` : `Add ${model.name} to favorites`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate({ id: model.id, favorite: !model.favorite }); }}
                  >
                    <Star size={13} fill={model.favorite ? "currentColor" : "none"} />
                  </button>
                </header>
                <h3 className="aegis-model-card__name">{model.name}</h3>
                <p className="aegis-model-card__provider">{model.providerName || model.providerKind}{model.family ? <em className="aegis-model-card__family">{model.family}</em> : null}</p>
                {model.available !== false && <span className="aegis-model-card__avail"><Check size={11} />Available</span>}
                <div className="aegis-model-card__meta">
                  <span title="Context length"><Layers3 size={12} />{model.contextLength ? `${formatTokens(model.contextLength)}` : "—"}</span>
                  <span title="Vision"><Eye size={12} />{hasCapability(model, "vision") ? "Yes" : "No"}</span>
                  <span title="Reasoning"><BrainCircuit size={12} />{hasCapability(model, "reasoning") ? "Yes" : "No"}</span>
                  <span title="Tools"><Wrench size={12} />{hasCapability(model, "tools") ? "Yes" : "No"}</span>
                  <span title="Image output"><ImageIcon size={12} />{hasCapability(model, "image") ? "Yes" : "No"}</span>
                  <span title="Audio"><AudioLines size={12} />{hasCapability(model, "audio") ? "Yes" : "No"}</span>
                </div>
                <footer className="aegis-model-card__foot">
                  <span className="aegis-model-card__price"><Coins size={12} />{pricingShort(model)}</span>
                  <span className="aegis-model-card__cta">Details <span>→</span></span>
                </footer>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {detail && (
          <motion.div className="aegis-model-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="aegis-model-modal__backdrop" onClick={() => setDetail(null)} />
            <motion.div ref={modalRef} className="aegis-model-modal__card" tabIndex={-1} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.26, ease: "easeOut" }} role="dialog" aria-modal="true" aria-label={detail.name}>
              <header>
                <span className="aegis-model-card__logo"><ProviderIcon provider={providerSlug(detail.providerKind || detail.providerName || "")} size={24} /></span>
                <div><h3>{detail.name}</h3><p>{detail.providerName || detail.providerKind}{detail.family ? ` · ${detail.family}` : ""}</p></div>
                <button type="button" className="aegis-model-modal__close" onClick={() => setDetail(null)} aria-label="Close"><X size={16} /></button>
              </header>
              <div className="aegis-model-modal__badges">
                {detail.local && <span className="is-local"><Laptop size={11} />Local</span>}
                {!detail.local && <span className="is-cloud"><Cpu size={11} />Cloud</span>}
                {detail.free === true && <span className="is-free">Free</span>}
                {detail.available !== false && <span className="is-ready"><Check size={11} />Available</span>}
              </div>
              <div className="aegis-model-modal__grid">
                <InfoRow icon={Layers3} label="Context" value={detail.contextLength ? formatTokens(detail.contextLength) : "Unknown"} />
                <InfoRow icon={Camera} label="Vision" value={hasCapability(detail, "vision") ? "Supported" : "No"} />
                <InfoRow icon={BrainCircuit} label="Reasoning" value={hasCapability(detail, "reasoning") ? "Supported" : "No"} />
                <InfoRow icon={Wrench} label="Tools" value={hasCapability(detail, "tools") ? "Supported" : "No"} />
                <InfoRow icon={ImageIcon} label="Images" value={hasCapability(detail, "image") ? "Output" : "No"} />
                <InfoRow icon={Mic} label="Audio" value={hasCapability(detail, "audio") ? "Supported" : "No"} />
                <InfoRow icon={ShieldCheck} label="Type" value={detail.type} />
                <InfoRow icon={Coins} label="Pricing" value={pricingShort(detail)} />
                {detail.pricing && (detail.pricing.input !== undefined || detail.pricing.output !== undefined) && (
                  <div className="aegis-model-modal__pricing">
                    <span className="aegis-model-modal__price"><small>Input</small><b>${money(detail.pricing.input ?? 0)}</b></span>
                    <span className="aegis-model-modal__price"><small>Output</small><b>${money(detail.pricing.output ?? 0)}</b></span>
                    <span className="aegis-model-modal__price"><small>Cached in</small><b>{detail.pricing.cachedInput !== undefined ? `$${money(detail.pricing.cachedInput)}` : "—"}</b></span>
                    <span className="aegis-model-modal__price"><small>Request</small><b>{detail.pricing.request !== undefined ? `$${money(detail.pricing.request)}` : "—"}</b></span>
                  </div>
                )}
              </div>
              <footer className="aegis-model-modal__foot">
                <span><Sparkles size={13} />{detail.capabilities?.slice(0, 4).join(" · ") || detail.type}</span>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: string }) {
  return <div className="aegis-model-modal__row"><span><Icon size={14} />{label}</span><b>{value}</b></div>;
}

function hasCapability(model: Model, cap: string): boolean {
  if (model.capabilities?.includes(cap)) return true;
  if (cap === "vision" && model.modalities?.input?.includes("image")) return true;
  if (cap === "audio" && (model.modalities?.input?.includes("audio") || model.modalities?.output?.includes("audio"))) return true;
  if (cap === "image" && model.modalities?.output?.includes("image")) return true;
  if (cap === "streaming") return true;
  return false;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function pricingShort(model: Model): string {
  if (model.local) return "Local";
  if (!model.pricing) return "—";
  const input = model.pricing.input ?? 0;
  const output = model.pricing.output ?? 0;
  if (input === 0 && output === 0) return "Free tier";
  return `$${money(input)} / $${money(output)}`;
}

function money(value: number): string {
  return value < 0.01 ? value.toFixed(4) : value.toFixed(2);
}

function providerSlug(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("nvidia")) return "nvidia";
  if (v.includes("openrouter")) return "openrouter";
  if (v.includes("x-ai") || v.includes("xai") || v.includes("grok")) return "xai";
  if (v.includes("ollama")) return "ollama";
  if (v.includes("studio")) return "lmstudio";
  return v.replace(/[^a-z]/g, "");
}

function matchesProvider(model: Model, filter: ProviderFilter): boolean {
  if (filter === "all") return true;
  const kind = (model.providerKind || model.providerName || "").toLowerCase();
  if (filter === "other") return !["nvidia", "openrouter", "x-ai", "xai", "grok", "ollama", "lmstudio", "lm-studio"].some((value) => kind.includes(value));
  if (filter === "lmstudio") return kind.includes("lmstudio") || kind.includes("lm-studio");
  if (filter === "xai") return kind.includes("x-ai") || kind.includes("xai") || kind.includes("grok");
  return kind.includes(filter);
}

function matchesFilter(model: Model, filter: CapFilter): boolean {
  if (filter === "free") return model.local || model.free === true || Boolean(model.pricing && model.pricing.input === 0 && model.pricing.output === 0);
  if (filter === "paid") return !model.local && Boolean(model.pricing && (model.pricing.input || model.pricing.output));
  if (filter === "local") return model.local;
  if (filter === "cloud") return !model.local;
  if (filter === "favorite") return model.favorite;
  if (filter === "available") return model.available !== false;
  return hasCapability(model, filter);
}
