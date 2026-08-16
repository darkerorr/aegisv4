"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { GlobalIntelligenceFallback } from "./GlobalIntelligenceFallback";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { useSceneVisibility } from "./use-scene-visibility";
import { useWebGlSupport } from "./use-webgl-support";

const GlobalIntelligenceScene = dynamic(() => import("./GlobalIntelligenceScene.client").then((module) => {
  if (process.env.NODE_ENV !== "production") console.info("[Hero3D] module loaded");
  return module;
}), { ssr: false, loading: () => null });

export function HeroScene() {
  const webGlSupported = useWebGlSupport();
  const { containerRef, size, active } = useSceneVisibility();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [simplified, setSimplified] = useState(false);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 640px)");
    const update = () => {
      setReducedMotion(motion.matches);
      setSimplified(mobile.matches || (navigator.hardwareConcurrency ?? 8) <= 4);
    };
    update();
    motion.addEventListener("change", update);
    mobile.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  const handleReady = useCallback(() => {
    setFailed(false);
    setContextLost(false);
    setReady(true);
  }, []);
  const handleError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const handleContextLost = useCallback(() => {
    setContextLost(true);
    setReady(false);
  }, []);
  const handleContextRestored = useCallback(() => {
    setContextLost(false);
    setRetryKey((value) => value + 1);
  }, []);
  const retry = useCallback(() => {
    setFailed(false);
    setContextLost(false);
    setReady(false);
    setRetryKey((value) => value + 1);
  }, []);

  const measured = size.width > 0 && size.height > 0;
  const canRender = measured && webGlSupported === true;
  const showError = failed || contextLost;
  const state = showError ? "fallback" : ready ? "ready" : "loading";

  return <div
    ref={containerRef}
    className="hero-scene"
    data-scene-state={state}
    data-testid="hero-3d-container"
    aria-describedby="hero-3d-description"
  >
    <span id="hero-3d-description" className="sr-only">A black and white visualization of multiple intelligences converging into the Aegis core.</span>
    {(!ready || showError || !canRender) && <GlobalIntelligenceFallback error={showError} onRetry={showError ? retry : undefined} />}
    {canRender && <div className="hero-scene-canvas" aria-hidden={!ready}>
      <SceneErrorBoundary resetKey={retryKey} onError={handleError} fallback={null}>
        <GlobalIntelligenceScene
          key={retryKey}
          active={active}
          reducedMotion={reducedMotion}
          simplified={simplified}
          onReady={handleReady}
          onContextLost={handleContextLost}
          onContextRestored={handleContextRestored}
        />
      </SceneErrorBoundary>
    </div>}
  </div>;
}
