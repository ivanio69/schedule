"use client";

import { useEffect } from "react";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  getTimeAccentChangeDelay,
  normalizeAppearance,
  type AppearanceSettings,
} from "@/lib/appearance";
import { applyAppearance, persistAppearance, readStoredAppearance } from "@/lib/appearance-client";

const PERSON_KEY = "schedule_person_id";

export default function AppearanceProvider() {
  useEffect(() => {
    let stopped = false;
    let initialized = false;
    let timeAccentTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleTimeAccent = (settings: AppearanceSettings) => {
      if (timeAccentTimer) {
        clearTimeout(timeAccentTimer);
        timeAccentTimer = undefined;
      }
      if (stopped || settings.appAccentMode !== "time") return;
      timeAccentTimer = setTimeout(() => {
        applyLocal("clock");
      }, getTimeAccentChangeDelay());
    };

    const applyLocal = (source: "normal" | "clock" = "normal") => {
      const settings = readStoredAppearance();
      applyAppearance(settings, {
        animate: initialized,
        timeBased: source === "clock",
      });
      initialized = true;
      scheduleTimeAccent(settings);
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
    const onVisibility = () => {
      if (document.visibilityState === "visible") applyLocal("clock");
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("schedule-appearance-change", onAppearance);
    window.addEventListener("schedule-auth-change", onAuth);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timeAccentTimer) clearTimeout(timeAccentTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("schedule-appearance-change", onAppearance);
      window.removeEventListener("schedule-auth-change", onAuth);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
