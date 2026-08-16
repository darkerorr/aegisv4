"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DocsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("[Docs] route failed", error);
  }, [error]);
  return <main className="route-error"><p>AEGIS / DOCS ERROR</p><h1>The guide could not be loaded.</h1><span>Search and the rest of Aegis remain available.</span><Button onClick={reset}>Try again</Button></main>;
}
