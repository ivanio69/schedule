"use client";

import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { APPEARANCE_STORAGE_KEY } from "@/lib/appearance";
import { readStoredAppearance } from "@/lib/appearance-client";

// A small, stable set of particles. Motion animates only their transforms.
const flakes = Array.from({ length: 16 }, (_, index) => ({
  left: `${(index * 37 + 7) % 100}%`,
  size: 2 + (index % 3) * 0.8,
  opacity: 0.20 + (index % 4) * 0.055,
  duration: 15 + (index % 6) * 2,
  delay: -index * 1.7,
  drift: (index % 2 ? 1 : -1) * (12 + (index % 5) * 5),
}));

function subscribe(onChange: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onStorage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("schedule-appearance-change", onChange);
  window.addEventListener("schedule-auth-change", onChange);
  document.addEventListener("visibilitychange", onChange);
  reduced.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("schedule-appearance-change", onChange);
    window.removeEventListener("schedule-auth-change", onChange);
    document.removeEventListener("visibilitychange", onChange);
    reduced.removeEventListener("change", onChange);
  };
}

function getSnapshot() {
  return document.visibilityState === "visible"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && readStoredAppearance().snowEnabled !== false;
}

const getServerSnapshot = () => false;

export default function WinterSnowfall() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!enabled) return null;

  return (
    <div className="winter-snowfall" aria-hidden="true">
      {flakes.map((flake, index) => (
        <motion.span
          key={index}
          className="winter-snowfall__flake"
          style={{ left: flake.left, width: flake.size, height: flake.size, opacity: flake.opacity }}
          initial={{ x: 0, y: "-5vh" }}
          animate={{ x: [0, flake.drift, -flake.drift / 2], y: ["-5vh", "50vh", "105vh"] }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
}
