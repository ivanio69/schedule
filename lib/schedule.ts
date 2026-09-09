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
  const subjects = new Map<string, Set<number>>();
  for (const day of schedule.days) {
    for (const lesson of day.table) {
      if (lesson.group.length !== 1) continue;
      const groups = subjects.get(lesson.class) ?? new Set<number>();
      groups.add(lesson.group[0]);
      subjects.set(lesson.class, groups);
    }
  }
  return [...subjects.entries()].map(([name, groups]) => ({ name, groups: [...groups].sort((a, b) => a - b) }));
}

function getSemesterStartDate(schedule: ScheduleData) {
  const [year, month, day] = schedule.semesterStart;
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCurrentWeek(schedule: ScheduleData, now = new Date()) {
  const semesterStart = startOfLocalDay(getSemesterStartDate(schedule));
  const today = startOfLocalDay(now);
  const elapsedDays = Math.floor((today.getTime() - semesterStart.getTime()) / 86_400_000);
  return Math.min(Math.max(Math.floor(elapsedDays / 7) + 1, 1), getTotalWeeks(schedule));
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getLessonsForWeek(schedule: ScheduleData, dayIndex: number, week: number, preferences: Record<string, GroupPreference>) {
  return (schedule.days[dayIndex]?.table ?? [])
    .filter((lesson) => {
      if (!lesson.weeks.includes(week)) return false;
      if (lesson.group.length > 1) return true;
      const preference = preferences[lesson.class] ?? "both";
      return preference === "both" || preference === String(lesson.group[0]);
    })
    .sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));
}

export function formatWeekRange(schedule: ScheduleData, week: number) {
  const start = getSemesterStartDate(schedule);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}
