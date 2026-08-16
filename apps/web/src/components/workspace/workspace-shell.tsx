"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { ConversationRail } from "./conversation-rail";
import { GuidedTour } from "@/features/onboarding/guided-tour";

const RAIL_KEY = "aegis.rail.history.v1";

const WorkspaceNavContext = createContext<{
  openNav: () => void;
  railCollapsed: boolean;
  toggleRail: () => void;
}>({
  openNav: () => {},
  railCollapsed: false,
  toggleRail: () => {},
});

export function useWorkspaceNav() {
  return useContext(WorkspaceNavContext);
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RAIL_KEY);
      if (saved)
        setRailCollapsed((JSON.parse(saved) as { collapsed?: boolean }).collapsed === true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, JSON.stringify({ collapsed: railCollapsed }));
    } catch {}
  }, [railCollapsed]);

  const toggleRail = useCallback(() => setRailCollapsed((value) => !value), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/chat");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <WorkspaceNavContext.Provider
      value={{ openNav: () => setNavOpen(true), railCollapsed, toggleRail }}
    >
      <div className="v3-workspace aegis-canvas" data-collapsed={collapsed} data-nav-open={navOpen}>
        <div className="v3-canvas" aria-hidden="true">
          <div className="v3-canvas__grid" />
          <div className="v3-canvas__orb v3-canvas__orb--blue" />
          <div className="v3-canvas__orb v3-canvas__orb--indigo" />
          <div className="v3-canvas__orb v3-canvas__orb--violet" />
          <div className="v3-canvas__orb v3-canvas__orb--ember" />
          <div className="v3-canvas__vignette" />
        </div>

        <WorkspaceSidebar
          collapsed={tourOpen ? false : collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
          onNew={() => {
            setNavOpen(false);
            router.push("/chat");
          }}
          navOpen={navOpen}
          onCloseNav={() => setNavOpen(false)}
        />
        <ConversationRail collapsed={railCollapsed} onToggle={toggleRail} />
        <motion.section
          className="v3-main"
          id="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {children}
        </motion.section>
      </div>
      <GuidedTour onOpenChange={setTourOpen} />
    </WorkspaceNavContext.Provider>
  );
}
