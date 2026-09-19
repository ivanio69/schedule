export type Group = number | "china";
export type GroupPreference = "1" | "2" | "both";

export type Lesson = {
  id?: string;
  class: string;
  professor: string;
  auditorium: string;
  timeStart: string;
  timeEnd: string;
  group: Group[];
  weeks: number[];
  occurrence?: { key: string; date: string; revision: number };
};

export type RehearsalParticipantMode = "rehearsal" | "blocks";

export type RehearsalBlock = {
  id: string;
  title: string;
  timeStart: string;
  timeEnd: string;
  notes?: string;
  participants: string[];
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
  participantMode?: RehearsalParticipantMode;
  blocks?: RehearsalBlock[];
  notes?: string;
  isGlobal?: boolean;
  createdAt: string;
};

export type Day = { table: Lesson[] };
export type ScheduleData = { semesterStart: number[]; days: Day[]; changes?: ScheduleChange[]; chinaSubgroupInitialized?: boolean };
export type ScheduleChange = { key: string; date: string; lesson: Lesson; kind: "move" | "cancel"; targetDate: string; timeStart: string; timeEnd: string; auditorium: string; reason: string; revision: number };

export const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export function getTotalWeeks(schedule: ScheduleData) {
  return Math.max(1, ...schedule.days.flatMap((day) => day.table.flatMap((lesson) => lesson.weeks)));
}

export function getAvailableGroups(schedule: ScheduleData) {
  return [...new Set(schedule.days.flatMap((day) => day.table.flatMap((lesson) => lesson.group.filter((group): group is number => typeof group === "number"))))].sort((a, b) => a - b);
}

/** Subjects that actually have subgroup-specific lessons (group [1] or [2]). */
export function getSubgroupSubjects(schedule: ScheduleData) {
  const map = new Map<string, Set<number>>();
  for (const day of schedule.days) {
    for (const lesson of day.table) {
      if (lesson.group.length !== 1 || typeof lesson.group[0] !== "number" || ![1, 2].includes(lesson.group[0])) continue;
      const groups = map.get(lesson.class) ?? new Set<number>();
      groups.add(lesson.group[0]);
      map.set(lesson.class, groups);
    }
  }
  return [...map.entries()]
    .map(([name, groups]) => ({ name, groups: [...groups].sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function lessonMatchesChinaMode(lesson: Lesson, chinaMode = false) {
  const hasChina = lesson.group.includes("china");
  if (chinaMode) return hasChina;
  const hasRegularGroup = lesson.group.some(group => typeof group === "number");
  return !hasChina || hasRegularGroup;
}

export function filterScheduleByChinaMode(schedule: ScheduleData, chinaMode = false): ScheduleData {
  return {
    ...schedule,
    days: schedule.days.map(day => ({ ...day, table: day.table.filter(lesson => lessonMatchesChinaMode(lesson, chinaMode)) })),
    changes: schedule.changes?.filter(change => lessonMatchesChinaMode(change.lesson, chinaMode)),
  };
}

export function getLessonsForWeek(schedule: ScheduleData, dayIndex: number, week: number, preferences: Record<string, GroupPreference> = {}, chinaMode = false) {
  const date = getScheduleDate(schedule, week, dayIndex);
  return getOccurrences(schedule, date).filter(lesson => {
    if (!lessonMatchesChinaMode(lesson, chinaMode)) return false;
    if (chinaMode) return true;
    const preference = preferences[lesson.class] ?? "both";
    return preference === "both" || !lesson.group.length || lesson.group.includes(Number(preference));
  });
}

export function lessonKey(lesson: Lesson) {
  return lesson.id ?? JSON.stringify([lesson.class, lesson.professor, lesson.timeStart, lesson.timeEnd, lesson.auditorium, [...lesson.group].sort(), [...lesson.weeks].sort((a,b)=>a-b)]);
}
export function getScheduleDate(schedule: ScheduleData, week: number, day: number) {
  const [y,m,d] = schedule.semesterStart;
  const monday = new Date(Date.UTC(y,m,d));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay()+6)%7 + (week-1)*7 + day);
  return monday.toISOString().slice(0,10);
}
export function datePosition(schedule: ScheduleData, date: string) {
  const days = (Date.parse(date) - Date.parse(getScheduleDate(schedule,1,0))) / 86400000;
  return { week: Math.floor(days/7)+1, day: ((days%7)+7)%7 };
}
export function validScheduleDate(schedule: ScheduleData, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return false;
  if (new Date(date).toISOString().slice(0,10) !== date) return false;
  const {week,day} = datePosition(schedule,date);
  return week >= 1 && week <= getTotalWeeks(schedule) && day < 6;
}
export function getOccurrences(schedule: ScheduleData, date: string): Lesson[] {
  if (!validScheduleDate(schedule,date)) return [];
  const {week,day} = datePosition(schedule,date);
  const changes = schedule.changes ?? [];
  const lessons = (schedule.days[day]?.table ?? []).filter(l=>!l.weeks.length || l.weeks.includes(week))
    .filter(l=>!changes.some(c=>c.date===date && c.key===lessonKey(l)))
    .map(l=>({...l, occurrence:{key:lessonKey(l),date,revision:0}}));
  for (const c of changes) {
    if (c.kind==="move" && c.targetDate===date) lessons.push({...c.lesson,timeStart:c.timeStart,timeEnd:c.timeEnd,auditorium:c.auditorium,occurrence:{key:c.key,date:c.date,revision:c.revision}});
  }
  return lessons.sort((a,b)=>a.timeStart.localeCompare(b.timeStart));
}

function getSemesterMonday(schedule: ScheduleData) {
  const [year, month, day] = schedule.semesterStart;
  const start = new Date(year, month, day);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

export function getCurrentWeek(schedule: ScheduleData, now = new Date()) {
  const semesterStart = getSemesterMonday(schedule);
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((current.getTime() - semesterStart.getTime()) / 86400000);
  return Math.max(1, Math.min(getTotalWeeks(schedule), Math.floor(diff / 7) + 1));
}

export function formatWeekRange(schedule: ScheduleData, week: number) {
  const start = getSemesterMonday(schedule);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  const format = (date: Date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  return `${format(start)} — ${format(end)}`;
}