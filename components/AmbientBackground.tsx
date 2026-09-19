"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const SPOT_COUNT = 6;
const FORM_MS = 180;
const ORBIT_MS = 1100;

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<CSSProperties[]>([]);

  useEffect(() => {
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const seedFrame = requestAnimationFrame(() => {
      setSpots(Array.from({ length: SPOT_COUNT }, (_, index) => ({
        transform: `translate(${random(-50, 50)}vw, ${random(-50, 50)}dvh)`,
        width: `${random(45, 85)}vmax`,
        height: `${random(35, 65)}vmax`,
        animationDuration: `${random(24, 44)}s`,
        animationDelay: `${random(-44, 0)}s`,
        "--drift-x": `${random(-25, 25)}vw`,
        "--drift-y": `${random(-25, 25)}vh`,
        "--drift-x2": `${random(-25, 25)}vw`,
        "--drift-y2": `${random(-25, 25)}vh`,
        "--loading-ring-delay": `${-index * 0.09}s`,
      } as CSSProperties)));
    });

    let loading = false;
    let orbitFrame = 0;
    let orbitStartedAt = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const viewport = () => {
      const visual = window.visualViewport;
      return {
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
      };
    };

    const layoutRing = (timestamp: number) => {
      const root = rootRef.current;
      if (!root || !loading) return;

      const view = viewport();
      const centerX = view.width / 2;
      const centerY = view.height / 2;

      const elapsed = Math.max(0, timestamp - orbitStartedAt);
      const phase = reducedMotion.matches || elapsed <= FORM_MS
        ? 0
        : ((elapsed - FORM_MS) / ORBIT_MS) * Math.PI * 2;
      const radius = Math.max(36, Math.min(54, Math.min(view.width, view.height) * 0.105));

      Array.from(root.children).forEach((node, index) => {
        const angle = phase + (Math.PI * 2 * index) / SPOT_COUNT - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        (node as HTMLElement).style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      });

      root.dataset.orbiting = String(elapsed > FORM_MS + 40);
      if (!reducedMotion.matches) orbitFrame = requestAnimationFrame(layoutRing);
    };

    const startOrbit = () => {
      if (orbitFrame) cancelAnimationFrame(orbitFrame);
      orbitStartedAt = performance.now();
      orbitFrame = requestAnimationFrame(layoutRing);
    };

    const stopOrbit = () => {
      if (orbitFrame) cancelAnimationFrame(orbitFrame);
      orbitFrame = 0;
      const root = rootRef.current;
      if (!root) return;
      delete root.dataset.orbiting;
      for (const spot of root.children) {
        (spot as HTMLElement).style.transform = `translate(${random(-50, 50)}vw, ${random(-50, 50)}dvh)`;
      }
    };

    const syncLoading = () => {
      const next = !!document.querySelector(".app-loading-state.is-screen:not(.app-loading-ghost)");
      const root = rootRef.current;
      if (!root) return;
      root.dataset.loading = String(next);

      if (next && !loading) {
        loading = true;
        startOrbit();
      } else if (!next && loading) {
        loading = false;
        stopOrbit();
      } else if (next && loading && !orbitFrame) {
        startOrbit();
      }
    };

    const observer = new MutationObserver(syncLoading);
    observer.observe(document.body, { childList: true, subtree: true });
    syncLoading();

    return () => {
      cancelAnimationFrame(seedFrame);
      if (orbitFrame) cancelAnimationFrame(orbitFrame);
      observer.disconnect();
    };
  }, []);

  return <div ref={rootRef} className="ambient-background" aria-hidden="true">
    {spots.map((style, index) => <span key={index} style={style}><i /></span>)}
  </div>;
}
