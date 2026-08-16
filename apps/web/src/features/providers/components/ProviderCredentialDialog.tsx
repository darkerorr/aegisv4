"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import type { ProviderConnectResult } from "@aegis/api-client";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeError } from "@/lib/api/errors";
import { providersApi } from "@/lib/api/providers";
import { cloudCatalogById, type CloudProviderId } from "../cloud-catalog";

export type CredentialDialogState = "idle" | "submitting" | "testing" | "discovering-models" | "success" | "invalid-key" | "network-error" | "provider-error";

const details = cloudCatalogById;

function stateMessage(state: CredentialDialogState) {
  if (state === "submitting") return "Preparing secure connection…";
  if (state === "testing") return "Testing API key…";
  if (state === "discovering-models") return "Discovering available models…";
  if (state === "success") return "Credential verified and models discovered.";
  return null;
}

export function ProviderCredentialDialog({ provider, open, onOpenChange, onConnected, configured = false }: {
  provider: CloudProviderId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (result: ProviderConnectResult) => void | Promise<void>;
  configured?: boolean;
}) {
  const info = useMemo(() => details.get(provider) ?? { name: "Provider", shortName: "Provider", description: "Connect this provider to Aegis.", baseUrl: "", keyUrl: "", keyPlaceholder: "…", brand: provider }, [provider]);
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [replace, setReplace] = useState(!configured);
  const [baseUrl, setBaseUrl] = useState<string>(info.baseUrl);
  const [displayName, setDisplayName] = useState<string>(info.name);
  const [timeoutMs, setTimeoutMs] = useState(15_000);
  const [state, setState] = useState<CredentialDialogState>("idle");
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setVisible(false);
      setAdvanced(false);
      setReplace(!configured);
      setState("idle");
      setError(null);
      submitting.current = false;
    }
  }, [configured, open]);

  useEffect(() => {
    setBaseUrl(info.baseUrl);
    setDisplayName(info.name);
  }, [info]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const secret = apiKey.trim();
    if (!secret || submitting.current) return;
    submitting.current = true;
    setError(null);
    setState("submitting");
    await Promise.resolve();
    setState("testing");
    const discoveryTimer = window.setTimeout(() => setState("discovering-models"), 450);
    try {
      const result = await providersApi.connect(provider, { apiKey: secret, displayName, baseUrl, timeoutMs });
      window.clearTimeout(discoveryTimer);
      setState("success");
      setApiKey("");
      await onConnected(result);
      onOpenChange(false);
    } catch (cause) {
      window.clearTimeout(discoveryTimer);
      const normalized = normalizeError(cause);
      if (normalized.code === "PROVIDER_AUTH_FAILED") setState("invalid-key");
      else if (["API_TIMEOUT", "PROVIDER_TIMEOUT", "API_UNREACHABLE"].includes(normalized.code)) setState("network-error");
      else setState("provider-error");
      const fallback = `${info.name} rejected this API key.`;
      setError(normalized.code === "PROVIDER_AUTH_FAILED" ? (normalized.message && normalized.message.includes("(") && normalized.message.includes(")") ? normalized.message : fallback) : normalized.message);
    } finally {
      submitting.current = false;
    }
  };

  const status = stateMessage(state);
  return <Dialog open={open} onOpenChange={(next) => { if (!submitting.current) onOpenChange(next); }}>
    <DialogContent title={info.name} description={info.description}>
      <div className="credential-dialog-brand"><ProviderIcon provider={info.brand} size={32} variant="color" /><span><ShieldCheck size={14} /> Encrypted by the Aegis API</span></div>
      {configured && !replace ? <div className="credential-replace"><CircleCheck size={25} /><h3>A credential is already configured.</h3><p>Aegis never sends the stored key back to this dialog.</p><div><Button type="button" variant="primary" onClick={() => setReplace(true)}>Replace API key</Button><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button></div></div> : <form className="credential-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor={`provider-key-${provider}`}>API key</label>
        <div className="credential-input"><KeyRound size={17} aria-hidden="true" /><Input id={`provider-key-${provider}`} type={visible ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" autoFocus spellCheck={false} placeholder={info.keyPlaceholder} aria-describedby={error ? "credential-error" : undefined} /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide API key" : "Show API key"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        <a className="credential-key-link" href={info.keyUrl} target="_blank" rel="noreferrer">Where can I create an API key? <ExternalLink size={14} /></a>
        <details className="credential-advanced" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}><summary>Advanced settings</summary><div><label>Base URL<Input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label><label>Connection name<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Timeout<Input type="number" min={1000} max={60000} step={1000} value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))} /><small>Milliseconds · 1,000–60,000</small></label></div></details>
        {status && <p className="credential-progress" role="status">{state === "success" ? <CircleCheck size={16} /> : <LoaderCircle className="spin" size={16} />}{status}</p>}
        {error && <p id="credential-error" className="credential-error" role="alert"><CircleX size={16} />{error}</p>}
        {state === "invalid-key" && provider === "x-ai" && <p className="credential-error credential-error--hint" role="alert">Keys created seconds ago can take about a minute to activate on xAI — try again in a moment.</p>}
        <Button type="submit" variant="primary" disabled={!apiKey.trim() || submitting.current}>{submitting.current ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} {submitting.current ? "Connecting…" : `Connect ${info.shortName}`}</Button>
      </form>}
    </DialogContent>
  </Dialog>;
}
