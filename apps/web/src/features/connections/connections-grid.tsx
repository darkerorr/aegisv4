"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, Cable, CircleCheck, Database, ExternalLink, LoaderCircle, TriangleAlert, Unplug } from "lucide-react";
import { integrationsApi } from "@/lib/api/integrations";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import { IntegrationIcon, ProviderIcon } from "@/components/brand/provider-icon";
import { StatePanel } from "@/components/feedback/state-panel";

export function ConnectionsGrid() {
  const qc = useQueryClient();
  const googleQuery = useQuery({ queryKey: queryKeys.integrations, queryFn: () => integrationsApi.google(), staleTime: 30_000 });
  const githubQuery = useQuery({ queryKey: ["github-status"], queryFn: () => integrationsApi.githubStatus(), staleTime: 30_000, retry: false });
  const startGoogle = useMutation({ mutationFn: () => integrationsApi.startGoogle({ returnTarget: "web" }), onSuccess: (data) => { location.href = data.authorizationUrl; } });
  const disconnectGoogle = useMutation({ mutationFn: () => integrationsApi.disconnectGoogle(), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.integrations }) });
  const startGitHub = useMutation({ mutationFn: () => integrationsApi.githubConnect(), onSuccess: (data) => { location.href = data.authorizationUrl; } });
  const disconnectGitHub = useMutation({ mutationFn: () => integrationsApi.githubDisconnect(), onSuccess: () => qc.invalidateQueries({ queryKey: ["github-status"] }) });
  const testGitHub = useMutation({ mutationFn: () => integrationsApi.githubTest(), onSuccess: () => qc.invalidateQueries({ queryKey: ["github-status"] }) });
  if (googleQuery.isError) return <StatePanel state="error" title="Connections unavailable" message={normalizeError(googleQuery.error).message} onRetry={() => googleQuery.refetch()} />;
  const g = googleQuery.data?.integration;
  const googleConnected = g?.status === "connected";
  const gh = githubQuery.data;
  const githubConnected = gh?.status === "connected";

  const googleServices = ["gmail", "drive", "calendar"] as const;

  return (
    <motion.div className="aegis-cards-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
      <motion.article variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="aegis-card" style={{ gridColumn: "span 1" }}>
        <header className="aegis-card-head">
          <span className="aegis-square"><IntegrationIcon integration="google" size={24} variant="color" /></span>
          <span className="aegis-card-title">
            <h2>Google Workspace</h2>
            <p>Gmail, Drive, Calendar and Contacts under one explicit permission boundary.</p>
          </span>
        </header>
        <span className={`aegis-provider-status`} data-state={googleConnected ? "connected" : "disabled"} style={{ width: "fit-content" }}>
          {googleConnected ? <CircleCheck size={12} /> : <Unplug size={12} />} {g?.status?.replaceAll("_", " ") || "Checking"}
        </span>
        <div className="aegis-model-badge-row">
          {googleServices.map((service) => (
            <span key={service} className="aegis-chip" data-on={g?.services[service]?.available}>
              <IntegrationIcon integration={service} size={16} variant="color" />
              {service}
              <i className="aegis-dot" data-on={g?.services[service]?.available} style={{ width: 5, height: 5 }} />
            </span>
          ))}
        </div>
        {g && !g.configured && <div className="connection-warning"><TriangleAlert size={15} />Google OAuth is not configured on the Aegis API.</div>}
        <footer className="aegis-form-actions" style={{ justifyContent: "flex-start" }}>
          {googleConnected
            ? <button className="aegis-btn" onClick={() => disconnectGoogle.mutate()} disabled={disconnectGoogle.isPending}>{disconnectGoogle.isPending ? <LoaderCircle size={14} className="spin" /> : <Unplug size={14} />}Disconnect</button>
            : <button className="aegis-btn aegis-btn--primary" onClick={() => startGoogle.mutate()} disabled={startGoogle.isPending || g?.configured === false}>{startGoogle.isPending ? <LoaderCircle size={14} className="spin" /> : <Cable size={14} />}Connect Google</button>}
        </footer>
      </motion.article>

      <motion.article variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="aegis-card">
        <header className="aegis-card-head">
          <span className="aegis-square"><IntegrationIcon integration="github" size={24} variant="monochrome" /></span>
          <span className="aegis-card-title">
            <h2>GitHub</h2>
            <p>Repositories, files, issues and pull requests through the Aegis GitHub App.</p>
          </span>
        </header>
        <span className={`aegis-provider-status`} data-state={githubConnected ? "connected" : "disabled"} style={{ width: "fit-content" }}>
          {githubConnected ? <CircleCheck size={12} /> : <Unplug size={12} />} {gh?.status?.replaceAll("_", " ") || "Checking"}
        </span>
        {githubConnected && gh?.account && (
          <div className="aegis-model-badge-row">
            <span className="aegis-chip aegis-chip--blue"><Database size={10} />{gh.account.repositoryCount > 0 ? `${gh.account.repositoryCount} repos` : "All repos"}</span>
            <span className="aegis-chip aegis-chip--violet"><BookOpen size={10} />{gh.account.login}</span>
          </div>
        )}
        {githubQuery.isError && <div className="connection-warning"><TriangleAlert size={15} />Unable to check GitHub connection. Retry from the GitHub page.</div>}
        {gh && !gh.configured && <div className="connection-warning"><TriangleAlert size={15} />GitHub App is not configured. Add a new Client Secret to the canonical root .env.</div>}
        <footer className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {githubConnected
            ? <><button className="aegis-btn" onClick={() => testGitHub.mutate()} disabled={testGitHub.isPending}>{testGitHub.isPending ? <LoaderCircle size={14} className="spin" /> : <CircleCheck size={14} />}Test</button><a className="aegis-btn" href="https://github.com/settings/installations" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Manage repos</a><button className="aegis-btn" onClick={() => disconnectGitHub.mutate()} disabled={disconnectGitHub.isPending}><Unplug size={14} />Disconnect</button></>
            : <button className="aegis-btn aegis-btn--primary" onClick={() => startGitHub.mutate()} disabled={startGitHub.isPending || githubQuery.isError || gh?.configured === false}>{startGitHub.isPending ? <LoaderCircle size={14} className="spin" /> : <Cable size={14} />}{gh?.status === "revoked" ? "Reconnect GitHub" : "Connect GitHub"}</button>}
        </footer>
      </motion.article>

      {[["nvidia", "NVIDIA", "Cloud inference with discovered model availability."], ["openrouter", "OpenRouter", "A broad catalog through one provider connection."], ["xai", "xAI", "Grok models from the xAI console, same secure credential flow."]].map(([id, name, description]) => (
        <motion.article className="aegis-card" key={id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <header className="aegis-card-head">
            <span className="aegis-square"><ProviderIcon provider={id} size={24} variant="monochrome" /></span>
            <span className="aegis-card-title">
              <h2>{name}</h2>
              <p>{description}</p>
            </span>
          </header>
          <span className={`aegis-provider-status`} data-state="disabled" style={{ width: "fit-content" }}><Unplug size={12} />Managed in providers</span>
          <footer className="aegis-form-actions" style={{ justifyContent: "flex-start" }}>
            <a className="aegis-btn" href="/providers">Configure</a>
          </footer>
        </motion.article>
      ))}
    </motion.div>
  );
}
