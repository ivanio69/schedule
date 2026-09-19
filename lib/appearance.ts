export const APPEARANCE_STORAGE_KEY = "schedule_appearance";

export type ThemeMode = "dark" | "light";
export type AccentPreset = "neutral" | "mint" | "blue" | "violet" | "amber" | "rose";

export type AppearanceSettings = {
  theme: ThemeMode;
  appAccent: AccentPreset;
  rehearsalAccent: AccentPreset;
  individualAccent: AccentPreset;
  seminarAccent: AccentPreset;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  appAccent: "neutral",
  rehearsalAccent: "amber",
  individualAccent: "rose",
  seminarAccent: "violet",
};

export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentPreset; label: string; color?: string }> = [
  { value: "neutral", label: "Белый / чёрный" },
  { value: "mint", label: "Мятный", color: "#79d9b0" },
  { value: "blue", label: "Синий", color: "#76aef8" },
  { value: "violet", label: "Фиолетовый", color: "#aa8df5" },
  { value: "amber", label: "Янтарный", color: "#edb761" },
  { value: "rose", label: "Розовый", color: "#ed8ca1" },
];

const ACCENTS = new Set<AccentPreset>(ACCENT_OPTIONS.map(option => option.value));

function accent(value: unknown, legacyDefault: AccentPreset): AccentPreset {
  if (value === "default") return legacyDefault;
  return typeof value === "string" && ACCENTS.has(value as AccentPreset) ? value as AccentPreset : legacyDefault;
}

export function normalizeAppearance(value: unknown): AppearanceSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_APPEARANCE };
  const input = value as Record<string, unknown>;
  return {
    theme: input.theme === "light" ? "light" : "dark",
    appAccent: accent(input.appAccent, "neutral"),
    rehearsalAccent: accent(input.rehearsalAccent, "amber"),
    individualAccent: accent(input.individualAccent, "rose"),
    seminarAccent: accent(input.seminarAccent, "violet"),
  };
}
