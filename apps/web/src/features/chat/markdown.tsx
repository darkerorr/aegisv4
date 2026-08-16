"use client";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink, FileCode2, Play } from "lucide-react";

/** Extract a YouTube video id from any of the supported URL shapes. */
function youtubeId(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? id.slice(0, 11) : null;
    }
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "m.youtube.com") {
      if (url.pathname === "/watch" && url.searchParams.get("v")) return url.searchParams.get("v");
      const match = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(url.pathname);
      if (match) return match[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function YoutubeCard({ href }: { href: string }) {
  const id = youtubeId(href);
  if (!id) return null;
  return (
    <a className="v3-md-video" href={href} target="_blank" rel="noopener noreferrer" aria-label="Regarder la vidéo sur YouTube">
      <span className="v3-md-video__thumb" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }} aria-hidden="true">
        <span className="v3-md-video__play"><Play size={22} /></span>
      </span>
      <span className="v3-md-video__bar">
        <ExternalLink size={11} />Regarder sur YouTube
      </span>
    </a>
  );
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="v3-code">
      <header className="v3-code__bar">
        <span className="v3-code__dots"><i /><i /><i /></span>
        <span className="v3-code__lang"><FileCode2 size={12} />{language || "text"}</span>
        <button type="button" className="v3-code__copy" onClick={() => void copy()} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <em>{copied ? "Copied" : "Copy"}</em>
        </button>
      </header>
      <pre className="v3-code__pre v3-scroll"><code>{code}</code></pre>
    </div>
  );
}

const MemoizedMarkdown = memo(function PremiumMarkdown({ content }: { content: string }) {
  return (
    <div className="v3-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // External links always open in a new tab, keeping the current
          // conversation open. target/rel are set explicitly on every href.
          a({ href, children, ...props }) {
            const external = !href || /^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("#");
            if (!external || !href) return <a href={href} {...props}>{children}</a>;
            // Bare YouTube URLs become an embed-style video card (trailer, clip…).
            if (youtubeId(href) && String(children).trim() === href) {
              return <YoutubeCard href={href} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="v3-md-link" {...props}>
                {children}
                <ExternalLink size={11} className="v3-md-link__icon" aria-hidden="true" />
              </a>
            );
          },
          img({ node, src, alt, ...props }) {
            void node;
            const source = typeof src === "string" && src ? src : null;
            if (!source) return null;
            return (
              <a className="v3-md-img" href={source} target="_blank" rel="noopener noreferrer" title={alt || "Ouvrir l'image"}>
                {/* eslint-disable-next-line @next/next/no-img-element -- remote images in chat content are arbitrary user/AI-provided URLs */}
                <img src={source} alt={alt || ""} loading="lazy" {...props} />
              </a>
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const inline = !match;
            if (inline) return <code className="v3-inline-code" {...props}>{children}</code>;
            const code = String(children).replace(/\n$/, "");
            return <CodeBlock language={match?.[1]} code={code} />;
          },
          table({ children }) {
            return <div className="v3-table-wrap v3-scroll"><table className="v3-table">{children}</table></div>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export { MemoizedMarkdown };
