import { AegisLogo } from "@/components/brand/aegis-logo";

interface AegisBrandProps {
  size?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

/** Single source of truth for the Aegis agent identity (official logo +
 * wordmark). Work Mode uses this everywhere the agent itself is represented —
 * never a generic bot icon, never an emoji. */
export function AegisBrand({ size = 22, label = "Aegis", showLabel = true, className = "" }: AegisBrandProps) {
  return (
    <span className={`aegis-brand-id ${className}`} role="img" aria-label={label}>
      <AegisLogo size={size} />
      {showLabel && <strong className="aegis-brand-id__name">{label}</strong>}
    </span>
  );
}