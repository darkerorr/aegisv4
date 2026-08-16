"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Command, ExternalLink, FileText, Github, HardDrive, Mail, MessageSquareText, Search, Sparkles, Webhook, X } from "lucide-react";
import { conversationsApi } from "@/lib/api/conversations";
import { api } from "@/lib/api/client";
import { integrationsApi } from "@/lib/api/integrations";
import { normalizeError } from "@/lib/api/errors";
import { StatePanel } from "@/components/feedback/state-panel";

const scopes = [
  ["Chats", MessageSquareText, "Conversation history"],
  ["Projects", FileText, "Project context"],
  ["GitHub", Github, "Repositories"],
  ["Gmail", Mail, "Messages and labels"],
  ["Drive", HardDrive, "Docs and files"],
  ["Web", Webhook, "Live public sources"],
] as const;

function externalDomain(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "external source"; }
}

export function SearchView() {
  const [q, setQ] = useState("");
  const debounced = q.trim().toLowerCase();
  const conversations = useQuery({
    queryKey: ["conversations-search", debounced],
    queryFn: () => conversationsApi.search(debounced).then((result) => result.conversations),
    enabled: debounced.length > 0,
    staleTime: 15_000,
  });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects(), staleTime: 30_000, enabled: debounced.length > 0 });
  const web = useQuery({
    queryKey: ["web-search", debounced],
    queryFn: () => api.webSearch({ query: q, maxResults: 4 }),
    enabled: debounced.length > 0,
    staleTime: 15_000,
  });
  const github = useQuery({
    queryKey: ["github-repos-search", debounced],
    queryFn: () => integrationsApi.githubRepositories().then((result) => result.repositories.filter((repo) => `${repo.fullName} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(debounced))),
    enabled: debounced.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const gmail = useQuery({
    queryKey: ["gmail-search", debounced],
    queryFn: () => api.searchGmail(q).then((result) => result.messages.slice(0, 4)),
    enabled: debounced.length > 0,
    retry: false,
    staleTime: 15_000,
  });
  const drive = useQuery({
    queryKey: ["drive-search", debounced],
    queryFn: () => api.searchDrive(q).then((result) => result.files.slice(0, 4)),
    enabled: debounced.length > 0,
    retry: false,
    staleTime: 15_000,
  });

  const matchedConversations = useMemo(
    () => conversations.data ?? [],
    [conversations.data]
  );
  const matchedProjects = useMemo(
    () => (projects.data?.projects || []).filter((project) => `${project.name} ${project.description || ""}`.toLowerCase().includes(debounced)),
    [projects.data, debounced]
  );

  const total = matchedConversations.length + matchedProjects.length + (web.data?.results.length ?? 0) + (github.data?.length ?? 0) + (gmail.data?.length ?? 0) + (drive.data?.length ?? 0);
  const loading = debounced.length > 0 && (conversations.isLoading || projects.isLoading || web.isLoading || github.isLoading || gmail.isLoading || drive.isLoading);

  if ((conversations.isError || projects.isError) && debounced.length > 0) return <StatePanel state="offline" title="Search unavailable" message={normalizeError(conversations.error || projects.error).message} onRetry={() => { void conversations.refetch(); void projects.refetch(); }} />;

  return (
    <div>
      <section className="aegis-page-hero">
        <div>
          <span className="page-kicker"><Sparkles size={12} />Global command search</span>
          <h2>Find work across Aegis.</h2>
          <p>Search conversation history, projects, connected tools and the live web from one command surface.</p>
        </div>
      </section>

      <label className="aegis-search-box">
        <Search size={20} />
        <input
          autoFocus
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape" && q) setQ(""); }}
          placeholder="Search chats, projects, GitHub, Gmail, Drive or the web"
        />
        <span className="aegis-search-box__kbd"><Command size={10} />K</span>
        {q && (
          <button type="button" className="aegis-search-box__clear" onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>
        )}
      </label>

      <AnimatePresence mode="wait">
      {!debounced ? (
        <motion.div
          key="scopes"
          className="aegis-scope-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {scopes.map(([label, Icon, copy], index) => (
            <motion.article
              key={label}
              className="aegis-scope-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.035, ease: "easeOut" }}
              whileHover={{ y: -3 }}
            >
              <Icon size={17} />
              <strong>{label}</strong>
              <span>{copy}</span>
            </motion.article>
          ))}
        </motion.div>
      ) : loading ? (
        <motion.div key="loading" className="aegis-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="aegis-search-result" aria-hidden="true"><span className="aegis-shimmer" style={{ width: 26, height: 26, borderRadius: 8, flex: "none" }} /><div style={{ flex: 1 }}><span className="aegis-shimmer" style={{ width: "55%", height: 11, display: "block", borderRadius: 6 }} /><span className="aegis-shimmer" style={{ width: "35%", height: 9, display: "block", borderRadius: 6, marginTop: 7 }} /></div></div>
          ))}
        </motion.div>
      ) : total === 0 ? (
        <motion.div key="empty" className="empty-premium-state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <Search size={34} />
          <h2>No results for &ldquo;{q}&rdquo;</h2>
          <p>Try a different phrase, or connect GitHub, Gmail and Drive from Connections to expand the searchable workspace.</p>
        </motion.div>
      ) : (
        <motion.div key="results" className="aegis-results" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
          <div className="aegis-results__count">{total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;</div>

          {matchedProjects.length > 0 && (
            <>
              <div className="aegis-results__group"><FileText size={12} />Projects</div>
              {matchedProjects.map((project) => (
                <motion.div key={project.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <Link href={`/projects/${project.id}`} className="aegis-search-result">
                    <FileText size={16} />
                    <div><strong>{project.name}</strong><small>Project · {project.conversationCount ?? 0} conversations</small></div>
                  </Link>
                </motion.div>
              ))}
            </>
          )}

          {matchedConversations.length > 0 && (
            <>
              <div className="aegis-results__group"><MessageSquareText size={12} />Conversations</div>
              {matchedConversations.map((item) => (
                <motion.div key={item.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <Link href={`/chat/${item.id}`} className="aegis-search-result">
                    <MessageSquareText size={16} />
                    <div><strong>{item.title}</strong><small>Conversation · {item.model}</small></div>
                  </Link>
                </motion.div>
              ))}
            </>
          )}

          {github.data && github.data.length > 0 && (
            <>
              <div className="aegis-results__group"><Github size={12} />GitHub</div>
              {github.data.map((repo) => (
                <motion.div key={repo.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="aegis-search-result">
                    <Github size={16} />
                    <div><strong>{repo.fullName}</strong><small>{repo.private ? "Private" : "Public"}{repo.language ? ` · ${repo.language}` : ""} · GitHub</small></div>
                    <ExternalLink size={13} className="aegis-search-result__open" />
                  </a>
                </motion.div>
              ))}
            </>
          )}

          {gmail.data && gmail.data.length > 0 && (
            <>
              <div className="aegis-results__group"><Mail size={12} />Gmail</div>
              {gmail.data.map((message) => (
                <motion.div key={message.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <Link href="/gmail" className="aegis-search-result">
                    <Mail size={16} />
                    <div><strong>{message.subject || "No subject"}</strong><small>{message.from} · Gmail</small></div>
                  </Link>
                </motion.div>
              ))}
            </>
          )}

          {drive.data && drive.data.length > 0 && (
            <>
              <div className="aegis-results__group"><HardDrive size={12} />Drive</div>
              {drive.data.map((file) => (
                <motion.div key={file.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <Link href="/drive" className="aegis-search-result">
                    <HardDrive size={16} />
                    <div><strong>{file.name}</strong><small>{file.owners[0]?.displayName || file.owners[0]?.emailAddress || "Unknown"} · Drive</small></div>
                  </Link>
                </motion.div>
              ))}
            </>
          )}

          {web.data && web.data.results.length > 0 && (
            <>
              <div className="aegis-results__group"><Webhook size={12} />Web</div>
              {web.data.results.map((result) => (
                <motion.div key={result.url} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="aegis-search-result">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(externalDomain(result.url))}&sz=32`} alt="" width={16} height={16} />
                    <div><strong>{result.title}</strong><small>{result.snippet.slice(0, 120)}{result.publishedAt ? ` · ${new Date(result.publishedAt).toLocaleDateString()}` : ""}</small></div>
                    <ExternalLink size={13} className="aegis-search-result__open" />
                  </a>
                </motion.div>
              ))}
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
