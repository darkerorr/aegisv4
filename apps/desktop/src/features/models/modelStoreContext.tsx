import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type ModelView, type ProviderView } from "../../api/client";
import { listLocalModels } from "../../api/local";
import { useAuth } from "../../contexts/AuthContext";
import {
  isDesktopRuntime,
  listProviderConnections,
  listProviderModels,
  refreshProviderModels,
  type ProviderConnection,
  type ProviderModel,
} from "../providers/providerClient";

export type ModelFilter = "all" | "local" | "online" | "coding" | "reasoning" | "vision" | "tools" | "free" | "favorites";

interface ModelStoreState {
  models: ModelView[];
  providers: ProviderView[];
  selectedModel: string;
  selectedProvider: ProviderView | null;
  favorites: Set<string>;
  recents: string[];
  cache: Record<string, ModelView[]>;
  loading: boolean;
  error: string | null;
  search: string;
  filters: ModelFilter[];
  setSearch: (value: string) => void;
  toggleFilter: (filter: ModelFilter) => void;
  toggleFavorite: (modelId: string) => void;
  selectModel: (model: ModelView) => void;
  setSelectedModel: (name: string) => void;
  setSelectedProvider: (provider: ProviderView | null) => void;
  setProviders: (providers: ProviderView[]) => void;
  setModels: (models: ModelView[]) => void;
  refresh: (connectionId?: string) => Promise<void>;
  ingestLocalConnection: (connection: ProviderConnection, models: ProviderModel[]) => void;
  removeLocalConnection: (connectionId: string) => void;
}

const ModelStoreContext = createContext<ModelStoreState | null>(null);
const FAVORITES_KEY = "aegis-model-favorites";
const RECENTS_KEY = "aegis-model-recents";
const SELECTION_KEY = "aegis-model-selection";
const CACHE_KEY = "aegis-model-cache";

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function providerView(connection: ProviderConnection): ProviderView {
  return {
    id: connection.connectionId,
    providerKey: connection.provider,
    kind: connection.provider,
    name: connection.displayName,
    baseUrl: connection.baseUrl,
    defaultModel: connection.defaultModel,
    active: connection.enabled,
    enabled: connection.enabled,
    hasApiKey: Boolean(connection.secretRef),
  };
}

function modelView(model: ProviderModel): ModelView {
  return {
    id: model.id,
    providerId: model.connectionId,
    providerName: model.providerName,
    providerKind: model.provider,
    name: model.name,
    description: model.description,
    type: "chat",
    active: model.available,
    local: model.location === "local",
    available: model.available,
    visible: true,
    capabilities: model.capabilities,
    contextLength: model.contextLength ?? undefined,
    pricing: model.pricing ?? undefined,
    recommended: model.recommended,
  };
}

