"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const SPOT_COUNT = 6;
const FORM_MS = 240;

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<CSSProperties[]>([]);

  useEffect(() => {
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const frame = requestAnimationFrame(() => {
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
        "--loading-ring-angle": `${index * 60 - 90}deg`,
        "--loading-ring-delay": `${-index * 0.09}s`,
      } as CSSProperties)));
    });

    let loading = false;
    let orbitTimer = 0;

    const setLoading = (next: boolean) => {
      const root = rootRef.current;
      if (!root || next === loading) return;
      loading = next;
      window.clearTimeout(orbitTimer);
      root.dataset.loading = String(next);
      delete root.dataset.orbiting;

      if (next) {
        orbitTimer = window.setTimeout(() => {
          if (loading && rootRef.current) rootRef.current.dataset.orbiting = "true";
        }, FORM_MS);
      }
    };

    const syncLoading = () => {
      setLoading(!!document.querySelector(".app-loading-state.is-screen:not(.app-loading-ghost)"));
    };

    const observer = new MutationObserver(syncLoading);
    observer.observe(document.body, { childList: true, subtree: true });
    syncLoading();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(orbitTimer);
      observer.disconnect();
    };
  }, []);

  return <div ref={rootRef} className="ambient-background" aria-hidden="true">
    {spots.map((style, index) => <span key={index} style={style}><i /></span>)}
  </div>;
}
