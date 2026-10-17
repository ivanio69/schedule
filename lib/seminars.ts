export type SeminarDateMode = "none" | "all" | "topics";
export type SeminarAttachment = { id: string; name: string; size: number; mimeType: string; createdAt: string };
export type SeminarTopic = { id: string; title: string; studentIds: string[]; studentNames?: string[]; date?: string };
export type SeminarList = {
  id: string;
  subject: string;
  title: string;
  capacity: 1 | 2 | 3 | 4 | 5;
  topics: SeminarTopic[];
  dateMode?: SeminarDateMode;
  date?: string;
  files?: SeminarAttachment[];
  revision: number;
  createdAt: string;
};
export type SeminarInput = {
  subject: string; title: string; capacity: 1 | 2 | 3 | 4 | 5; topics: string[];
  dateMode: SeminarDateMode; date?: string; topicDates: string[];
};
export function validSeminarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function parseSeminarInput(value: unknown): SeminarInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.subject !== "string" || !v.subject.trim() || v.subject.length > 200 ||
      typeof v.title !== "string" || !v.title.trim() || v.title.length > 200 ||
      !Number.isInteger(v.capacity) || Number(v.capacity) < 1 || Number(v.capacity) > 5 ||
      !Array.isArray(v.topics) || !v.topics.length || v.topics.length > 200 ||
      !v.topics.every(t => typeof t === "string" && t.trim() && t.length <= 1000)) return null;
  const dateMode: SeminarDateMode = v.dateMode === "all" || v.dateMode === "topics" ? v.dateMode : "none";
  const date = dateMode === "all" ? v.date : undefined;
  if (dateMode === "all" && !validSeminarDate(date)) return null;
  const topicDates = Array.isArray(v.topicDates) ? v.topicDates : [];
  if (dateMode === "topics" && (topicDates.length !== v.topics.length ||
      !topicDates.every(d => d === "" || validSeminarDate(d)))) return null;
  return {
    subject: v.subject.trim(), title: v.title.trim(),
    capacity: v.capacity as SeminarInput["capacity"],
    topics: v.topics.map(t => (t as string).trim()),
    dateMode,
    ...(dateMode === "all" ? { date: date as string } : {}),
    topicDates: dateMode === "topics" ? topicDates as string[] : [],
  };
}

export type SeminarEditInput = Omit<SeminarInput, "topics" | "topicDates"> & {
  listId: string;
  revision: number;
  topics: { id?: string; title: string; date?: string }[];
};
export function parseSeminarEditInput(value: unknown): SeminarEditInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.listId !== "string" || !v.listId || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0 || !Array.isArray(v.topics)) return null;
  const topics: SeminarEditInput["topics"] = [];
  const ids = new Set<string>();
  for (const topic of v.topics) {
    if (!topic || typeof topic !== "object" || typeof topic.title !== "string") return null;
    if (topic.id !== undefined && (typeof topic.id !== "string" || !topic.id || ids.has(topic.id))) return null;
    if (topic.id !== undefined) ids.add(topic.id);
    if (topic.date !== undefined && topic.date !== "" && !validSeminarDate(topic.date)) return null;
    topics.push({
      ...(topic.id !== undefined ? { id: topic.id } : {}),
      title: topic.title.trim(),
      ...(typeof topic.date === "string" && topic.date && v.dateMode === "topics" ? { date: topic.date } : {}),
    });
  }
  const input = parseSeminarInput({
    ...v, topics: v.topics.map(t => t.title),
    topicDates: topics.map(t => t.date ?? ""),
  });
  return input ? {
    subject: input.subject, title: input.title, capacity: input.capacity,
    dateMode: input.dateMode, date: input.date,
    listId: v.listId, revision: Number(v.revision), topics,
  } : null;
}
