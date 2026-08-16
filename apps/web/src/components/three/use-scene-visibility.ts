"use client";

import { useEffect, useRef, useState } from "react";

export function useSceneVisibility() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [inViewport, setInViewport] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = (width: number, height: number) => {
      const next = { width: Math.round(width), height: Math.round(height) };
      setSize((current) => current.width === next.width && current.height === next.height ? current : next);
      if (process.env.NODE_ENV !== "production") {
        if (next.width > 0 && next.height > 0) console.info(`[Hero3D] container measured: ${next.width}x${next.height}`);
        else console.warn("[Hero3D] container has zero height or width", next);
      }
    };

    const rect = element.getBoundingClientRect();
    measure(rect.width, rect.height);
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(element);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (entry) setInViewport(entry.isIntersecting);
    }, { rootMargin: "120px" });
    intersectionObserver.observe(element);

    const handleVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return {
    containerRef,
    size,
    active: inViewport && documentVisible,
  };
}
