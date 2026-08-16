import type { DocStatus } from "@/lib/docs/schema";

export function FeatureStatus({ status }: { status: DocStatus }) {
  return <span className="feature-status" data-status={status}>{status}</span>;
}
