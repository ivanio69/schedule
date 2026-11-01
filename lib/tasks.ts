export type TaskEventKind = "lesson" | "rehearsal" | "individual" | "slot" | "personal";
export type TaskLink = { kind: TaskEventKind; id: string; date: string };
export type TaskTiming = "anytime" | "time" | "after-classes";
export type TaskInput = { title: string; date: string; notes: string; timing: TaskTiming; time: string; event: TaskLink | null };
export type Task = TaskInput & { id: string; creatorId: string; completed: boolean; revision: number; createdAt: string; updatedAt: string };
export type TaskEvent = TaskLink & { title: string; start: string; end: string; cancelled?: boolean };
export type ResolvedTask = Task & { effectiveDate: string; scheduledTime: string | null; linkedEvent: TaskEvent | null; linkMissing: boolean };
export type TaskDay = { tasks: ResolvedTask[]; events: TaskEvent[]; afterClassesTime: string | null };

export const taskEventLabels: Record<TaskEventKind, string> = { lesson: "Пара", rehearsal: "Репетиция", individual: "Индивидуальное", slot: "Индивидуальное", personal: "Событие" };
export function validTaskDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const validTaskId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512;
export const sameTaskLink = (a: TaskLink, b: TaskLink) => a.kind === b.kind && a.id === b.id && a.date === b.date;
export function normalizeTask(value: unknown): TaskInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 160 || !validTaskDate(raw.date)) return null;
  if (typeof raw.notes !== "string" || raw.notes.length > 2000 || (typeof raw.timing !== "string" || !["anytime", "time", "after-classes"].includes(raw.timing))) return null;
  if (raw.timing === "time" && (typeof raw.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time))) return null;
  let event: TaskLink | null = null;
  if (raw.event !== null && raw.event !== undefined) {
    if (typeof raw.event !== "object") return null;
    const link = raw.event as Record<string, unknown>;
    if ((typeof link.kind !== "string" || !["lesson", "rehearsal", "individual", "slot", "personal"].includes(link.kind)) || !validTaskId(link.id) || !validTaskDate(link.date)) return null;
    event = { kind: link.kind as TaskEventKind, id: link.id, date: link.date };
  }
  return { title: raw.title.trim(), date: raw.date, notes: raw.notes.trim(), timing: raw.timing as TaskTiming, time: raw.timing === "time" ? raw.time as string : "", event };
}
export function taskWhen(task: ResolvedTask) {
  if (task.timing === "time") return task.time;
  if (task.timing === "after-classes") return task.scheduledTime ? `После пар · ${task.scheduledTime}` : "После пар · пар нет";
  return "В течение дня";
}
export function sortTasks(tasks: ResolvedTask[]) {
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") || a.createdAt.localeCompare(b.createdAt));
}
