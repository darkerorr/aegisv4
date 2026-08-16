"use client";
import { memo, useState } from "react";
import { Check, CircleAlert, ExternalLink, Globe2, Link2, LoaderCircle, Search } from "lucide-react";
import type { WebSearchResultView } from "@/lib/api/web-results";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  const domain = domainOf(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function isExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type WebActivityItem = {
  id: string;
  kind: "search" | "page";
  state: "requested" | "running" | "done" | "failed";
  query?: string;
  url?: string;
  title?: string;
  domain?: string;
  site?: string;
};

export const WebResearchActivity = memo(function WebResearchActivity({ activities }: { activities: WebActivityItem[] }) {
  const visible = activities.slice(-4);
  if (!visible.length) return null;
  return (
    <div className="v3-web-activity" aria-label="Web research activity">
      {visible.map((item) => {
        const validUrl = item.url && isExternalHttpUrl(item.url) ? item.url : null;
        const label = item.kind === "search" ? "Search" : item.state === "running" || item.state === "requested" ? "Visiting" : item.state === "failed" ? "Failed" : "Read";
        const content = (
          <>
            <span className="v3-web-activity__icon" aria-hidden="true">
              {validUrl ? <span className="v3-web-activity__favicon" style={{ backgroundImage: `url(${faviconUrl(validUrl)})` }} /> : <Search size={13} />}
            </span>
            <span className="v3-web-activity__body">
              <strong>{label}</strong>
              <span>{item.kind === "search" ? `“${item.query || "web"}”` : (item.site || item.domain || domainOf(validUrl || ""))}</span>
              {validUrl ? <small title={validUrl}>{validUrl}</small> : null}
            </span>
            <span className="v3-web-activity__state" aria-label={item.state}>
              {item.state === "running" || item.state === "requested" ? <LoaderCircle className="spin" size={13} /> : item.state === "done" ? <Check size={13} /> : <CircleAlert size={13} />}
            </span>
          </>
        );
        return validUrl ? <a key={item.id} className={`v3-web-activity__item is-${item.state}`} href={validUrl} target="_blank" rel="noopener noreferrer">{content}</a> : <div key={item.id} className={`v3-web-activity__item is-${item.state}`}>{content}</div>;
      })}
    </div>
  );
});

function SourceItem({ result }: { result: WebSearchResultView }) {
  const [copied, setCopied] = useState(false);
  if (!isExternalHttpUrl(result.url)) return null;
  const domain = result.domain || domainOf(result.url);
  const title = result.title || domain;

  async function copyUrl() {
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className="v3-source-card">
      <span className="v3-source-card__favicon" aria-hidden="true">
        {/* Favicons are remote by design: the URL is derived from the real result domain. */}
        <span className="v3-source-card__favicon-image" style={{ backgroundImage: `url(${faviconUrl(result.url)})` }} />
      </span>
      <div className="v3-source-card__body">
        <span className="v3-source-card__domain">{domain}</span>
        <a
          className="v3-source-card__title"
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          title={result.url}
        >
          {title}
        </a>
        {result.snippet ? <p className="v3-source-card__snippet">{result.snippet}</p> : null}
        <span className="v3-source-card__meta">
          {result.sourceType ? <b className="v3-source-card__type">{result.sourceType}</b> : null}
          {result.publishedAt ? (
            <time>{new Date(result.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
          ) : null}
          <span className="v3-source-card__url">{result.url}</span>
        </span>
      </div>
      <div className="v3-source-card__actions">
        <button type="button" className="v3-source-card__action" onClick={() => void copyUrl()} aria-label="Copy URL" title="Copy URL">
          {copied ? <Check size={13} /> : <Link2 size={13} />}
        </button>
        <a
          className="v3-source-card__action v3-source-card__open"
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open source in a new tab"
          title="Open source"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </article>
  );
}

/**
 * Collapsible "Sources" block rendered above an assistant answer when the
 * backend emitted a `web.results` event for this generation. Every URL is a
 * real result returned by the search provider — never fabricated, always
 * opened in a new tab.
 */
export const WebSources = memo(function WebSources({ query, results }: { query: string; results: WebSearchResultView[] }) {
  const [open, setOpen] = useState(true);
  if (!results.length) return null;
  return (
    <div className="v3-sources-block" data-open={open} data-query={query}>
      <button type="button" className="v3-sources-block__head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Globe2 size={13} />
        <strong>Sources</strong>
        <em>{results.length} web result{results.length > 1 ? "s" : ""}</em>
        <span className="v3-sources-block__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="v3-sources-block__grid">
          {results.map((result) => (
            <SourceItem key={result.url} result={result} />
          ))}
        </div>
      )}
    </div>
  );
});
