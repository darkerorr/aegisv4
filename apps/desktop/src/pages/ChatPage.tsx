import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Check,
  Code2,
  Copy,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  Send,
  Square,
  User,
  Wrench,
} from "lucide-react";
import { useChat } from "../contexts/ChatContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useSettings } from "../contexts/SettingsContext";
import { ModelSelector } from "../features/models/components/ModelSelector";

/* ---------- Markdown renderer (lightweight, premium) ---------- */

function inlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key++} className="inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[") && token.includes("](")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      nodes.push(<a key={key++} href={href} target="_blank" rel="noreferrer">{label}</a>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span><Code2 size={13} />{language || "code"}</span>
        <button onClick={() => void copy()} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.split("\n");
    const result: ReactNode[] = [];
    let i = 0;
    let key = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Code fence
      if (line.trimStart().startsWith("```")) {
        const language = line.trimStart().slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        result.push(<CodeBlock key={key++} code={codeLines.join("\n")} language={language} />);
        continue;
      }

      // Table row
      if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|[\s:|-]+\|/.test(lines[i + 1])) {
        const header = line.split("|").filter((cell) => cell.trim() !== "").map((cell) => cell.trim());
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          rows.push(lines[i].split("|").filter((cell) => cell.trim() !== "").map((cell) => cell.trim()));
          i++;
        }
        result.push(
          <div className="markdown-table-wrap" key={key++}>
            <table className="markdown-table">
              <thead><tr>{header.map((cell, idx) => <th key={idx}>{inlineMarkdown(cell)}</th>)}</tr></thead>
              <tbody>
                {rows.map((row, ridx) => (
                  <tr key={ridx}>{row.map((cell, cidx) => <td key={cidx}>{inlineMarkdown(cell)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headings
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const text = heading[2];
        const Tag = `h${Math.min(level + 1, 5)}` as "h2" | "h3" | "h4" | "h5";
        result.push(<Tag key={key++}>{inlineMarkdown(text)}</Tag>);
        i++;
        continue;
      }

      // Unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i++;
        }
        result.push(<ul key={key++}>{items.map((item, idx) => <li key={idx}>{inlineMarkdown(item)}</li>)}</ul>);
        continue;
      }

      // Ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i++;
        }
        result.push(<ol key={key++}>{items.map((item, idx) => <li key={idx}>{inlineMarkdown(item)}</li>)}</ol>);
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        const quoteLines: string[] = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        result.push(<blockquote key={key++}>{quoteLines.map((q, idx) => <p key={idx}>{inlineMarkdown(q)}</p>)}</blockquote>);
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        i++;
        continue;
      }

      // Paragraph (collect consecutive non-empty lines)
      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].trimStart().startsWith("```") && !lines[i].trim().startsWith("|") && !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i])) {
        paragraph.push(lines[i]);
        i++;
      }
      if (paragraph.length) {
        result.push(<p key={key++}>{inlineMarkdown(paragraph.join(" "))}</p>);
      }
    }
    return result;
  }, [content]);

  return <div className="markdown-body">{blocks}</div>;
}

/* ---------- Message bubble ---------- */

