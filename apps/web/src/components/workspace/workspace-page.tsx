import type { LucideIcon } from "lucide-react";
import { NavToggle } from "./nav-toggle";

export function WorkspacePage({ title, description, icon: Icon, actions, children }: { title: string; description: string; icon: LucideIcon; actions?: React.ReactNode; children: React.ReactNode }) {
  return <div className="v3-page">
    <header className="v3-topbar">
      <NavToggle />
      <span className="v3-kicker"><Icon size={13} /> Aegis workspace</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="v3-topbar__actions">{actions}</div>
    </header>
    <div className="v3-page__body v3-scroll">
      {children}
    </div>
  </div>;
}
