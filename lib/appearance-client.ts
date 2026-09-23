import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  getTimeBasedAccent,
  normalizeAppearance,
  type AppearanceSettings,
} from "@/lib/appearance";

const APPEARANCE_TRANSITION_MS = 520;
const TIME_APPEARANCE_TRANSITION_MS = 1800;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

export function applyAppearance(
  settings: AppearanceSettings,
  options: { animate?: boolean; timeBased?: boolean; now?: Date } = {},
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const animate = options.animate !== false;
  const timeBased = options.timeBased === true && settings.appAccentMode === "time";

  if (animate) {
    root.dataset.appearanceTransition = timeBased ? "time" : "true";
    void getComputedStyle(root).getPropertyValue("--accent");
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      delete root.dataset.appearanceTransition;
      transitionTimer = undefined;
    }, timeBased ? TIME_APPEARANCE_TRANSITION_MS : APPEARANCE_TRANSITION_MS);
  }

  root.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.theme === "light" ? "#f5f5f6" : "#09090b");
  root.dataset.accentMode = settings.appAccentMode;
  root.dataset.accent = settings.appAccentMode === "time" ? getTimeBasedAccent(options.now) : settings.appAccent;
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
