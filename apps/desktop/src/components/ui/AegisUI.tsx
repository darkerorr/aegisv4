import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, Inbox, LoaderCircle, X } from "lucide-react";
import logoUrl from "../../assets/aegis-logo.png";

export function AegisButton({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button {...props} className={`aegis-button aegis-button-${variant} ${className}`} />;
}

export function AegisIconButton({ label, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button {...props} aria-label={label} title={label} className={`aegis-icon-button ${className}`}>{children}</button>;
}

export const AegisInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function AegisInput(props, ref) {
  return <input {...props} ref={ref} className={`aegis-control ${props.className ?? ""}`} />;
});

export const AegisTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AegisTextarea(props, ref) {
  return <textarea {...props} ref={ref} className={`aegis-control aegis-textarea ${props.className ?? ""}`} />;
});

export const AegisSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function AegisSelect(props, ref) {
  return <select {...props} ref={ref} className={`aegis-control aegis-select ${props.className ?? ""}`} />;
});

export function AegisCard({ raised = false, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return <div {...props} className={`aegis-card ${raised ? "aegis-card-raised" : ""} ${className}`} />;
}

export const AegisGlass = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { strong?: boolean }>(function AegisGlass({ strong = false, className = "", ...props }, ref) {
  return <div {...props} ref={ref} className={`aegis-glass ${strong ? "aegis-glass-strong" : ""} ${className}`} />;
});

export const AegisGlassPanel = AegisGlass;

export function AegisModal({ open, title, description, children, onClose, className = "" }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; className?: string }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    const timer = window.setTimeout(() => { (modalRef.current?.querySelector<HTMLElement>("input, button, [tabindex]:not([tabindex=\"-1\"])"))?.focus(); }, 30);
    return () => { document.removeEventListener("keydown", handleKey); window.clearTimeout(timer); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="aegis-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <AegisGlass strong ref={modalRef} className={`aegis-modal ${className}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><AegisIconButton label="Close" onClick={onClose}><X size={17} /></AegisIconButton></header>
      {children}
    </AegisGlass>
  </div>;
}

export function AegisDrawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="aegis-drawer" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><AegisIconButton label="Close" onClick={onClose}><X size={17} /></AegisIconButton></header>{children}</div>;
}

export function AegisDropdown({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return open ? <AegisGlass strong className={`aegis-dropdown ${className}`}>{children}</AegisGlass> : null;
}

export function AegisTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="aegis-tooltip" title={label}>{children}</span>;
}

export function AegisToast({ tone = "success", title, description, onClose }: { tone?: "success" | "danger" | "neutral"; title: string; description?: string; onClose?: () => void }) {
  return <div className={`aegis-toast aegis-toast-${tone}`} role={tone === "danger" ? "alert" : "status"}><span><strong>{title}</strong>{description && <small>{description}</small>}</span>{onClose && <AegisIconButton label="Dismiss" onClick={onClose}><X size={14} /></AegisIconButton>}</div>;
}

export function AegisAvatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  return <span className="aegis-avatar" style={{ width: size, height: size }}>{src ? <img src={src} alt={name} /> : name.trim().charAt(0).toUpperCase()}</span>;
}

export function AegisLogo({ size = 34, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return <span className="aegis-logo"><img src={logoUrl} alt="Aegis" width={size} height={size} />{wordmark && <strong>Aegis</strong>}</span>;
}

export function AegisBadge({ tone = "neutral", children }: { tone?: "neutral" | "blue" | "orange" | "success" | "danger"; children: ReactNode }) {
  return <span className={`aegis-badge aegis-badge-${tone}`}>{children}</span>;
}

export function AegisStatus({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "blue" | "orange" | "success" | "danger" }) {
  return <span className={`aegis-status aegis-status-${tone}`}><i />{label}</span>;
}

export function AegisSkeleton({ width = "100%", height = 14, ...props }: { width?: string | number; height?: number } & HTMLAttributes<HTMLSpanElement>) {
  return <span className="aegis-skeleton" style={{ width, height, ...props.style }} aria-hidden="true" {...props} />;
}

export function AegisLoader({ label = "Loading" }: { label?: string }) {
  return <span className="aegis-inline-loader" role="status"><LoaderCircle size={16} />{label}</span>;
}

export function AegisEmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <AegisCard className="aegis-empty-state"><span className="aegis-empty-icon">{icon ?? <Inbox size={22} />}</span><h2>{title}</h2><p>{description}</p>{action}</AegisCard>;
}

export function AegisErrorState({ title, description, action, onRetry }: { title: string; description: string; action?: ReactNode; onRetry?: () => void }) {
  return <AegisCard className="aegis-empty-state aegis-error-state"><span className="aegis-empty-icon"><AlertTriangle size={22} /></span><h2>{title}</h2><p>{description}</p>{action || (onRetry && <AegisButton variant="secondary" onClick={onRetry}>Retry</AegisButton>)}</AegisCard>;
}

export function AegisProgress({ value, label }: { value: number; label?: string }) {
  return <div className="aegis-progress" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} role="progressbar"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
