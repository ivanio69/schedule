"use client";

import { useEffect } from "react";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, normalizeAppearance } from "@/lib/appearance";
import { applyAppearance, persistAppearance, readStoredAppearance } from "@/lib/appearance-client";

const PERSON_KEY = "schedule_person_id";

export default function AppearanceProvider() {
  useEffect(() => {
    let stopped = false;

    let initialized = false;
    const applyLocal = () => {
      applyAppearance(readStoredAppearance(), { animate: initialized });
      initialized = true;
    };
    const syncProfile = async () => {
      const personId = localStorage.getItem(PERSON_KEY);
      if (!personId) return;
      try {
        const response = await fetch(`/api/profile/settings?personId=${encodeURIComponent(personId)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json();
        persistAppearance(normalizeAppearance(data.appearance ?? DEFAULT_APPEARANCE), { animate: true });
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
