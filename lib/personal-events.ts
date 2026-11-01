export type PersonalEvent = {
  id: string;
  creatorId: string;
  title: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  notes: string;
};

export function normalizePersonalEvent(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof raw[key] === "string" && (raw[key] as string).length <= max ? (raw[key] as string).trim() : null;
  const title = text("title", 120), date = text("date", 10);
  const timeStart = text("timeStart", 5), timeEnd = text("timeEnd", 5);
  const location = text("location", 240), notes = text("notes", 2000);
  if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeStart || !timeEnd || !time.test(timeStart) || !time.test(timeEnd) || timeStart >= timeEnd || location === null || notes === null) return null;
  return { title, date, timeStart, timeEnd, location, notes };
}
