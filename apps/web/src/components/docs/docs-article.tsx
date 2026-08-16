"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, type ReactNode } from "react";
import type { DocArticle } from "@/lib/docs/schema";
import { FeatureStatus } from "./feature-status";

function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function textOf(node: ReactNode): string { if (typeof node === "string" || typeof node === "number") return String(node); if (Array.isArray(node)) return node.map(textOf).join(""); if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children); return ""; }

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const value = textOf(children).replace(/\n$/, "");
  return <div className="docs-code"><button type="button" onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button><pre>{children}</pre></div>;
}

export function DocsArticle({ article, previous, next }: { article: DocArticle; previous: { slug: string; title: string } | null; next: { slug: string; title: string } | null }) {
  return <main id="main" className="docs-article-layout"><article className="docs-article"><header><span>{article.group}</span><h1>{article.title}</h1><p>{article.description}</p><div><FeatureStatus status={article.status} /><time>Updated {article.updated}</time></div></header><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
      h3: ({ children }) => <h3 id={slugify(textOf(children))}>{children}</h3>,
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      a: ({ href, children }) => <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noreferrer" : undefined}>{children}{href?.startsWith("http") && <ExternalLink size={13} />}</a>,
    }}>{article.content}</ReactMarkdown><nav className="docs-pagination">{previous ? <Link href={`/docs/${previous.slug}`}><ChevronLeft size={16} /><span><small>Previous</small><strong>{previous.title}</strong></span></Link> : <span />}{next && <Link href={`/docs/${next.slug}`}><span><small>Next</small><strong>{next.title}</strong></span><ChevronRight size={16} /></Link>}</nav></article><aside className="docs-toc"><strong>On this page</strong>{article.headings.map((heading) => <a data-level={heading.level} key={heading.id} href={`#${heading.id}`}>{heading.label}</a>)}</aside></main>;
}
