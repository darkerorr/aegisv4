import { SiteNav } from "../../components/SiteNav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--aegis-background)]">
      <SiteNav />
      {children}
    </main>
  );
}
