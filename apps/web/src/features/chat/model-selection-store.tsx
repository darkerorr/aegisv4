"use client";

import type { Model } from "@aegis/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { modelsApi } from "@/lib/api/models";
import { queryKeys } from "@/lib/query/keys";

type HydrationStatus = "loading" | "ready" | "unavailable";
type ModelSelectionState = {
  selectedModel: Model | null;
  selectedModelId: string | null;
  selectedProviderConnectionId: string | null;
  lastValidSelection: Model | null;
  defaultModelId: string | null;
  modelHydrationStatus: HydrationStatus;
  models: Model[];
  selectModel: (model: Model) => void;
};

const STORAGE_KEY = "aegis.chat.model-selection.v1";
const ModelSelectionContext = createContext<ModelSelectionState | null>(null);

function getPersistedModel(): Model | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as Model : null;
  } catch {
    return null;
  }
}

function sameSelection(left: Model | null, right: Model | null): boolean {
  return Boolean(left && right && left.id === right.id && left.providerId === right.providerId);
}

export function ModelSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<Model | null>(null);
  const selectionRef = useRef<Model | null>(null);
  const [lastValidSelection, setLastValidSelection] = useState<Model | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => modelsApi.list(),
    staleTime: 30_000,
  });

  const commitSelection = useCallback((model: Model | null, persist = true) => {
    selectionRef.current = model;
    setSelection(model);
    if (model) {
      setLastValidSelection(model);
      if (persist) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    } else if (persist) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const persisted = getPersistedModel();
    if (persisted) commitSelection(persisted, false);
    setHydrated(true);
  }, [commitSelection]);

  useEffect(() => {
    if (!query.data?.models) return;
    const available = query.data.models.filter((model) => model.available !== false);
    setModels(available);

    const current = selectionRef.current;
    const refreshed = current
      ? available.find((model) => model.id === current.id && model.providerId === current.providerId)
      : undefined;
    if (refreshed) {
      if (!sameSelection(selectionRef.current, refreshed) || selectionRef.current !== refreshed) commitSelection(refreshed);
      return;
    }

    // An empty refresh can be transient while providers reconnect. Preserve the
    // last valid choice so a simple refetch never silently deselects the model.
    if (current && available.length === 0) return;
    if (current && available.length > 0) {
      commitSelection(available[0]);
      return;
    }
    if (!current && available.length > 0) commitSelection(available[0]);
  }, [commitSelection, query.data]);

  const selectModel = useCallback((model: Model) => commitSelection(model), [commitSelection]);

  const value = useMemo<ModelSelectionState>(() => ({
    selectedModel: selection,
    selectedModelId: selection?.id ?? null,
    selectedProviderConnectionId: selection?.providerId ?? null,
    lastValidSelection,
    defaultModelId: models[0]?.id ?? null,
    modelHydrationStatus: !hydrated || query.isLoading ? "loading" : selection ? "ready" : "unavailable",
    models,
    selectModel,
  }), [hydrated, lastValidSelection, models, query.isLoading, selectModel, selection]);

  return <ModelSelectionContext.Provider value={value}>{children}</ModelSelectionContext.Provider>;
}

export function useModelSelection(): ModelSelectionState {
  const value = useContext(ModelSelectionContext);
  if (!value) throw new Error("useModelSelection must be used inside ModelSelectionProvider");
  return value;
}
