export type Group = number;
export type GroupPreference = "1" | "2" | "both";

export type Lesson = {
  class: string;
  professor: string;
  auditorium: string;
  timeStart: string;
  timeEnd: string;
  group: number[];
  weeks: number[];
};

export type Rehearsal = {
  id: string;
  creatorId: string;
  creatorName?: string;
  subject: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  responsible: string;
  participants: string[];
  createdAt: string;
};

export type Day = { table: Lesson[] };
export type ScheduleData = { semesterStart: number[]; days: Day[] };

export const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export function getTotalWeeks(schedule: ScheduleData) {
  return Math.max(1, ...schedule.days.flatMap((day) => day.table.flatMap((lesson) => lesson.weeks)));
}

export function getAvailableGroups(schedule: ScheduleData) {
  return [...new Set(schedule.days.flatMap((day) => day.table.flatMap((lesson) => lesson.group)))].sort((a, b) => a - b);
}

export function getSubgroupSubjects(schedule: ScheduleData) {
  const map = new Map<string, number[]>();
  for (const day of schedule.days) for (const lesson of day.table) if (lesson.group.length > 1) map.set(lesson.class, lesson.group);
  return [...map.entries()].map(([name, groups]) => ({ name, groups }));
}

export function getLessonsForWeek(schedule: ScheduleData, dayIndex: number, week: number, preferences: Record<string, GroupPreference> = {}) {
  const day = schedule.days[dayIndex];
  if (!day) return [];
  return day.table.filter((lesson) => {
    if (!lesson.weeks.includes(week)) return false;
    if (lesson.group.length <= 1) return true;
    const preference = preferences[lesson.class] ?? "both";
    return preference === "both" || lesson.group.includes(Number(preference));
  }).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
}

export function getCurrentWeek(schedule: ScheduleData, now = new Date()) {
  const [year, month, day] = schedule.semesterStart;
  const semesterStart = new Date(year, month, day);
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((current.getTime() - semesterStart.getTime()) / 86400000);
  return Math.max(1, Math.min(getTotalWeeks(schedule), Math.floor(diff / 7) + 1));
}

export function formatWeekRange(schedule: ScheduleData, week: number) {
  const [year, month, day] = schedule.semesterStart;
  const start = new Date(year, month, day + (week - 1) * 7);
  const end = new Date(year, month, day + (week - 1) * 7 + 5);
  const format = (date: Date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  return `${format(start)} — ${format(end)}`;
}