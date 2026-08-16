import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Cloud, Code2, Eye, HardDrive, Search, Sparkles, Star, Wrench } from "lucide-react";
import type { ModelView } from "../../../api/client";
import { AegisBadge, AegisDropdown, AegisInput } from "../../../components/ui/AegisUI";
import { useModelStore, type ModelFilter } from "../modelStore";

const FILTERS: Array<{ key: ModelFilter; label: string }> = [
  { key: "all", label: "All" }, { key: "local", label: "Local" }, { key: "online", label: "Online" },
  { key: "coding", label: "Coding" }, { key: "reasoning", label: "Reasoning" }, { key: "vision", label: "Vision" },
  { key: "tools", label: "Tools" }, { key: "free", label: "Free" }, { key: "favorites", label: "Favorites" },
];

function matchesFilter(model: ModelView, filters: ModelFilter[], favorites: Set<string>): boolean {
  if (filters.includes("local") && !model.local) return false;
  if (filters.includes("online") && model.local) return false;
  if (filters.includes("favorites") && !favorites.has(model.id)) return false;
  if (filters.includes("free") && !(model.local || model.pricing?.prompt === "0")) return false;
  for (const capability of ["coding", "reasoning", "vision", "tools"] as const) {
    if (filters.includes(capability) && !(model.capabilities ?? []).some((value) => value.toLowerCase().includes(capability))) return false;
  }
  return true;
}

function ModelRow({ model, selected, active, onSelect, onHover }: { model: ModelView; selected: boolean; active: boolean; onSelect: () => void; onHover: () => void }) {
  return <button type="button" role="option" aria-selected={selected} className={`model-selector-row ${selected ? "selected" : ""} ${active ? "active" : ""}`} onClick={onSelect} onMouseEnter={onHover}>
    <span className={`model-provider-icon ${model.local ? "local" : "online"}`}>{model.local ? <HardDrive size={15} /> : <Cloud size={15} />}</span>
    <span className="model-row-copy"><strong>{model.name}</strong><small>{model.description || `${model.providerName ?? model.providerId} model`}</small><span>{model.providerName ?? model.providerId} · {model.local ? "Local" : "Online"}</span></span>
    <span className="model-row-capabilities">{model.capabilities?.includes("coding") && <Code2 size={13} />}{model.capabilities?.includes("vision") && <Eye size={13} />}{model.capabilities?.includes("tools") && <Wrench size={13} />}{model.favorite && <Star size={13} fill="currentColor" />}</span>
    <span className={`model-availability ${model.available === false ? "offline" : ""}`} aria-label={model.available === false ? "Unavailable" : "Available"} />
    {selected && <Check className="model-selected-check" size={15} />}
  </button>;
}

export function ModelSelector() {
  const { models, selectedModel, selectedProvider, selectModel, favorites, recents, search, setSearch, filters, toggleFilter, loading, error } = useModelStore();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((model) => model.visible !== false && model.available !== false)
      .filter((model) => !query || `${model.name} ${model.providerName ?? model.providerId} ${model.description ?? ""} ${(model.capabilities ?? []).join(" ")}`.toLowerCase().includes(query))
      .filter((model) => matchesFilter(model, filters, favorites));
  }, [favorites, filters, models, search]);

  const sections = useMemo(() => {
    const used = new Set<string>();
    const take = (items: ModelView[]) => items.filter((model) => !used.has(model.id) && (used.add(model.id), true));
    const recommended = take(filtered.filter((model) => model.recommended).slice(0, 6));
    const recent = take(recents.map((id) => filtered.find((model) => model.id === id)).filter(Boolean) as ModelView[]);
    const favorite = take(filtered.filter((model) => favorites.has(model.id)));
    const local = take(filtered.filter((model) => model.local));
    const online = take(filtered.filter((model) => !model.local));
    return [{ label: "Recommended", icon: <Sparkles size={12} />, items: recommended }, { label: "Recent", items: recent }, { label: "Favorites", icon: <Star size={12} />, items: favorite }, { label: "Local", items: local }, { label: "Online", items: online }].filter((section) => section.items.length);
  }, [favorites, filtered, recents]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const focus = window.setTimeout(() => searchRef.current?.focus(), 30);
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    return () => { window.clearTimeout(focus); document.removeEventListener("mousedown", onPointer); };
  }, [open]);

  useEffect(() => { setActiveIndex((current) => Math.min(current, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  function choose(model: ModelView) {
    selectModel(model);
    setOpen(false);
    setSearch("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(filtered.length - 1, index + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
    if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  }

  const virtualized = filtered.length > 80;
  const rowHeight = 62;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const end = Math.min(filtered.length, start + 12);

  return <div className="model-selector" ref={rootRef} onKeyDown={onKeyDown}>
    <button type="button" className="model-selector-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className={`model-provider-icon ${selectedProvider?.kind === "ollama" || selectedProvider?.kind === "lm-studio" || selectedProvider?.kind === "lmstudio" ? "local" : "online"}`}>{selectedProvider?.kind === "ollama" || selectedProvider?.kind === "lm-studio" || selectedProvider?.kind === "lmstudio" ? <HardDrive size={14} /> : <Cloud size={14} />}</span>
      <span><strong>{selectedModel || "Choose a model"}</strong>{selectedProvider && <small>{selectedProvider.name} · {selectedProvider.kind === "ollama" || selectedProvider.kind === "lm-studio" || selectedProvider.kind === "lmstudio" ? "Local" : "Online"}</small>}</span><ChevronDown size={14} />
    </button>
    <AegisDropdown open={open} className="model-selector-menu">
      <div className="model-selector-search"><Search size={15} /><AegisInput ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search models and providers" aria-label="Search models" /></div>
      <div className="model-selector-filters" aria-label="Model filters">{FILTERS.map((filter) => <button type="button" key={filter.key} className={filters.includes(filter.key) ? "active" : ""} onClick={() => toggleFilter(filter.key)}>{filter.label}</button>)}</div>
      <div className="model-selector-list" role="listbox" aria-label="Available models" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        {loading && <p className="model-selector-message">Refreshing models…</p>}
        {!loading && error && <p className="model-selector-message error">{error}</p>}
        {!loading && !filtered.length && <p className="model-selector-message">No available models match these filters.</p>}
        {virtualized ? <div style={{ height: filtered.length * rowHeight, position: "relative" }}><div style={{ position: "absolute", inset: `${start * rowHeight}px 0 auto` }}>{filtered.slice(start, end).map((model, offset) => <ModelRow key={model.id} model={model} selected={model.name === selectedModel && model.providerId === selectedProvider?.id} active={start + offset === activeIndex} onHover={() => setActiveIndex(start + offset)} onSelect={() => choose(model)} />)}</div></div> : sections.map((section) => <section key={section.label} className="model-selector-section"><h3>{section.icon}{section.label}</h3>{section.items.map((model) => { const index = filtered.findIndex((item) => item.id === model.id); return <ModelRow key={model.id} model={model} selected={model.name === selectedModel && model.providerId === selectedProvider?.id} active={index === activeIndex} onHover={() => setActiveIndex(index)} onSelect={() => choose(model)} />; })}</section>)}
      </div>
      <footer><AegisBadge tone="neutral">↑↓ Navigate</AegisBadge><AegisBadge tone="neutral">Enter Select</AegisBadge><AegisBadge tone="neutral">Esc Close</AegisBadge></footer>
    </AegisDropdown>
  </div>;
}
