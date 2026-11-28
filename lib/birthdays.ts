// Birthdays follow the university's calendar, including when travelling.
const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit",
});

export function normalizeBirthday(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || !/^\d{2}-\d{2}$/.test(value)) return null;
  const [month, day] = value.split("-").map(Number);
  // A leap year allows 29 February without asking for a birth year.
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}

export function birthdayDayKey(now = new Date()): string {
  const parts = calendar.formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function isBirthdayToday(birthday: unknown, now = new Date()): boolean {
  const value = normalizeBirthday(birthday);
  return Boolean(value && value === birthdayDayKey(now).slice(5));
}

export function formatBirthday(birthday: string): string {
  if (!normalizeBirthday(birthday)) return "";
  const [month, day] = birthday.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, month - 1, day)));
}