const MessageBubble = memo(function MessageBubble({ role, content, index, onCopy, copied, onRegenerate }: {
  role: "user" | "assistant" | "system";
  content: string;
  index: number;
  onCopy: (content: string, id: string) => void;
  copied: boolean;
  onRegenerate: () => void;
}) {
  const isUser = role === "user";
  if (role === "system") return null;
  return (
    <motion.div
      className={`message-bubble ${role}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 14,
        maxWidth: isUser ? "78%" : "100%",
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? "rgba(22,137,245,.12)" : "transparent",
        border: isUser ? "1px solid rgba(22,137,245,.18)" : "none",
        position: "relative",
      }}
    >
      <div
        className="message-avatar"
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: isUser ? "rgba(247,130,24,.14)" : "rgba(22,137,245,.14)",
          color: isUser ? "var(--aegis-accent)" : "var(--aegis-primary)",
          fontSize: 13,
        }}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="message-content" style={{ fontSize: 13.5, lineHeight: 1.7, wordBreak: "break-word" }}>
          {isUser ? content : <MarkdownContent content={content} />}
        </div>
        <div className="message-meta" style={{ display: "flex", gap: 4, marginTop: 8, opacity: 0.55 }}>
          <button className="message-action" onClick={() => onCopy(content, `msg-${index}`)} title="Copy" aria-label="Copy message" style={{ border: "none", background: "transparent", color: "var(--aegis-text-muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5 }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {!isUser && (
            <button className="message-action" onClick={onRegenerate} title="Regenerate" aria-label="Regenerate response" style={{ border: "none", background: "transparent", color: "var(--aegis-text-muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5 }}>
              <RefreshCw size={12} /> Regenerate
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

/* ---------- Chat page ---------- */

export function ChatPage() {
  const {
    messages,
    streaming,
    streamingContent,
    error,
    loading,
    selectedProvider,
    selectedModel,
    sendMessage,
    stopStreaming,
    regenerate,
    clearChat,
  } = useChat();
  const { navigate } = useSidebar();
  const { animations } = useSettings();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingContent]);

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!input.trim() || streaming) return;
    void sendMessage(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  async function copyContent(content: string, id: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  const suggestions = useMemo(() => [
    "Write or improve some text",
    "Explain something",
    "Help me code",
    "Analyze a document",
    "Plan a project",
    "Use a private local model",
  ], []);

  return (
    <motion.div
      className="chat-page"
      initial={animations ? { opacity: 0 } : undefined}
      animate={animations ? { opacity: 1 } : undefined}
      style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}
    >
      {/* Messages area */}
      <div
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            className="chat-empty"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 14,
              color: "var(--aegis-text-muted)",
              padding: "0 20px",
            }}
          >
            <motion.div
              initial={animations ? { scale: 0.9, opacity: 0 } : undefined}
              animate={animations ? { scale: 1, opacity: 1 } : undefined}
              transition={{ duration: 0.3 }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "rgba(22,137,245,.12)",
                color: "var(--aegis-primary)",
                boxShadow: "0 0 40px rgba(22,137,245,.15)",
              }}
            >
              <Bot size={28} />
            </motion.div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650, color: "var(--aegis-text)" }}>
              What can Aegis help you with?
            </h2>
            <p style={{ margin: 0, fontSize: 13, maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
              {selectedProvider ? `${selectedProvider.name} is ready when you are.` : "Choose a model or continue with a private local model."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 560 }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="aegis-btn aegis-btn-ghost aegis-btn-sm"
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                  style={{ fontSize: 11.5, padding: "7px 12px", borderRadius: 99, border: "1px solid var(--aegis-border)" }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {!selectedProvider && (
                <button className="aegis-btn aegis-btn-secondary aegis-btn-sm" onClick={() => navigate("Providers")}>
                  Configure provider
                </button>
              )}
              {!selectedModel && (
                <button className="aegis-btn aegis-btn-secondary aegis-btn-sm" onClick={() => navigate("Models")}>
                  Select model
                </button>
              )}
            </div>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div style={{ display: "grid", gap: 10, padding: "0 20px" }}>
            <div className="aegis-skeleton" style={{ height: 60, borderRadius: 14, width: "70%" }} />
            <div className="aegis-skeleton" style={{ height: 90, borderRadius: 14, width: "90%" }} />
            <div className="aegis-skeleton" style={{ height: 50, borderRadius: 14, width: "55%" }} />
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={`${msg.id ?? i}-${i}`}
            role={msg.role}
            content={msg.content}
            index={i}
            onCopy={copyContent}
            copied={copiedId === `msg-${i}`}
            onRegenerate={() => void regenerate()}
          />
        ))}

        {/* Streaming indicator */}
        {streaming && (
          <motion.div
            className="message-bubble streaming"
            role="status"
            aria-live="polite"
            aria-label="Assistant is generating a response"
            initial={animations ? { opacity: 0, y: 10 } : undefined}
            animate={animations ? { opacity: 1, y: 0 } : undefined}
            style={{
              display: "flex",
              gap: 12,
              padding: "14px 18px",
              borderRadius: 14,
              maxWidth: "100%",
              alignSelf: "flex-start",
              background: "transparent",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "rgba(22,137,245,.14)",
                color: "var(--aegis-primary)",
              }}
            >
              <Bot size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {streamingContent ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.7, wordBreak: "break-word" }}>
                  <MarkdownContent content={streamingContent} />
                  <span className="streaming-cursor" style={{ display: "inline-block", width: 2, height: 15, background: "var(--aegis-accent)", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink .8s infinite" }} />
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aegis-text-muted)", fontSize: 12 }}>
                  <LoaderCircle size={14} className="spin" />
                  Thinking…
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Error message */}
        {error && (
          <motion.div
            className="message-error"
            initial={animations ? { opacity: 0, y: 6 } : undefined}
            animate={animations ? { opacity: 1, y: 0 } : undefined}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(240,93,97,.25)",
              background: "rgba(240,93,97,.07)",
              color: "#ffaaa8",
              fontSize: 12.5,
              alignSelf: "center",
              maxWidth: "85%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ flex: 1, minWidth: 200 }}>{error}</span>
            <button
              className="aegis-btn aegis-btn-ghost"
              onClick={() => void regenerate()}
              style={{ fontSize: 11.5, border: "none", color: "var(--aegis-blue-light)", padding: "4px 10px" }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
      </div>

      {/* Composer */}
      <div className="composer-section" data-testid="chat-composer">
        <div className="composer-tools">
          <button className="composer-tool" title="Attachments require the native file bridge" aria-label="Attachments are unavailable in this build" disabled>
            <Paperclip size={14} /> Attachments
          </button>
          <button className="composer-tool" type="button" disabled title="Tools will be available when a compatible model is selected">
            <Wrench size={14} /> Tools
          </button>
          <button className="composer-tool" type="button" onClick={() => navigate("Agents")}>
            <Bot size={14} /> Agent
          </button>
          {selectedProvider && <span className="composer-provider-status">{selectedProvider.name}</span>}
        </div>
        <form onSubmit={handleSubmit} className="composer-form">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder={selectedModel ? "Ask Aegis anything…" : "Choose a model to start chatting…"}
            rows={1}
            disabled={streaming}
            aria-label="Message"
          />
          <div className="composer-action-row">
            <ModelSelector />
            <span className="composer-send-hint">Ctrl+Enter to send</span>
            {streaming ? (
              <button type="button" className="composer-send stop" onClick={stopStreaming} title="Stop generation" aria-label="Stop generation">
                <Square size={16} />
              </button>
            ) : (
              <button type="submit" className="composer-send" disabled={!input.trim() || !selectedModel} title="Send (Ctrl+Enter)" aria-label="Send message">
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
}