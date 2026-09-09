export type Group = 1 | 2;

export type Lesson = {
  class: string;
  professor: string;
  auditorium: string;
  timeStart: string;
  timeEnd: string;
  group: number[];
  weeks: number[];
};

export type Day = { table: Lesson[] };
export type ScheduleData = { semesterStart: number[]; days: Day[] };

export const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export function getTotalWeeks(schedule: ScheduleData) {
  return Math.max(1, ...schedule.days.flatMap((day) => day.table.flatMap((lesson) => lesson.weeks)));
}

export function getCurrentWeek(schedule: ScheduleData, now = new Date()) {
  const [year, month, day] = schedule.semesterStart;
  const semesterStart = new Date(year, month, day);
  const elapsedDays = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - semesterStart.getTime()) /
      86_400_000,
  );

  return Math.min(Math.max(Math.floor(elapsedDays / 7) + 1, 1), getTotalWeeks(schedule));
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getLessonsForWeek(schedule: ScheduleData, dayIndex: number, week: number, group: Group) {
  return (schedule.days[dayIndex]?.table ?? [])
    .filter((lesson) => lesson.weeks.includes(week) && (lesson.group.length === 2 || lesson.group.includes(group)))
    .sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));
}

export function formatWeekRange(schedule: ScheduleData, week: number) {
  const [year, month, day] = schedule.semesterStart;
  const start = new Date(year, month, day + (week - 1) * 7);
  const end = new Date(year, month, day + (week - 1) * 7 + 6);
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}
