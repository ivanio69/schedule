import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type AppearanceSettings,
} from "@/lib/appearance";

export function applyAppearance(settings: AppearanceSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.appAccent;
  root.dataset.rehearsalAccent = settings.rehearsalAccent;
  root.dataset.individualAccent = settings.individualAccent;
  root.dataset.seminarAccent = settings.seminarAccent;
}

export function readStoredAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function persistAppearance(value: AppearanceSettings) {
  const settings = normalizeAppearance(value);
  if (typeof window === "undefined") return settings;
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  applyAppearance(settings);
  window.dispatchEvent(new CustomEvent("schedule-appearance-change", { detail: settings }));
  return settings;
}
