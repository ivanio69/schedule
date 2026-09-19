"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { APPEARANCE_STORAGE_KEY, normalizeAppearance } from "@/lib/appearance";
import { applyAppearance, persistAppearance, readStoredAppearance } from "@/lib/appearance-client";

const PERSON_KEY = "schedule_person_id";

export default function AppearanceProvider() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const random = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
    root.style.setProperty("--app-bg-x1", `${random(32, 68)}%`);
    root.style.setProperty("--app-bg-y1", `${random(-8, 16)}%`);
    root.style.setProperty("--app-bg-x2", `${random(-8, 22)}%`);
    root.style.setProperty("--app-bg-y2", `${random(12, 42)}%`);
  }, [pathname]);

  useEffect(() => {
    let stopped = false;

    const applyLocal = () => applyAppearance(readStoredAppearance());
    const syncProfile = async () => {
      const personId = localStorage.getItem(PERSON_KEY);
      if (!personId) return;
      try {
        const response = await fetch(`/api/profile/settings?personId=${encodeURIComponent(personId)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json();
        if (data.appearance) persistAppearance(normalizeAppearance(data.appearance));
      } catch {}
    };

    applyLocal();
    void syncProfile();

    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY) applyLocal();
      if (event.key === PERSON_KEY) void syncProfile();
    };
    const onAppearance = () => applyLocal();
    const onAuth = () => { applyLocal(); void syncProfile(); };

    window.addEventListener("storage", onStorage);
    window.addEventListener("schedule-appearance-change", onAppearance);
    window.addEventListener("schedule-auth-change", onAuth);
    return () => {
      stopped = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("schedule-appearance-change", onAppearance);
      window.removeEventListener("schedule-auth-change", onAuth);
    };
  }, []);

  return null;
}
