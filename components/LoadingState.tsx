"use client";

import { useLayoutEffect, useRef } from "react";

type LoadingStateProps = {
  label?: string;
  detail?: string;
  screen?: boolean;
  compact?: boolean;
  className?: string;
};

export default function LoadingState({
  label = "Загружаем…",
  detail,
  screen = false,
  compact = false,
  className = "",
}: LoadingStateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const classes = ["app-loading-state", screen ? "is-screen" : "", compact ? "is-compact" : "", className].filter(Boolean).join(" ");

  useLayoutEffect(() => {
    if (!screen) return;
    const node = rootRef.current;
    if (!node) return;

    const random = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
    node.style.setProperty("--loading-x1", `${random(38, 64)}%`);
    node.style.setProperty("--loading-y1", `${random(-4, 10)}%`);
    node.style.setProperty("--loading-x2", `${random(-8, 16)}%`);
    node.style.setProperty("--loading-y2", `${random(14, 38)}%`);
    node.style.setProperty("--loading-x3", `${random(42, 68)}%`);
    node.style.setProperty("--loading-y3", `${random(2, 22)}%`);

    return () => {
      if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const ghost = node.cloneNode(true) as HTMLDivElement;
      ghost.removeAttribute("role");
      ghost.removeAttribute("aria-live");
      ghost.removeAttribute("aria-busy");
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("is-leaving", "app-loading-ghost");
      document.body.appendChild(ghost);
      window.setTimeout(() => ghost.remove(), 260);
    };
  }, [screen]);

  return <div ref={rootRef} className={classes} role="status" aria-live="polite" aria-busy="true">
    <span className="app-loading-spinner" aria-hidden="true"/>
    <div className="app-loading-copy">
      <strong>{label}</strong>
      {detail && <small>{detail}</small>}
    </div>
  </div>;
}
