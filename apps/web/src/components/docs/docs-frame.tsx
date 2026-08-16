"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, ChevronDown, Command, Menu, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { docsGroups, type DocStatus } from "@/lib/docs/schema";
import { FeatureStatus } from "./feature-status";

type SearchArticle = { slug: string; title: string; description: string; group: string; status: DocStatus; keywords: string[]; searchable: string };

export function DocsFrame({ articles, children }: { articles: SearchArticle[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return articles.slice(0, 7);
    return articles.filter((article) => article.searchable.toLowerCase().includes(normalized)).slice(0, 10);
  }, [articles, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.key === "/" && !(event.target instanceof HTMLInputElement)) || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, []);

  const navigation = <nav className="docs-navigation" aria-label="Documentation">
    <Link className="docs-index-link" href="/docs"><BookOpenText size={17} /> Documentation <span>v0.4</span></Link>
    <button className="docs-search-trigger" type="button" onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }}><Search size={16} /><span>Search docs</span><kbd>Ctrl K</kbd></button>
    <div className="docs-nav-scroll">{docsGroups.map((group) => {
      const groupArticles = articles.filter((article) => article.group === group);
      if (!groupArticles.length) return null;
      return <details key={group} open><summary>{group}<ChevronDown size={14} /></summary><div>{groupArticles.map((article) => <Link data-active={pathname === `/docs/${article.slug}`} href={`/docs/${article.slug}`} key={article.slug} onClick={() => setMobileOpen(false)}>{article.title}{article.status === "planned" && <i>Planned</i>}</Link>)}</div></details>;
    })}</div>
  </nav>;

  return <div className="docs-shell">
    <button className="docs-mobile-toggle" type="button" onClick={() => setMobileOpen(true)}><Menu size={18} /> Browse docs</button>
    <aside className="docs-sidebar">{navigation}</aside>
    {mobileOpen && <div className="docs-mobile-drawer"><button type="button" aria-label="Close documentation navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button>{navigation}</div>}
    <div className="docs-content">{children}</div>
    {searchOpen && <div className="docs-search-overlay" role="dialog" aria-modal="true" aria-label="Search documentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="docs-search-dialog"><header><Search size={19} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every Aegis guide…" aria-label="Search every Aegis guide" /><kbd>Esc</kbd></header><div className="docs-search-results">{results.length ? results.map((article) => <Link href={`/docs/${article.slug}`} key={article.slug} onClick={() => { setSearchOpen(false); setQuery(""); }}><span><small>{article.group}</small><strong>{article.title}</strong><em>{article.description}</em></span><FeatureStatus status={article.status} /></Link>) : <p>No guide matches that search.</p>}</div><footer><Command size={14} /> Search indexes titles, headings, keywords and article content.</footer></div></div>}
  </div>;
}
