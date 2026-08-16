"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/use-auth";
import { ONBOARDING_STEPS, TOUR_START_EVENT, TOUR_STORAGE_KEY } from "./tour-steps";

type Rect = { x: number; y: number; width: number; height: number };

function measureTarget(selector: string): Rect | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function GuidedTour({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const steps = useMemo(() => ONBOARDING_STEPS, []);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const setOpenState = useCallback((value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  }, [onOpenChange]);

  const close = useCallback(() => {
    setOpenState(false);
    try { localStorage.setItem(TOUR_STORAGE_KEY, "1"); } catch { /* private mode */ }
  }, [setOpenState]);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, steps.length - 1));
    setStepIndex(clamped);
    setRect(measureTarget(steps[clamped].selector));
  }, [steps]);

  const next = useCallback(() => {
    if (isLast) { close(); return; }
    goTo(stepIndex + 1);
  }, [isLast, stepIndex, goTo, close]);

  const previous = useCallback(() => goTo(stepIndex - 1), [stepIndex, goTo]);

  const start = useCallback(() => {
    setStepIndex(0);
    setRect(measureTarget(steps[0].selector));
    setOpenState(true);
  }, [steps, setOpenState]);

  // Auto-open on first login.
  useEffect(() => {
    if (status !== "authenticated") return;
    let seen = false;
    try { seen = localStorage.getItem(TOUR_STORAGE_KEY) === "1"; } catch { /* ignore */ }
    if (seen) return;
    const timer = window.setTimeout(start, 800);
    return () => window.clearTimeout(timer);
  }, [status, start]);

  // Listen for a manual relaunch from the sidebar "help" button.
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [start]);

  // Re-measure on resize / scroll so the spotlight stays glued to the target.
  useEffect(() => {
    if (!open) return;
    const measure = () => setRect(measureTarget(step.selector));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  // Keyboard navigation: arrows + escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); }
      else if (event.key === "ArrowRight") { next(); }
      else if (event.key === "ArrowLeft") { previous(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, previous, close]);

  return (
    <AnimatePresence>
      {open && rect && (
        <>
          <motion.div
            className="guided-tour__mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
onClick={() => close()}
          />
          <motion.div
            className="guided-tour__spotlight"
            initial={{ opacity: 0, left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            animate={{ opacity: 1, left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          />
          <motion.aside
            className="guided-tour__card"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            role="dialog"
            aria-label="Aegis guided tour"
            aria-live="polite"
          >
            <div className="guided-tour__card-head">
              <span className="guided-tour__counter">{stepIndex + 1} / {steps.length}</span>
              <button type="button" className="guided-tour__close" onClick={() => close()} aria-label="Close tour"><X size={16} /></button>
            </div>
            <strong className="guided-tour__title">{step.title}</strong>
            <p className="guided-tour__desc">{step.description}</p>
            <div className="guided-tour__footer">
              <div className="guided-tour__dots" aria-hidden="true">
                {steps.map((s, i) => <i key={s.selector} data-active={i === stepIndex} />)}
              </div>
              <div className="guided-tour__actions">
                <button type="button" className="guided-tour__back" onClick={previous} disabled={stepIndex === 0} aria-label="Previous step"><ChevronLeft size={15} /></button>
                <button type="button" className="guided-tour__next" onClick={next}>
                  {isLast ? <><Check size={15} /> Done</> : <>Next <ChevronRight size={15} /></>}
                </button>
              </div>
            </div>
            {!isLast && (
              <button type="button" className="guided-tour__skip" onClick={() => close()}>Skip tour</button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
