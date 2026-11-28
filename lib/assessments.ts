import { datePosition, getTotalWeeks, type ScheduleData } from "./schedule";

export type AssessmentKind = "exam" | "credit";
export const ASSESSMENT_LABELS: Record<AssessmentKind, string> = { exam: "Экзамен", credit: "Зачёт" };
export type AssessmentComment = { id: string; personId: string; author: string; text: string; createdAt: string };
export type AssessmentInput = {
  kind: AssessmentKind; subject: string; date: string; timeStart: string; timeEnd: string;
  professor: string; auditorium: string; notes: string;
};
export type Assessment = AssessmentInput & {
  id: string; revision: number; createdAt: string; updatedAt: string; comments: AssessmentComment[];
};

export function validAssessmentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeAssessment(value: unknown): AssessmentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof raw[key] === "string" && raw[key].length <= max ? raw[key].trim() : null;
  const subject = text("subject", 160), professor = text("professor", 240), auditorium = text("auditorium", 240), notes = text("notes", 4000);
  const timeStart = text("timeStart", 5), timeEnd = text("timeEnd", 5);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((raw.kind !== "exam" && raw.kind !== "credit") || !subject || !validAssessmentDate(raw.date)
    || !timeStart || !timeEnd || !time.test(timeStart) || !time.test(timeEnd) || timeStart >= timeEnd
    || professor === null || auditorium === null || notes === null) return null;
  return { kind: raw.kind, subject, date: raw.date, timeStart, timeEnd, professor, auditorium, notes };
}

// Extend only the calendar navigation: recurring lessons retain their original semester limits.
export function assessmentNavigationWeeks(schedule: ScheduleData, assessments: Pick<Assessment, "date">[]) {
  return Math.max(getTotalWeeks(schedule), ...assessments.map(item => datePosition(schedule, item.date).week));
}

export function assessmentNavigationStartWeek(schedule: ScheduleData, assessments: Pick<Assessment, "date">[]) {
  return Math.min(1, ...assessments.map(item => datePosition(schedule, item.date).week));
}

export function formatAssessmentDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00"));
}
