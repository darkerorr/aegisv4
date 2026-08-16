"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, Cable, CircleCheck, Database, ExternalLink, GitBranch, LoaderCircle, Lock, Search, ShieldCheck, Star, Unplug } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { StatePanel } from "@/components/feedback/state-panel";
import { integrationsApi } from "@/lib/api/integrations";
import { normalizeError } from "@/lib/api/errors";

export default function GitHubPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all");
  const status = useQuery({ queryKey: ["github-status"], queryFn: () => integrationsApi.githubStatus(), retry: false });
  const connected = status.data?.status === "connected";
  const connect = useMutation({ mutationFn: () => integrationsApi.githubConnect(), onSuccess: (data) => { window.location.assign(data.authorizationUrl); } });
  const test = useMutation({ mutationFn: () => integrationsApi.githubTest(), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["github-status"] }) });
  const repos = useQuery({ queryKey: ["github-repos"], queryFn: () => integrationsApi.githubRepositories(), enabled: connected, retry: false });
  const filtered = useMemo(() => (repos.data?.repositories || []).filter((repo) => {
    const matchesSearch = !search.trim() || `${repo.fullName} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesVisibility = visibility === "all" || (visibility === "private" ? repo.private : !repo.private);
    return matchesSearch && matchesVisibility;
  }), [repos.data?.repositories, search, visibility]);

  const shell = (children: React.ReactNode) => <WorkspacePage title="GitHub" description="Repositories, branches, commits, issues and pull requests." icon={GitBranch}>{children}</WorkspacePage>;
  if (status.isLoading) return shell(<StatePanel state="loading" title="Loading…" message="Checking GitHub connection status." />);
  if (status.isError) return shell(<StatePanel state="error" title="Unable to check GitHub connection." message={normalizeError(status.error).message} onRetry={() => status.refetch()} retryLabel="Retry" />);
  if (status.data?.configured === false) return shell(<StatePanel state="offline" title="GitHub is not configured" message="Add a new GitHub Client Secret and the remaining GitHub App settings to the canonical root .env, then restart Aegis." />);

  const account = status.data?.account;
  const revoked = status.data?.status === "revoked";
  const actionError = connect.error || test.error;
  return shell(
    <div className="aegis-settings-stack">
      <section className="aegis-page-hero">
        <div>
          <span className="page-kicker"><GitBranch size={12} />GitHub App</span>
          <h2>{connected ? "Connected to GitHub" : revoked ? "Installation revoked" : "Connect your repositories"}</h2>
          <p>{connected ? `Connected as ${account?.login || "GitHub account"} with ${account?.repositoryCount || 0} accessible repositories.` : revoked ? "Reconnect the GitHub App to restore repository access." : "Connect the Aegis GitHub App to inspect repositories, issues and pull requests."}</p>
        </div>
        <span className={`aegis-provider-status`} data-state={connected ? "connected" : revoked ? "error" : "disabled"}>
          {connected ? <CircleCheck size={12} /> : <Unplug size={12} />} {connected ? "Connected" : revoked ? "Revoked" : "Not connected"}
        </span>
      </section>

      {connected && account && (
        <div className="aegis-metric-row">
          <div className="aegis-metric"><b>{account.repositoryCount}</b><span><Database size={11} />Repositories</span></div>
          <div className="aegis-metric"><b>{account.login}</b><span><BookOpen size={11} />Installation</span></div>
          <div className="aegis-metric"><b>{account.permissions.contents || "—"}</b><span><ShieldCheck size={11} />Contents</span></div>
          <div className="aegis-metric"><b>{account.permissions.issues || "—"}</b><span><ShieldCheck size={11} />Issues & PRs</span></div>
        </div>
      )}

      <div className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {connected ? <>
          <button className="aegis-btn" onClick={() => repos.refetch()} disabled={repos.isFetching}><Database size={14} />Refresh repositories</button>
          <button className="aegis-btn" onClick={() => test.mutate()} disabled={test.isPending}><ShieldCheck size={14} />Test connection</button>
          <a href="https://github.com/settings/installations" target="_blank" rel="noopener noreferrer" className="aegis-btn"><ExternalLink size={14} />Manage repositories</a>
        </> : <button className="aegis-btn aegis-btn--primary" onClick={() => connect.mutate()} disabled={connect.isPending}>
          {connect.isPending ? <LoaderCircle size={14} className="spin" /> : <Cable size={14} />} {revoked ? "Reconnect GitHub" : "Connect GitHub"}
        </button>}
      </div>
      {actionError && <p role="alert" className="form-error">{normalizeError(actionError).message}</p>}

      {connected && (
        <>
          <div className="aegis-toolbar">
            <label className="aegis-toolbar-search">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories" />
            </label>
            <button className="aegis-pill-filter" data-active={visibility === "all"} onClick={() => setVisibility("all")}>All</button>
            <button className="aegis-pill-filter" data-active={visibility === "public"} onClick={() => setVisibility("public")}>Public</button>
            <button className="aegis-pill-filter" data-active={visibility === "private"} onClick={() => setVisibility("private")}><Lock size={12} />Private</button>
          </div>
          {repos.isLoading ? <div className="aegis-cards-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aegis-shimmer" style={{ height: 130, borderRadius: 16 }} />)}</div>
            : repos.isError ? <StatePanel state="error" title="Repositories unavailable" message={normalizeError(repos.error).message} onRetry={() => repos.refetch()} retryLabel="Retry" />
            : filtered.length === 0 ? <StatePanel state="empty" title="No repositories found" message={repos.data?.repositories.length ? "No repository matches these filters." : "The GitHub installation does not expose any repositories."} />
            : <motion.div className="aegis-cards-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
                {filtered.map((repo) => (
                  <motion.a key={repo.id} href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="aegis-card">
                    <header className="aegis-card-head">
                      <span className="aegis-square" style={{ width: 38, height: 38 }}><GitBranch size={18} /></span>
                      <span className="aegis-card-title">
                        <h2>{repo.name}</h2>
                        <p>{repo.fullName}</p>
                      </span>
                      <ExternalLink size={14} style={{ marginLeft: "auto", color: "var(--aegis-faint)", flex: "none" }} />
                    </header>
                    {repo.description && <p style={{ margin: 0, fontSize: 12, color: "var(--aegis-muted)", lineHeight: 1.55 }}>{repo.description}</p>}
                    <div className="aegis-model-badge-row">
                      <span className="aegis-chip">{repo.private ? <Lock size={10} /> : <Star size={10} />}{repo.private ? "Private" : "Public"}</span>
                      {repo.language && <span className="aegis-chip aegis-chip--blue">{repo.language}</span>}
                      <span className="aegis-chip">{repo.defaultBranch}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--aegis-faint)" }}>Updated {new Date(repo.updatedAt).toLocaleDateString()}</p>
                  </motion.a>
                ))}
              </motion.div>}
        </>
      )}
    </div>
  );
}
