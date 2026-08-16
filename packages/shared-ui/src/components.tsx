import { type ReactNode } from "react";

interface LogoProps {
  src?: string;
  size?: number;
  variant?: "full" | "icon" | "badge";
  className?: string;
}

export function AegisLogo({ src, size = 36, variant = "icon", className = "" }: LogoProps) {
  if (variant === "full") {
    return (
      <span className={`aegis-logo-full ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        {src ? (
          <img src={src} alt="Aegis" width={size} height={size} style={{ objectFit: "contain" }} />
        ) : (
          <span className="aegis-logo-mark" style={{ width: size, height: size, borderRadius: "50%", background: "var(--aegis-gradient-primary)" }} />
        )}
        <span style={{ fontWeight: 650, fontSize: size * 0.7, letterSpacing: "0.02em" }}>AEGIS</span>
      </span>
    );
  }
  if (variant === "badge") {
    return (
      <span className={`aegis-logo-badge ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--aegis-gradient-primary)" }} />
        <span style={{ fontWeight: 650, fontSize: 11, letterSpacing: "0.15em" }}>AEGIS</span>
      </span>
    );
  }
  // icon variant
  if (src) {
    return <img src={src} alt="Aegis" width={size} height={size} className={className} style={{ objectFit: "contain" }} />;
  }
  return (
    <span
      className={`aegis-logo-icon ${className}`}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--aegis-gradient-primary)",
      }}
    />
  );
}

interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: "button" | "submit";
}

