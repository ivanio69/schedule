export type SeminarTopic = { id: string; title: string; studentIds: string[]; studentNames?: string[] };
export type SeminarList = {
  id: string;
  subject: string;
  title: string;
  capacity: 1 | 2;
  topics: SeminarTopic[];
  revision: number;
  createdAt: string;
};
export type SeminarInput = { subject: string; title: string; capacity: 1 | 2; topics: string[] };
export function parseSeminarInput(value: unknown): SeminarInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.subject !== "string" || !v.subject.trim() || v.subject.length > 200 ||
      typeof v.title !== "string" || !v.title.trim() || v.title.length > 200 ||
      (v.capacity !== 1 && v.capacity !== 2) || !Array.isArray(v.topics) ||
      !v.topics.length || v.topics.length > 200 ||
      !v.topics.every(t => typeof t === "string" && t.trim() && t.length <= 1000)) return null;
  return { subject: v.subject.trim(), title: v.title.trim(), capacity: v.capacity, topics: v.topics.map(t => t.trim()) };
}
