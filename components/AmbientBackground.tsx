"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<CSSProperties[]>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const random = (min: number, max: number) => min + Math.random() * (max - min);
      setSpots(Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
        return {
          transform: `translate(${random(0, 100)}vw, ${random(0, 100)}vh)`,
          width: `${random(45, 85)}vmax`,
          height: `${random(35, 65)}vmax`,
          animationDuration: `${random(24, 44)}s`,
          animationDelay: `${random(-44, 0)}s`,
          "--drift-x": `${random(-25, 25)}vw`,
          "--drift-y": `${random(-25, 25)}vh`,
          "--drift-x2": `${random(-25, 25)}vw`,
          "--drift-y2": `${random(-25, 25)}vh`,
          "--loading-ring-x": `${Math.cos(angle) * 10.5}vmin`,
          "--loading-ring-y": `${Math.sin(angle) * 10.5}vmin`,
          "--loading-ring-delay": `${-index * 0.09}s`,
        } as CSSProperties;
      }));
    });

    let loading: boolean | undefined;
    const syncLoading = () => {
      const next = !!document.querySelector(".app-loading-state.is-screen:not(.app-loading-ghost)");
      if (next === loading) return;
      const root = rootRef.current;
      if (root) {
        root.dataset.loading = String(next);
        if (loading === true && !next) {
          for (const spot of root.children) {
            (spot as HTMLElement).style.transform = `translate(${Math.random() * 100}vw, ${Math.random() * 100}vh)`;
          }
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
    {spots.map((style, index) => <span key={index} style={style}><i /></span>)}
  </div>;
}
