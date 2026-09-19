"use client";

import { useEffect, useState, type CSSProperties } from "react";

export default function AmbientBackground() {
  const [spots, setSpots] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const random = (min: number, max: number) => min + Math.random() * (max - min);
      setSpots(Array.from({ length: Math.floor(random(4, 8)) }, () => ({
        left: `${random(0, 100)}%`, top: `${random(0, 100)}%`,
        width: `${random(45, 85)}vmax`, height: `${random(35, 65)}vmax`,
        animationDuration: `${random(24, 44)}s`, animationDelay: `${random(-44, 0)}s`,
        "--drift-x": `${random(-25, 25)}vw`, "--drift-y": `${random(-25, 25)}vh`,
        "--drift-x2": `${random(-25, 25)}vw`, "--drift-y2": `${random(-25, 25)}vh`,
      } as CSSProperties)));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="ambient-background" aria-hidden="true">{spots.map((style, index) => <span key={index} style={style} />)}</div>;
}
