"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("[Workspace] route failed", error);
  }, [error]);
  return <main className="route-error route-error--workspace"><p>WORKSPACE ERROR</p><h1>Aegis could not open this view.</h1><span>Your data was not changed.</span><Button onClick={reset}>Retry</Button></main>;
}
