export type DocStatus = "stable" | "beta" | "experimental" | "planned";
export type DocArticle = {
  slug: string;
  title: string;
  description: string;
  group: string;
  status: DocStatus;
  updated: string;
  keywords: string[];
  content: string;
  headings: Array<{ id: string; label: string; level: number }>;
};

export const docsGroups = ["Getting started", "Aegis Web", "Desktop", "CLI", "Providers", "Integrations", "Tools and agents", "Privacy", "API", "Troubleshooting"];
