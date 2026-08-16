"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Cloud, Cpu, Laptop, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { useModelSelection } from "./model-selection-store";
import { hexToRgbTriplet, modelBrandColor, modelBrandSlug, providerSlug } from "./model-brand";

export function ModelSelector() {
  const [search, setSearch] = useState("");
  const { selectedModel: value, selectModel, models: availableModels, modelHydrationStatus } = useModelSelection();
  const models = useMemo(
    () => availableModels.filter((m) => `${m.name} ${m.providerName || ""}`.toLowerCase().includes(search.toLowerCase())),
    [availableModels, search]
  );

  const accent = value ? modelBrandColor(value) : "#e5342b";
  const accentRgb = hexToRgbTriplet(accent);
  const pillStyle = { "--pill-accent": accent, "--pill-accent-rgb": accentRgb } as React.CSSProperties;

  return (
    <Popover>
      <PopoverTrigger className="aegis-model-pill" style={pillStyle} aria-busy={modelHydrationStatus === "loading"}>
        <span className="aegis-model-pill__brand">
          {value ? (
            <ProviderIcon variant="color" provider={modelBrandSlug(value, providerSlug(value.providerKind || value.providerName || ""))} size={18} />
          ) : (
            <Cpu size={14} />
          )}
        </span>
        <span className="aegis-model-pill__copy">
          <b>{modelHydrationStatus === "loading" && !value ? "Loading models…" : value?.name || "Select a model"}</b>
          {value && <small>{value.providerName}</small>}
        </span>
        <ChevronDown size={13} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
      </PopoverTrigger>
      <PopoverContent align="end" className="aegis-model-pop" style={pillStyle} aria-label="Model selection">
        <div className="aegis-model-search">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models" aria-label="Search models" />
        </div>
        <div className="aegis-model-list scrollbar">
          {modelHydrationStatus === "loading" && <p style={{ padding: 12, color: "rgba(255,255,255,.55)", fontSize: 12 }}>Loading available models…</p>}
          {modelHydrationStatus !== "loading" && models.length === 0 && <p style={{ padding: 12, color: "rgba(255,255,255,.55)", fontSize: 12 }}>No connected models found.</p>}
          {models.map((model) => {
            const optAccent = modelBrandColor(model);
            const optRgb = hexToRgbTriplet(optAccent);
            const isActive = value?.id === model.id && value.providerId === model.providerId;
            return (
              <button
                type="button"
                key={`${model.providerId}:${model.id}`}
                data-active={isActive}
                className="aegis-model-option"
                style={{ "--opt-accent": optAccent, "--opt-accent-rgb": optRgb } as React.CSSProperties}
                onClick={() => selectModel(model)}
              >
                <ProviderIcon variant="color" provider={modelBrandSlug(model, providerSlug(model.providerKind || model.providerName || ""))} size={20} />
                <span>
                  <strong>{model.name}</strong>
                  <small>
                    {model.capabilities?.slice(0, 2).join(" · ") || model.type}
                    <b>{model.local ? <Laptop size={10} /> : <Cloud size={10} />} {model.providerName}</b>
                  </small>
                </span>
                {isActive && <Check size={15} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
