"use client";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, FileCode2 } from "lucide-react";
import type { Components } from "react-markdown";

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "").replace(/\n$/, "");
  const lang = (className || "").replace("language-", "") || "text";
  return (
    <div className="v3-code">
      <header className="v3-code__bar">
        <span className="v3-code__dots"><i /><i /><i /></span>
        <span className="v3-code__lang"><FileCode2 size={12} />{lang}</span>
        <button type="button" className="v3-code__copy" onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <em>{copied ? "Copied" : "Copy"}</em>
        </button>
      </header>
      <pre className="v3-code__pre v3-scroll"><code className={className}>{children}</code></pre>
    </div>
  );
}

const components: Components = {
  code({ className, children, ...props }) {
    const isBlock = Boolean(className);
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return <code className="v3-inline-code" {...props}>{children}</code>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return <div className="v3-table-wrap v3-scroll"><table className="v3-table">{children}</table></div>;
  },
};

export const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="v3-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
    </div>
  );
});
