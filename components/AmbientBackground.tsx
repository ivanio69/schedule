"use client";

import { subscribeScreenLoading } from "@/lib/screen-loading";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const LOADING_POINTS = [
  [-44, 0],
  [-22, 0],
  [0, 0],
  [22, 0],
  [44, 0],
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
      setSpots(LOADING_POINTS.map(([ringX, ringY], index) => ({
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
        width: `${random(35, 55)}vmax`,
        height: `${random(30, 45)}vmax`,
      } as CSSProperties)));
    });

    let loading: boolean | undefined;
    const syncLoading = (next: boolean) => {
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

    const unsubscribe = subscribeScreenLoading(syncLoading);
    const syncVisibility = () => {
      if (rootRef.current) rootRef.current.dataset.paused = String(document.hidden);
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return <div ref={rootRef} className="ambient-background" aria-hidden="true">
    <div className="ambient-spots">
      {spots.map((style, index) => <span key={index} style={style}><i /></span>)}
    </div>
  </div>;
}

