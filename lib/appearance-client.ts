import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type AppearanceSettings,
} from "@/lib/appearance";

const APPEARANCE_TRANSITION_MS = 520;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

export function applyAppearance(settings: AppearanceSettings, options: { animate?: boolean } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const animate = options.animate !== false;

  if (animate) {
    root.dataset.appearanceTransition = "true";
    // Make sure the transition state is committed before data attributes change.
    void getComputedStyle(root).getPropertyValue("--accent");
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      delete root.dataset.appearanceTransition;
      transitionTimer = undefined;
    }, APPEARANCE_TRANSITION_MS);
  }

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

export function persistAppearance(value: AppearanceSettings, options: { animate?: boolean } = {}) {
  const settings = normalizeAppearance(value);
  if (typeof window === "undefined") return settings;
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  applyAppearance(settings, options);
  window.dispatchEvent(new CustomEvent("schedule-appearance-change", { detail: settings }));
  return settings;
}

export function resetLocalAppearance(options: { animate?: boolean } = {}) {
  const settings = { ...DEFAULT_APPEARANCE };
  if (typeof window === "undefined") return settings;
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  applyAppearance(settings, options);
  window.dispatchEvent(new CustomEvent("schedule-appearance-change", { detail: settings }));
  return settings;
}
