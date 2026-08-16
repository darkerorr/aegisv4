import { Database } from "lucide-react";
import register from "@/../public/legal/subprocessors.json";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { getLegalConfig } from "@/lib/legal/config";

export const metadata = { title: "Subprocessors" };
export default function SubprocessorsPage() { const legal = getLegalConfig(); return <LegalPageShell eyebrow="Service-provider register" title="Subprocessors." intro="Only providers verified as active Aegis infrastructure belong in this register. User-selected AI providers are disclosed separately." icon={Database} configured={legal.configured}><section><h2>Current register</h2>{register.subprocessors.length ? <div /> : <div className="empty-legal-register"><Database size={28} /><strong>No subprocessors configured for publication</strong><p>{register.note}</p></div>}</section><section><h2>Required fields</h2><p>Each future record must state service, data categories, processing location, transfer mechanism, privacy policy and last review date. An empty register is not a claim that no vendor processes data.</p></section><section><h2>Last reviewed</h2><p>{register.lastReviewedAt || "Not reviewed"}</p></section></LegalPageShell>; }
