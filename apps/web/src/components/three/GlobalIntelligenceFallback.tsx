"use client";

import { RefreshCw } from "lucide-react";

export function GlobalIntelligenceFallback({
  error = false,
  onRetry,
}: {
  error?: boolean;
  onRetry?: () => void;
}) {
  return <div className="hero-fallback-layer" data-testid="hero-3d-fallback">
    <div className="hero-fallback" role="img" aria-label="Aegis protected intelligence core">
      <span /><i /><b />
      <em aria-hidden="true" />
    </div>
    {error && <div className="hero-fallback-status" role="status">
      <span>Interactive visual unavailable. Aegis remains available.</span>
      {onRetry && <button type="button" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" /> Retry visual</button>}
    </div>}
  </div>;
}
