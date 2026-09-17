export type SeminarTopic = { id: string; title: string; studentIds: string[]; studentNames?: string[] };
export type SeminarList = {
  id: string;
  subject: string;
  title: string;
  capacity: 1 | 2 | 3 | 4 | 5;
  topics: SeminarTopic[];
  revision: number;
  createdAt: string;
};
export type SeminarInput = { subject: string; title: string; capacity: 1 | 2 | 3 | 4 | 5; topics: string[] };
export function parseSeminarInput(value: unknown): SeminarInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.subject !== "string" || !v.subject.trim() || v.subject.length > 200 ||
      typeof v.title !== "string" || !v.title.trim() || v.title.length > 200 ||
      (!Number.isInteger(v.capacity) || Number(v.capacity) < 1 || Number(v.capacity) > 5) || !Array.isArray(v.topics) ||
      !v.topics.length || v.topics.length > 200 ||
      !v.topics.every(t => typeof t === "string" && t.trim() && t.length <= 1000)) return null;
  return { subject: v.subject.trim(), title: v.title.trim(), capacity: v.capacity as SeminarInput["capacity"], topics: v.topics.map(t => t.trim()) };
}

export type SeminarEditInput = Omit<SeminarInput, "topics"> & {
  listId: string;
  revision: number;
  topics: { id?: string; title: string }[];
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
    topics.push({ ...(topic.id !== undefined ? { id: topic.id } : {}), title: topic.title.trim() });
  }
  const input = parseSeminarInput({ ...v, topics: v.topics.map(t => t.title) });
  return input ? { ...input, listId: v.listId, revision: Number(v.revision), topics } : null;
}