export function ModelStoreProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [models, setModelsState] = useState<ModelView[]>(() => readJson(CACHE_KEY, []));
  const [providers, setProvidersState] = useState<ProviderView[]>([]);
  const initialSelection = readJson<{ model: string; providerId?: string }>(SELECTION_KEY, { model: "" });
  const [selectedModel, setSelectedModelState] = useState(initialSelection.model);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderView | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(readJson<string[]>(FAVORITES_KEY, [])));
  const [recents, setRecents] = useState<string[]>(() => readJson(RECENTS_KEY, []));
  const [cache, setCache] = useState<Record<string, ModelView[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ModelFilter[]>(["all"]);

  const applyRegistry = useCallback((nextProviders: ProviderView[], nextModels: ModelView[]) => {
    setProvidersState(nextProviders);
    setModelsState(nextModels);
    setCache(Object.fromEntries(nextProviders.map((provider) => [provider.id, nextModels.filter((model) => model.providerId === provider.id)])));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(nextModels)); } catch { /* cache is optional */ }
    const saved = readJson<{ model: string; providerId?: string }>(SELECTION_KEY, { model: "" });
    const preferred = nextModels.find((model) => model.name === saved.model && (!saved.providerId || model.providerId === saved.providerId))
      ?? nextModels.find((model) => model.favorite || model.recommended)
      ?? nextModels[0];
    if (preferred) {
      setSelectedModelState(preferred.name);
      setSelectedProviderState(nextProviders.find((provider) => provider.id === preferred.providerId) ?? null);
    } else {
      setSelectedProviderState(null);
      setSelectedModelState("");
    }
  }, []);

  const refresh = useCallback(async (connectionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (status === "authenticated") {
        const [{ providers: remoteProviders }, { models: remoteModels }] = await Promise.all([api.listProviders(), api.listModels()]);
        applyRegistry(remoteProviders, remoteModels.filter((model) => model.visible !== false && model.available !== false));
        return;
      }
      if (status !== "local") return;
      if (isDesktopRuntime()) {
        const connections = await listProviderConnections();
        if (connectionId) await refreshProviderModels(connectionId);
        const cachedModels = await listProviderModels();
        applyRegistry(connections.map(providerView), cachedModels.map(modelView));
        if (!connectionId) {
          const localConnections = connections.filter((connection) => connection.provider === "ollama" || connection.provider === "lm-studio");
          const refreshed = await Promise.allSettled(localConnections.map((connection) => refreshProviderModels(connection.connectionId)));
          const discovered = refreshed.flatMap((result) => result.status === "fulfilled" ? result.value : []);
          if (discovered.length) {
            const retained = cachedModels.filter((model) => !localConnections.some((connection) => connection.connectionId === model.connectionId));
            applyRegistry(connections.map(providerView), [...retained, ...discovered].map(modelView));
          }
        }
      } else {
        const [ollama, lmStudio] = await Promise.allSettled([listLocalModels("ollama"), listLocalModels("lm-studio")]);
        const browserProviders: ProviderView[] = [
          { id: "ollama-default", providerKey: "ollama", kind: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434", active: ollama.status === "fulfilled", hasApiKey: false },
          { id: "lm-studio-default", providerKey: "lm-studio", kind: "lm-studio", name: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", active: lmStudio.status === "fulfilled", hasApiKey: false },
        ];
        const browserModels = [
          ...(ollama.status === "fulfilled" ? ollama.value.map((name) => ({ id: `ollama-default:${name}`, providerId: "ollama-default", providerName: "Ollama", providerKind: "ollama", name, description: "Installed on this device", type: "chat", active: true, local: true, available: true, capabilities: ["chat"] })) : []),
          ...(lmStudio.status === "fulfilled" ? lmStudio.value.map((name) => ({ id: `lm-studio-default:${name}`, providerId: "lm-studio-default", providerName: "LM Studio", providerKind: "lm-studio", name, description: "Loaded in LM Studio", type: "chat", active: true, local: true, available: true, capabilities: ["chat"] })) : []),
        ] satisfies ModelView[];
        applyRegistry(browserProviders, browserModels);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Models could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applyRegistry, status]);

  useEffect(() => { if (status === "local" || status === "authenticated") void refresh(); }, [refresh, status]);

  const selectModel = useCallback((model: ModelView) => {
    const provider = providers.find((item) => item.id === model.providerId) ?? null;
    setSelectedModelState(model.name);
    setSelectedProviderState(provider);
    setRecents((previous) => {
      const next = [model.id, ...previous.filter((id) => id !== model.id)].slice(0, 8);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify({ model: model.name, providerId: model.providerId })); } catch { /* optional */ }
  }, [providers]);

  const setSelectedModel = useCallback((name: string) => {
    const model = models.find((item) => item.name === name && (!selectedProvider || item.providerId === selectedProvider.id)) ?? models.find((item) => item.name === name);
    if (model) selectModel(model);
    else setSelectedModelState(name);
  }, [models, selectModel, selectedProvider]);

  const setSelectedProvider = useCallback((provider: ProviderView | null) => {
    setSelectedProviderState(provider);
    if (provider) {
      const model = models.find((item) => item.providerId === provider.id && item.name === selectedModel) ?? models.find((item) => item.providerId === provider.id);
      if (model) selectModel(model);
    }
  }, [models, selectModel, selectedModel]);

  const toggleFavorite = useCallback((modelId: string) => {
    setFavorites((previous) => {
      const next = new Set(previous);
      if (next.has(modelId)) next.delete(modelId); else next.add(modelId);
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])); } catch { /* optional */ }
      return next;
    });
  }, []);

  const toggleFilter = useCallback((filter: ModelFilter) => {
    setFilters((previous) => filter === "all" ? ["all"] : previous.includes(filter) ? previous.filter((item) => item !== filter) : [...previous.filter((item) => item !== "all"), filter]);
  }, []);

  const ingestLocalConnection = useCallback((connection: ProviderConnection, providerModels: ProviderModel[]) => {
    const provider = providerView(connection);
    const mapped = providerModels.map(modelView);
    const nextProviders = [...providers.filter((item) => item.id !== provider.id), provider];
    const nextModels = [...models.filter((item) => item.providerId !== provider.id), ...mapped];
    applyRegistry(nextProviders, nextModels);
    const preferred = mapped.find((item) => item.recommended) ?? mapped[0];
    if (preferred) selectModel(preferred);
  }, [applyRegistry, models, providers, selectModel]);

  const removeLocalConnection = useCallback((connectionId: string) => {
    applyRegistry(providers.filter((provider) => provider.id !== connectionId), models.filter((model) => model.providerId !== connectionId));
  }, [applyRegistry, models, providers]);

  const value = useMemo<ModelStoreState>(() => ({
    models: models.map((model) => ({ ...model, favorite: favorites.has(model.id) })), providers, selectedModel, selectedProvider,
    favorites, recents, cache, loading, error, search, filters, setSearch, toggleFilter, toggleFavorite,
    selectModel, setSelectedModel, setSelectedProvider, setProviders: setProvidersState, setModels: setModelsState,
    refresh, ingestLocalConnection, removeLocalConnection,
  }), [cache, error, favorites, filters, ingestLocalConnection, loading, models, providers, recents, refresh, removeLocalConnection, search, selectModel, selectedModel, selectedProvider, setSelectedModel, setSelectedProvider, toggleFavorite, toggleFilter]);

  return <ModelStoreContext.Provider value={value}>{children}</ModelStoreContext.Provider>;
}

export function useModelStore(): ModelStoreState {
  const context = useContext(ModelStoreContext);
  if (!context) throw new Error("useModelStore must be used within ModelStoreProvider");
  return context;
}