export function AegisButton({
  variant = "primary",
  size = "md",
  children,
  onClick,
  disabled,
  title,
  className = "",
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`aegis-btn aegis-btn-${variant} aegis-btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function AegisCard({ children, className = "", onClick, hoverable }: CardProps) {
  return (
    <div
      className={`aegis-card ${hoverable ? "aegis-card-hoverable" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      {children}
    </div>
  );
}

export function AegisLoader({ size = 32, state: _state }: { size?: number; state?: string }) {
  return (
    <div
      className="aegis-loader"
      style={{
        display: "inline-flex",
        gap: 4,
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
      aria-label="Loading"
    >
      <span className="aegis-loader-bar aegis-loader-blue" style={{ width: size * 0.18, height: size * 0.5, borderRadius: 2, background: "var(--aegis-blue-light)" }} />
      <span className="aegis-loader-bar aegis-loader-white" style={{ width: size * 0.18, height: size * 0.7, borderRadius: 2, background: "var(--aegis-white)" }} />
      <span className="aegis-loader-bar aegis-loader-orange" style={{ width: size * 0.18, height: size * 0.9, borderRadius: 2, background: "var(--aegis-orange-light)" }} />
    </div>
  );
}

interface StatusProps {
  status: "online" | "offline" | "warning" | "idle" | "error" | "syncing";
  label?: string;
  pulse?: boolean;
}

export function AegisStatus({ status, label, pulse }: StatusProps) {
  const colors = {
    online: "var(--aegis-success)",
    offline: "var(--aegis-offline)",
    warning: "var(--aegis-warning)",
    idle: "var(--aegis-blue-light)",
    error: "var(--aegis-error)",
    syncing: "var(--aegis-orange-light)",
  };
  return (
    <span className="aegis-status" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        className={`aegis-status-dot ${pulse ? "aegis-pulse" : ""}`}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: colors[status],
          boxShadow: pulse ? `0 0 8px ${colors[status]}` : undefined,
        }}
      />
      {label && <span className="aegis-status-label" style={{ fontSize: 12, color: "var(--aegis-text-muted)" }}>{label}</span>}
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}

export function AegisModal({ open, onClose, title, children, width = 480 }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="aegis-modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(5, 7, 13, 0.8)", backdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className="aegis-modal"
        style={{
          width, maxWidth: "90vw", maxHeight: "85vh",
          border: "1px solid var(--aegis-border)",
          borderRadius: 16,
          background: "var(--aegis-surface)",
          overflow: "auto",
        }}
      >
        {title && (
          <div className="aegis-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
            <button
              className="aegis-modal-close"
              onClick={onClose}
              style={{
                border: "1px solid var(--aegis-border)", borderRadius: 8,
                padding: "6px 10px", color: "var(--aegis-text-muted)",
                background: "transparent", cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="aegis-modal-body" style={{ padding: "16px 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function AegisEmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="aegis-empty-state" style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 12, padding: "60px 40px", textAlign: "center",
      border: "1px dashed var(--aegis-border)", borderRadius: 16,
      background: "rgba(11, 18, 32, 0.5)",
    }}>
      {icon && <div style={{ color: "var(--aegis-text-muted)", opacity: 0.5 }}>{icon}</div>}
      <h3 style={{ margin: 0, fontSize: 16, color: "var(--aegis-text)" }}>{title}</h3>
      {description && <p style={{ margin: 0, fontSize: 13, color: "var(--aegis-text-muted)", maxWidth: 400, lineHeight: 1.6 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

interface ProviderCardProps {
  name: string;
  kind: string;
  url: string;
  status: "online" | "offline" | "unknown";
  hasApiKey: boolean;
  active: boolean;
  onConnect?: () => void;
  onTest?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function AegisProviderCard({ name, kind, url, status, hasApiKey, active, onConnect, onTest, onEdit, onRemove }: ProviderCardProps) {
  const icons: Record<string, string> = {
    ollama: "🦙", lmstudio: "🎬", "openai-compatible": "◆", "nvidia-compatible": "◆", "groq-compatible": "⚡", custom: "⚙",
  };
  return (
    <div className="aegis-card" style={{
      display: "flex", flexDirection: "column", gap: 12,
      padding: 20, border: "1px solid var(--aegis-border)", borderRadius: 12,
      background: status === "online" ? "rgba(54, 213, 138, 0.04)" : "var(--aegis-surface)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{icons[kind] || "◆"}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>{name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--aegis-text-muted)", fontFamily: "ui-monospace, monospace" }}>{url}</p>
          </div>
        </div>
        <div className="aegis-provider-badges" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className={`aegis-badge ${status}`} style={{
            padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: status === "online" ? "rgba(54, 213, 138, 0.15)" : status === "offline" ? "rgba(239, 83, 80, 0.15)" : "rgba(143, 162, 191, 0.15)",
            color: status === "online" ? "var(--aegis-success)" : status === "offline" ? "var(--aegis-error)" : "var(--aegis-text-muted)",
          }}>
            {status === "online" ? "● Online" : status === "offline" ? "○ Offline" : "○ Unknown"}
          </span>
          {!active && <span className="aegis-badge" style={{ padding: "3px 8px", borderRadius: 99, fontSize: 11, color: "var(--aegis-text-muted)", background: "rgba(143, 162, 191, 0.1)" }}>Inactive</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onConnect && <button className="aegis-btn aegis-btn-primary aegis-btn-sm" onClick={onConnect}>{hasApiKey ? "Reconnect" : "Connect"}</button>}
        {onTest && <button className="aegis-btn aegis-btn-secondary aegis-btn-sm" onClick={onTest}>Test</button>}
        {onEdit && <button className="aegis-btn aegis-btn-ghost aegis-btn-sm" onClick={onEdit}>Edit</button>}
        {onRemove && <button className="aegis-btn aegis-btn-danger aegis-btn-sm" onClick={onRemove}>Remove</button>}
      </div>
    </div>
  );
}

interface ModelCardProps {
  name: string;
  provider: string;
  type?: string;
  size?: string;
  context?: string;
  local: boolean;
  active: boolean;
  favorite?: boolean;
  onUse?: () => void;
  onTest?: () => void;
  onDetails?: () => void;
}

export function AegisModelCard({ name, provider, type, size, context, local, active, favorite, onUse, onTest, onDetails }: ModelCardProps) {
  const typeLabels: Record<string, string> = { chat: "Chat", code: "Code", embedding: "Embed", other: "Other" };
  return (
    <div className="aegis-card" style={{
      display: "flex", flexDirection: "column", gap: 10,
      padding: 16, border: "1px solid var(--aegis-border)", borderRadius: 12,
      background: active ? "rgba(8, 121, 237, 0.04)" : "var(--aegis-surface)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{name}</h3>
            {favorite && <span style={{ color: "var(--aegis-orange-light)" }}>★</span>}
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--aegis-text-muted)" }}>{provider}</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {local && <span className="aegis-badge-tag" style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "rgba(67, 199, 255, 0.12)", color: "var(--aegis-blue-light)" }}>Local</span>}
          {type && <span className="aegis-badge-tag" style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "rgba(248, 120, 8, 0.12)", color: "var(--aegis-orange-light)" }}>{typeLabels[type] || type}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--aegis-text-muted)" }}>
        {size && <span>Size: {size}</span>}
        {context && <span>Context: {context}</span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {onUse && <button className="aegis-btn aegis-btn-primary aegis-btn-sm" onClick={onUse}>Use</button>}
        {onTest && <button className="aegis-btn aegis-btn-secondary aegis-btn-sm" onClick={onTest}>Test</button>}
        {onDetails && <button className="aegis-btn aegis-btn-ghost aegis-btn-sm" onClick={onDetails}>Details</button>}
      </div>
    </div>
  );
}
