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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const validTime = (value: unknown, fallback: string) => typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;
const minutes = (value: string) => {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
};
const shiftDate = (date: string, days: number) => {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const DIGEST_DELIVERY_GRACE_MINUTES = 45;

function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

export function getDueDigestDate(
  now: Date,
  timeZone: string,
  targetTime: string,
  graceMinutes = DIGEST_DELIVERY_GRACE_MINUTES,
): string | null {
  if (!TIME_PATTERN.test(targetTime) || graceMinutes <= 0) return null;
  const clock = localClock(now, validTimeZone(timeZone));
  const currentMinutes = minutes(clock.time);
  const targetMinutes = minutes(targetTime);
  let elapsed = currentMinutes - targetMinutes;
  let scheduledDate = clock.date;

  // A delayed run shortly after midnight can still deliver a late-night digest
  // for the previous local day.
  if (elapsed < 0) {
    elapsed += 24 * 60;
    scheduledDate = shiftDate(clock.date, -1);
  }

  return elapsed >= 0 && elapsed < graceMinutes ? scheduledDate : null;
}
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
