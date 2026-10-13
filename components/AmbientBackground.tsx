"use client";

import { useEffect, useRef } from "react";
import { subscribeScreenLoading } from "@/lib/screen-loading";
import { startAmbientAnimation } from "@/lib/ambient-animation";

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rootRef.current) return startAmbientAnimation(rootRef.current, subscribeScreenLoading);
  }, []);
  return <div ref={rootRef} className="ambient-background" aria-hidden="true">
    <div className="ambient-spots">
      {[0, 1, 2, 3, 4].map(index => <span key={index}><i /></span>)}
    </div>
  </div>;
}
