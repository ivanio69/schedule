"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const random = (min: number, max: number) => min + Math.random() * (max - min);
      setSpots(Array.from({ length: Math.floor(random(4, 8)) }, () => ({
        transform: `translate(${random(0, 100)}vw, ${random(0, 100)}vh)`,
        width: `${random(45, 85)}vmax`, height: `${random(35, 65)}vmax`,
        animationDuration: `${random(24, 44)}s`, animationDelay: `${random(-44, 0)}s`,
        "--drift-x": `${random(-25, 25)}vw`, "--drift-y": `${random(-25, 25)}vh`,
        "--drift-x2": `${random(-25, 25)}vw`, "--drift-y2": `${random(-25, 25)}vh`,
      } as CSSProperties)));
    });
    // Observe real loading screens, excluding their outgoing visual clones.
    // The root layout and spot nodes survive route transitions unchanged.
    let loading: boolean | undefined;
    const syncLoading = () => {
      const next = !!document.querySelector(".app-loading-state.is-screen:not(.app-loading-ghost)");
      if (next === loading) return;
      const root = rootRef.current;
      if (root) {
        root.dataset.loading = String(next);
        if (loading !== undefined) {
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
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <div ref={rootRef} className="ambient-background" aria-hidden="true">{spots.map((style, index) => <span key={index} style={style}><i /></span>)}</div>;
}
