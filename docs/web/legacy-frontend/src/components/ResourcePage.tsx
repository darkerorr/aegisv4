"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Protected } from "./Protected";

export function ResourcePage({ kind }: { kind: "models" | "providers" }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadResources() {
      try {
        const data = await api<{ models?: Array<Record<string, unknown>>; providers?: Array<Record<string, unknown>> }>(`/${kind}`, { signal: controller.signal });
        if (!controller.signal.aborted) setItems(kind === "models" ? data.models || [] : data.providers || []);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Request failed.");
      }
    }
    void loadResources();
    return () => controller.abort();
  }, [kind]);

  return <Protected><div className="mx-auto max-w-5xl"><p className="text-sm uppercase tracking-[.24em] text-cyan-200/70">Configuration</p><h1 className="mt-2 text-4xl font-semibold">{kind === "models" ? "Models" : "Providers"}</h1><p className="mt-3 text-slate-400">These are real resources returned by your Aegis API.</p>{error && <p className="mt-6 text-red-200">{error}</p>}{items.length === 0 && !error ? <div className="surface mt-8 rounded-xl p-8 text-sm text-slate-400">No {kind} are available yet. For local models, start Ollama and refresh this page.</div> : <div className="mt-8 grid gap-3 md:grid-cols-2">{items.map((item, index) => <div key={String(item.id || index)} className="surface rounded-xl p-5"><p className="font-semibold">{String(item.name || item.modelName || item.id)}</p><p className="mt-2 text-sm text-slate-400">{String(item.kind || item.providerId || "Configured resource")}</p></div>)}</div>}</div></Protected>;
}
