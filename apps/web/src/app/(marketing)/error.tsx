"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("[Marketing] route failed", error);
  }, [error]);

  return <main className="route-error"><p>AEGIS / PAGE ERROR</p><h1>This page could not be loaded.</h1><span>Your workspace remains available.</span><Button onClick={reset}>Try again</Button></main>;
}
