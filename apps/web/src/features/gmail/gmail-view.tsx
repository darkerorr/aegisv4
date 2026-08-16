"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Archive, Inbox, Mail, Paperclip, PenLine, Reply, Search, Send, Star, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import { StatePanel } from "@/components/feedback/state-panel";
import { Skeleton } from "@/components/ui/skeleton";

const folders = [
  ["Inbox", Inbox],
  ["Unread", Mail],
  ["Starred", Star],
  ["Sent", Send],
  ["Archive", Archive],
] as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = () => {
    if (!to.trim()) return;
    const mailto = `mailto:${encodeURIComponent(to.trim())}?${new URLSearchParams({ subject, body }).toString()}`;
    window.location.href = mailto;
    onClose();
  };

  return (
    <div className="rb-modal" role="dialog" aria-modal="true" aria-label="Compose email">
      <button type="button" className="rb-modal__scrim" aria-label="Close" onClick={onClose} />
      <motion.div className="rb-modal__card rb-modal__card--wide" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
        <header className="rb-modal__head">
          <strong>Compose</strong>
          <button type="button" className="v3-icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="rb-modal__body">
          <label className="rb-field"><span>To</span><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="recipient@example.com" autoFocus /></label>
          <label className="rb-field"><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" /></label>
          <label className="rb-field"><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your message…" rows={8} /></label>
          <p className="rb-field-note">Sends through your default mail app (mailto). Send API is not exposed by the backend.</p>
        </div>
        <footer className="rb-modal__foot">
          <span style={{ flex: 1 }} />
          <button type="button" className="rb-btn rb-btn--ghost" onClick={onClose}>Discard</button>
          <button type="button" className="rb-btn rb-btn--primary" disabled={!to.trim()} onClick={send}><Send size={14} />Send</button>
        </footer>
      </motion.div>
    </div>
  );
}

export function GmailView() {
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("Inbox");
  const [selectedId, setSelectedId] = useState<string>();
  const [composing, setComposing] = useState(false);
  const query = useQuery({ queryKey: queryKeys.gmail, queryFn: () => api.listGmailMessages({ maxResults: 40 }) });
  const detail = useQuery({
    queryKey: ["gmail-thread", selectedId],
    queryFn: () => api.getGmailThread(selectedId!).then((result) => result.thread.messages),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
  });

  const list = useMemo(() => {
    const all = query.data?.messages || [];
    let filtered = all;
    if (folder === "Unread") filtered = all.filter((m) => m.unread);
    if (folder === "Starred") filtered = all.filter((m) => m.labels.includes("STARRED"));
    if (folder === "Sent") filtered = all.filter((m) => m.labels.includes("SENT"));
    if (search.trim()) filtered = filtered.filter((m) => `${m.from} ${m.subject} ${m.snippet}`.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  }, [query.data, search, folder]);

  if (query.isError) { const error = normalizeError(query.error); return <StatePanel state={error.code.includes("SCOPE") ? "permission" : "offline"} title="Gmail unavailable" message={error.message} onRetry={() => query.refetch()} />; }

  const thread = detail.data ?? null;
  const unreadCount = query.data?.messages.filter((m) => m.unread).length ?? 0;

  return (
    <div>
      <section className="aegis-page-hero">
        <div>
          <span className="page-kicker"><Mail size={12} />Gmail</span>
          <h2>Mail triage for connected work.</h2>
          <p>Search real messages, inspect full threads and keep attachments visible without leaving Aegis.</p>
        </div>
        <button className="aegis-btn aegis-btn--primary" onClick={() => setComposing(true)}><PenLine size={15} />Compose</button>
      </section>

      <div className="aegis-mail-layout">
        <aside className="aegis-mail-folders">
          <h4>Mailboxes</h4>
          {folders.map(([label, Icon]) => (
            <button key={label} className="aegis-mail-folder" data-active={folder === label} onClick={() => setFolder(label)}>
              <Icon size={15} />{label}
              {label === "Inbox" && unreadCount > 0 && <em className="aegis-mail-count">{unreadCount}</em>}
            </button>
          ))}
        </aside>
        <section className="aegis-mail-list scrollbar">
          <div style={{ padding: 12 }}>
            <label className="aegis-toolbar-search" style={{ minWidth: 0 }}>
              <Search size={14} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mail" />
            </label>
          </div>
          {query.isLoading ? Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="my-2 mx-3 h-16" />)
            : list.length === 0 ? <div style={{ padding: 20 }}><StatePanel state="empty" title="No messages" message="No Gmail messages match this view." /></div>
            : <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.02 } } }}>
                {list.map((message) => (
                  <motion.button
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    data-active={selectedId === message.id}
                    data-unread={message.unread}
                    key={message.id}
                    className="aegis-mail-item"
                    onClick={() => setSelectedId(message.id)}
                  >
                    <span className="aegis-mail-sender">
                      {message.unread && <i className="aegis-mail-dot" />}
                      <strong>{message.from || "Unknown sender"}</strong>
                      <time>{fmtDate(message.date)}</time>
                    </span>
                    <span className="aegis-mail-subject">{message.subject || "No subject"}</span>
                    <span className="aegis-mail-snippet">{message.snippet}</span>
                  </motion.button>
                ))}
              </motion.div>}
        </section>
        <article className="aegis-mail-preview scrollbar">
          <AnimatePresence mode="wait">
            {!selectedId ? (
              <motion.div key="empty" className="aegis-mail-preview-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Mail size={32} />
                <h3>Select a message</h3>
                <p style={{ fontSize: 12 }}>Read the full thread without leaving your workspace.</p>
              </motion.div>
            ) : detail.isLoading ? (
              <motion.div key="loading" className="aegis-mail-preview-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
                <Skeleton className="h-24 w-full mx-auto" />
              </motion.div>
            ) : detail.isError ? (
              <motion.div key="error" className="aegis-mail-preview-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Mail size={32} />
                <h3>Thread unavailable</h3>
                <p style={{ fontSize: 12 }}>{normalizeError(detail.error).message}</p>
              </motion.div>
            ) : thread ? (
              <motion.div key={selectedId} className="aegis-settings-stack" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                {thread.map((message, index) => (
                  <article key={message.id} className="aegis-mail-thread-item">
                    <header className="aegis-card-head" style={{ alignItems: "flex-start" }}>
                      <span className="aegis-square"><Mail size={17} /></span>
                      <span className="aegis-card-title">
                        <h2 style={{ fontSize: 16, whiteSpace: "normal" }}>{index === 0 ? (message.subject || "No subject") : ""}</h2>
                        <p>{message.from || "Unknown"} → {message.to} <time>· {fmtDate(message.date)} {fmtTime(message.date)}</time></p>
                      </span>
                    </header>
                    <div className="aegis-mail-body" style={{ fontSize: 14, lineHeight: 1.7, color: "#c8c8c8", whiteSpace: "pre-wrap" }}>
                      {message.bodyText || message.snippet}
                    </div>
                    {message.attachments.length > 0 && (
                      <div className="aegis-model-badge-row">
                        <span className="aegis-chip aegis-chip--blue"><Paperclip size={10} />Attachments</span>
                        {message.attachments.map((attachment) => (
                          <span key={attachment.attachmentId} className="aegis-chip">{attachment.filename} · {Math.ceil(attachment.size / 1024)} KB</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                <button className="aegis-btn" style={{ alignSelf: "flex-start" }} onClick={() => setComposing(true)}><Reply size={14} />Reply</button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </article>
      </div>

      {composing && <ComposeModal onClose={() => setComposing(false)} />}
    </div>
  );
}
