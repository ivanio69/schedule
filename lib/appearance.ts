export const APPEARANCE_STORAGE_KEY = "schedule_appearance";

export type ThemeMode = "dark" | "light";
export type AccentPreset = "default" | "mint" | "blue" | "violet" | "amber" | "rose";
export type AppAccentMode = "manual" | "time";

export type AppearanceSettings = {
  theme: ThemeMode;
  appAccentMode: AppAccentMode;
  appAccent: AccentPreset;
  rehearsalAccent: AccentPreset;
  individualAccent: AccentPreset;
  seminarAccent: AccentPreset;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  appAccentMode: "manual",
  appAccent: "default",
  rehearsalAccent: "default",
  individualAccent: "default",
  seminarAccent: "default",
};

export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentPreset; label: string; color?: string }> = [
  { value: "default", label: "По теме" },
  { value: "mint", label: "Мятный", color: "#79d9b0" },
  { value: "blue", label: "Синий", color: "#76aef8" },
  { value: "violet", label: "Фиолетовый", color: "#aa8df5" },
  { value: "amber", label: "Янтарный", color: "#edb761" },
  { value: "rose", label: "Розовый", color: "#ed8ca1" },
];

export const TIME_ACCENT_PERIODS: ReadonlyArray<{ startHour: number; accent: AccentPreset; label: string }> = [
  { startHour: 0, accent: "violet", label: "Ночь" },
  { startHour: 6, accent: "amber", label: "Утро" },
  { startHour: 10, accent: "blue", label: "День" },
  { startHour: 16, accent: "mint", label: "Вторая половина дня" },
  { startHour: 20, accent: "rose", label: "Вечер" },
];

const ACCENTS = new Set<AccentPreset>(ACCENT_OPTIONS.map(option => option.value));

function accent(value: unknown): AccentPreset {
  return typeof value === "string" && ACCENTS.has(value as AccentPreset) ? value as AccentPreset : "default";
}

export function getTimeBasedAccent(date = new Date()): AccentPreset {
  const hour = date.getHours();
  let current = TIME_ACCENT_PERIODS[0].accent;
  for (const period of TIME_ACCENT_PERIODS) {
    if (hour < period.startHour) break;
    current = period.accent;
  }
  return current;
}

export function getTimeAccentChangeDelay(date = new Date()): number {
  const nextHour = TIME_ACCENT_PERIODS.slice(1).map(period => period.startHour).find(hour => date.getHours() < hour);
  const next = new Date(date);
  if (nextHour === undefined) {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(nextHour, 0, 0, 0);
  }
  return Math.max(1000, next.getTime() - date.getTime() + 100);
}

export function normalizeAppearance(value: unknown): AppearanceSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_APPEARANCE };
  const input = value as Record<string, unknown>;
  return {
    theme: input.theme === "light" ? "light" : "dark",
    appAccentMode: input.appAccentMode === "time" ? "time" : "manual",
    appAccent: accent(input.appAccent),
    rehearsalAccent: accent(input.rehearsalAccent),
    individualAccent: accent(input.individualAccent),
    seminarAccent: accent(input.seminarAccent),
  };
}
