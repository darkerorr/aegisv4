import { TriangleAlert } from "lucide-react";

export function LegalReviewNotice({ configured }: { configured: boolean }) {
  return <div className="legal-review-notice"><TriangleAlert size={19} aria-hidden="true" /><div><strong>{configured ? "Draft — legal review required" : "Legal information not configured"}</strong><p>This document reflects the current product code where verifiable. A qualified legal reviewer must approve identity, legal bases, retention and transfer disclosures before public commercial launch.</p></div></div>;
}
