import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { getAllDocs, getDoc } from "@/lib/docs/content";

export async function generateStaticParams() {
  return (await getAllDocs()).map((article) => ({ slug: article.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const article = await getDoc((await params).slug.join("/"));
  return article ? { title: article.title, description: article.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const article = await getDoc((await params).slug.join("/"));
  if (!article) notFound();
  const articles = await getAllDocs();
  const index = articles.findIndex((item) => item.slug === article.slug);
  const previous = index > 0 ? articles[index - 1] : null;
  const next = index < articles.length - 1 ? articles[index + 1] : null;
  return <DocsArticle article={article} previous={previous ? { slug: previous.slug, title: previous.title } : null} next={next ? { slug: next.slug, title: next.title } : null} />;
}
