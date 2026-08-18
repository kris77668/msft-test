"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Reveal — scroll-triggered fade/rise, ported from core.jsx's <Reveal>.
 *
 * Same motion as the prototype (0.9s, cubic-bezier(.2,.7,.3,1), 16px rise,
 * IntersectionObserver at threshold 0.08, fires once).
 *
 * Two things the prototype got wrong, fixed here:
 *
 *  1. NO REDUCED-MOTION GUARD. It animated unconditionally. Someone with
 *     `prefers-reduced-motion: reduce` — often set because motion causes
 *     nausea or migraine — got the full effect on every section of every page.
 *     Here that preference renders content visible immediately, not merely fast.
 *
 *  2. CONTENT INVISIBLE WITHOUT JS. Starting at opacity 0 means a crawler or a
 *     failed hydration sees a blank page. We start visible and only opt into the
 *     hidden state once the observer is actually attached on the client.
 */

export interface RevealProps {
  children: React.ReactNode;
  /** Stagger in ms. The prototype used (i % 3) * 50 across grids. */
  delay?: number;
  /** Rise distance in px. */
  y?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const el = ref.current;
    if (!el) return;

    // Already on screen at mount (above the fold) — leave it visible rather
    // than hiding then re-showing, which would cost LCP and cause a flash.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return;

    setShown(false);
    setArmed(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx(className)}
      style={
        armed
          ? {
              opacity: shown ? 1 : 0,
              transform: shown ? "none" : `translateY(${y}px)`,
              transition: "opacity .9s cubic-bezier(.2,.7,.3,1), transform .9s cubic-bezier(.2,.7,.3,1)",
              transitionDelay: `${delay}ms`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
