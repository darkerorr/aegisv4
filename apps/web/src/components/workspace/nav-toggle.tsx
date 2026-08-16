"use client";
import { Menu } from "lucide-react";
import { useWorkspaceNav } from "./workspace-shell";

export function NavToggle() {
  const { openNav } = useWorkspaceNav();
  return (
    <button type="button" className="v3-nav-toggle" aria-label="Open navigation" onClick={openNav}>
      <Menu size={16} />
    </button>
  );
}
