"use client";
import { useReducedMotion } from "framer-motion";
import { AegisIcon } from "./aegis-icons";

/* ============================================================================
   AEGIS CORE — the signature activity indicator of the Aegis agent.
   A small geometric nucleus whose internal structure changes with the agent
   activity: THINKING / READING / SEARCHING / EDITING / TESTING / DONE / ERROR.
   The shape itself is the animation: no emoji, no generic spinner.
   ========================================================================== */

export type AegisCoreState = "idle" | "thinking" | "reading" | "searching" | "editing" | "testing" | "done" | "error";

export const CORE_STATES: AegisCoreState[] = ["idle", "thinking", "reading", "searching", "editing", "testing", "done", "error"];

interface AegisCoreProps {
  state?: AegisCoreState;
  size?: number;
  className?: string;
  label?: string;
}

export function AegisCore({ state = "idle", size = 24, className, label }: AegisCoreProps) {
  const reduced = useReducedMotion();
  const dim = reduced ? "is-reduced" : "";
  const k = size / 24;

  return (
    <span
      className={`aegis-core ${dim}${className ? ` ${className}` : ""}`}
      data-state={state}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Agent ${state}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* outer nucleus */}
        <path d="M12 2.8l9 9.2-9 9.2-9-9.2z" />
        {/* inner structure — the per-activity animation lives here */}
        <g className="aegis-core__inner">
          <path d="M12 7.4v9.2" />
          <path d="M7.4 12h9.2" />
        </g>
        {/* orbiting node */}
        <circle className="aegis-core__orbit" cx="12" cy="3.6" r="1.15" fill="currentColor" stroke="none" style={{ transformBox: "fill-box", transformOrigin: "50% 350%" }} />
        {/* reading scan line */}
        <g className="aegis-core__scan" opacity="0">
          <path d="M7.6 13.6h8.8" strokeWidth="1.3" />
        </g>
        {/* testing progress arc */}
        <g className="aegis-core__progress" opacity="0">
          <path d="M12 4.4a7.6 7.6 0 1 1-6.6 11.3" strokeWidth="1.5" />
        </g>
        {/* result glyphs */}
        <g className="aegis-core__result" opacity="0">
          <g className="aegis-core__success">
            <AegisIcon name="success" size={24 * k} />
          </g>
          <g className="aegis-core__error">
            <AegisIcon name="error" size={24 * k} />
          </g>
        </g>
      </svg>
    </span>
  );
}

/** Map an agent activity string (label or action) onto a Core state. */
export function coreStateFromActivity(activity: { label?: string; action?: string } | null, streaming: boolean): AegisCoreState {
  if (!streaming) return "idle";
  const action = activity?.action;
  if (!action) return "thinking";
  switch (action) {
    case "done":
      return "done";
    case "error":
      return "error";
    case "read":
      return "reading";
    case "search":
      return "searching";
    case "edit":
    case "create":
    case "delete":
    case "move":
    case "rename":
    case "copy":
      return "editing";
    case "run":
    case "test":
    case "build":
    case "git":
      return "testing";
    default:
      return "thinking";
  }
}