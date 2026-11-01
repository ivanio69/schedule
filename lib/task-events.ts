import { getDatabase, getIndividualLessons, getIndividualSlots, getProfileSettings, getRehearsals, getSchedule } from "@/lib/database";
import { datePosition, getLessonsForWeek, lessonKey } from "@/lib/schedule";
import type { PersonalEvent } from "@/lib/personal-events";
import { sameTaskLink, sortTasks, type Task, type TaskDay, type TaskEvent, type TaskInput } from "@/lib/tasks";

/** Request-local resolver: no user's private data is cached across requests. */
export async function createTaskResolver(personId: string) {
  const [schedule, profile, db] = await Promise.all([getSchedule(), getProfileSettings(personId), getDatabase()]);
  const days = new Map<string, Promise<TaskEvent[]>>();
  const loadDay = (date: string): Promise<TaskEvent[]> => {
    const cached = days.get(date);
    if (cached) return cached;
    const pending = (async () => {
      const { week, day } = datePosition(schedule, date);
      const [rehearsals, individuals, slots, personal] = await Promise.all([
        getRehearsals(date), getIndividualLessons(personId, date), getIndividualSlots(date, date),
        db.collection<PersonalEvent>("personal_events").find({ date, $or: [
          { creatorId: personId }, { invitations: { $elemMatch: { personId, status: "accepted" } } },
        ] }, { projection: { _id: 0 } }).toArray(),
      ]);
      const lessons = getLessonsForWeek(schedule, day, week, profile.preferences, profile.chinaMode);
      return [
        ...lessons.map(item => ({ kind: "lesson" as const, id: item.occurrence?.key ?? lessonKey(item), date: item.occurrence?.date ?? date, title: item.class, start: item.timeStart, end: item.timeEnd, cancelled: item.occurrence?.status === "cancelled" })),
        ...rehearsals.map(item => ({ kind: "rehearsal" as const, id: item.id, date, title: item.subject, start: item.timeStart, end: item.timeEnd })),
        ...individuals.map(item => ({ kind: "individual" as const, id: item.id, date, title: item.subject, start: item.timeStart, end: item.timeEnd })),
        ...slots.filter(item => item.studentIds.includes(personId) || item.studentId === personId).map(item => ({ kind: "slot" as const, id: item.id, date, title: item.subject, start: item.timeStart, end: item.timeEnd })),
        ...personal.map(item => ({ kind: "personal" as const, id: item.id, date, title: item.title, start: item.timeStart, end: item.timeEnd })),
      ].sort((a, b) => a.start.localeCompare(b.start));
    })();
    days.set(date, pending);
    return pending;
  };
  const afterClasses = (events: TaskEvent[]) => events.filter(item => item.kind === "lesson" && !item.cancelled).reduce<string | null>((end, item) => !end || item.end > end ? item.end : end, null);
  return {
    async validLink(input: TaskInput) {
      if (!input.event) return true;
      return (await loadDay(input.date)).some(item => !item.cancelled && sameTaskLink(item, input.event!));
    },
    async day(date: string, tasks: Task[]): Promise<TaskDay> {
      const events = await loadDay(date);
      const resolved = await Promise.all(tasks.map(async task => {
        // A lesson occurrence keeps its original key/date when moved to another day.
        const change = task.event?.kind === "lesson" ? schedule.changes?.find(item => item.key === task.event!.id && item.date === task.event!.date) : null;
        const effectiveDate = change?.kind === "move" ? change.targetDate : task.date;
        if (effectiveDate !== date) return null;
        const linkedEvent = task.event ? events.find(item => sameTaskLink(item, task.event!)) ?? null : null;
        return { ...task, effectiveDate, linkedEvent, linkMissing: Boolean(task.event && !linkedEvent), scheduledTime: task.timing === "time" ? task.time : task.timing === "after-classes" ? afterClasses(events) : null };
      }));
      return { tasks: sortTasks(resolved.filter(item => item !== null)), events: events.filter(item => !item.cancelled), afterClassesTime: afterClasses(events) };
    },
  };
}
