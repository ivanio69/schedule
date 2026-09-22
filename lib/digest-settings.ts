export type DigestSettings = {
  morningEnabled: boolean;
  morningTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
  timeZone: string;
};

export const DEFAULT_DIGEST_SETTINGS: DigestSettings = {
  morningEnabled: false,
  morningTime: "08:00",
  eveningEnabled: false,
  eveningTime: "20:00",
  timeZone: "Europe/Moscow",
};

const validTime = (value: unknown, fallback: string) => typeof value === "string" && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(value) ? value : fallback;
const validTimeZone = (value: unknown) => {
  if (typeof value !== "string" || !value || value.length > 80) return DEFAULT_DIGEST_SETTINGS.timeZone;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return value; } catch { return DEFAULT_DIGEST_SETTINGS.timeZone; }
};

export function normalizeDigestSettings(value: unknown): DigestSettings {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    morningEnabled: source.morningEnabled === true,
    morningTime: validTime(source.morningTime, DEFAULT_DIGEST_SETTINGS.morningTime),
    eveningEnabled: source.eveningEnabled === true,
    eveningTime: validTime(source.eveningTime, DEFAULT_DIGEST_SETTINGS.eveningTime),
    timeZone: validTimeZone(source.timeZone),
  };
}
