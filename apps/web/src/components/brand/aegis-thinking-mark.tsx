"use client";

const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

export function AegisThinkingMark({ size = 18, live = true }: { size?: number; live?: boolean }) {
  return (
    <span className={`aegis-mark${live ? " is-live" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="aegis-mark-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0f0f0" />
            <stop offset="0.35" stopColor="#c8c8c8" />
            <stop offset="0.62" stopColor="#d8bc6e" />
            <stop offset="0.85" stopColor="#e5342b" />
            <stop offset="1" stopColor="#7a0d0d" />
          </linearGradient>
          <linearGradient id="aegis-mark-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7a0d0d" />
            <stop offset="0.5" stopColor="#d8bc6e" />
            <stop offset="1" stopColor="#9a9a9a" />
          </linearGradient>
        </defs>
        <g className="aegis-mark__rays">
          {RAYS.map((angle) => (
            <line key={angle} x1="24" y1="24" x2="24" y2="7" transform={`rotate(${angle} 24 24)`} stroke="url(#aegis-mark-grad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
          ))}
        </g>
        <g className="aegis-mark__ring">
          <circle cx="24" cy="24" r="15.5" stroke="url(#aegis-mark-rim)" strokeWidth="1.8" strokeDasharray="4.5 3.2" />
        </g>
        <g className="aegis-mark__knot">
          <path d="M24 14 L32.66 19 L32.66 29 L24 34 L15.34 29 L15.34 19 Z" stroke="url(#aegis-mark-grad)" strokeWidth="1.7" strokeLinejoin="round" />
        </g>
        <g className="aegis-mark__inner">
          <path d="M24 18 L29 21 L29 27 L24 30 L19 27 L19 21 Z" stroke="url(#aegis-mark-rim)" strokeWidth="1.3" strokeLinejoin="round" opacity="0.85" />
        </g>
        <circle className="aegis-mark__core" cx="24" cy="24" r="2.8" fill="#e5342b" />
      </svg>
    </span>
  );
}
