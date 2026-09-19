"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const RING_POINTS = [
  [0, -34],
  [29.45, -17],
  [29.45, 17],
  [0, 34],
  [-29.45, 17],
  [-29.45, -17],
] as const;

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<CSSProperties[]>([]);

  useEffect(() => {
    const random = (min: number, max: number) => min + Math.random() * (max - min);

    const randomizeSpot = (spot: HTMLElement) => {
      spot.style.setProperty("--ambient-left", `${50 + random(-46, 46)}%`);
      spot.style.setProperty("--ambient-top", `${50 + random(-46, 46)}%`);
    };

    const frame = requestAnimationFrame(() => {
      setSpots(RING_POINTS.map(([ringX, ringY], index) => ({
        "--ambient-left": `${50 + random(-46, 46)}%`,
        "--ambient-top": `${50 + random(-46, 46)}%`,
        "--ring-x": `${ringX}px`,
        "--ring-y": `${ringY}px`,
        "--ring-delay": `${index * 0.11}s`,
        "--ambient-duration": `${random(24, 44)}s`,
        "--ambient-delay": `${random(-44, 0)}s`,
        "--drift-x": `${random(-25, 25)}vw`,
        "--drift-y": `${random(-25, 25)}vh`,
        "--drift-x2": `${random(-25, 25)}vw`,
        "--drift-y2": `${random(-25, 25)}vh`,
        width: `${random(45, 85)}vmax`,
        height: `${random(35, 65)}vmax`,
      } as CSSProperties)));
    });

    let loading: boolean | undefined;
    const syncLoading = () => {
      const next = !!document.querySelector(".app-loading-state.is-screen:not(.app-loading-ghost)");
      if (next === loading) return;

      const root = rootRef.current;
      if (root) {
        root.dataset.loading = String(next);
        if (loading === true && !next) {
          for (const spot of root.querySelectorAll<HTMLElement>(".ambient-spots > span")) randomizeSpot(spot);
        }
      }
      loading = next;
    };

    const observer = new MutationObserver(syncLoading);
    observer.observe(document.body, { childList: true, subtree: true });
    syncLoading();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <div ref={rootRef} className="ambient-background" aria-hidden="true">
    <div className="ambient-spots">
      {spots.map((style, index) => <span key={index} style={style}><i /></span>)}
    </div>
  </div>;
}
