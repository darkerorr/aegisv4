import { MarketingNav } from "@/components/navigation/marketing-nav";
import { DocsFrame } from "@/components/docs/docs-frame";
import { getAllDocs } from "@/lib/docs/content";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const articles = await getAllDocs();
  const index = articles.map(({ slug, title, description, group, status, keywords, content }) => ({ slug, title, description, group, status, keywords, searchable: `${title} ${description} ${keywords.join(" ")} ${content.replace(/[`#>*_-]/g, " ")}` }));
  return <><MarketingNav /><DocsFrame articles={index}>{children}</DocsFrame></>;
}
