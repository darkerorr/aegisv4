"use client";

import { useEffect, useState } from "react";

export function useWebGlSupport() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const available = Boolean(context);
      if (context) {
        const loseContext = context.getExtension("WEBGL_lose_context");
        loseContext?.loseContext();
      }
      setSupported(available);
      if (process.env.NODE_ENV !== "production") console.info(`[Hero3D] WebGL ${available ? "supported" : "unavailable"}`);
    } catch (error) {
      setSupported(false);
      if (process.env.NODE_ENV !== "production") console.warn("[Hero3D] WebGL detection failed", error);
    }
  }, []);

  return supported;
}
