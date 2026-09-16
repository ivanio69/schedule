import { randomUUID } from "node:crypto";
import { getDatabase, getPeople } from "@/lib/database";
import type { SeminarInput, SeminarList } from "@/lib/seminars";
import { sendPush } from "@/lib/push";

export async function getSeminars() {
  const db = await getDatabase();
  const [lists, people] = await Promise.all([
    db.collection<SeminarList>("seminars").find({}, { projection: { _id: 0 } }).sort({ subject: 1, createdAt: -1 }).toArray(),
    getPeople(),
  ]);
  const names = new Map(people.map(p => [p.id, p.name]));
  return lists.map(list => ({ ...list, topics: list.topics.map(topic => ({ ...topic,
    studentNames: topic.studentIds.map(id => names.get(id) ?? "Удалённый пользователь"),
  })) }));
}
export async function createSeminar(input: SeminarInput) {
  const list: SeminarList = { ...input, id: randomUUID(), revision: 0, createdAt: new Date().toISOString(),
    topics: input.topics.map(title => ({ id: randomUUID(), title, studentIds: [] })) };
  await (await getDatabase()).collection<SeminarList>("seminars").insertOne(list);
  return list;
}

export async function deleteSeminar(id: string) {
  const result = await (await getDatabase()).collection<SeminarList>("seminars").deleteOne({ id });
  return result.deletedCount === 1;
}

// Compare-and-swap protects both capacity and administrator overrides from concurrent writes.
export async function changeSeminar(input: {
  listId: string; topicId: string; action: "claim" | "release" | "assign";
  studentId?: string; studentIds?: string[]; revision?: number;
}) {
  const collection = (await getDatabase()).collection<SeminarList>("seminars");
  for (let attempt = 0; attempt < 5; attempt++) {
    const list = await collection.findOne({ id: input.listId });
    const topic = list?.topics.find(t => t.id === input.topicId);
    if (!list || !topic) return { error: "Список или тема не найдены", status: 404 };
    if (input.action === "assign" && input.revision !== list.revision)
      return { error: "Записи изменились. Проверь участников и повтори сохранение", status: 409 };
    let ids = topic.studentIds;
    if (input.action === "assign") {
      ids = input.studentIds!;
      if (ids.length > list.capacity) return { error: "Превышен лимит участников темы", status: 400 };
    } else if (input.action === "claim") {
      if (ids.includes(input.studentId!)) return { ok: true };
      if (ids.length >= list.capacity) return { error: "Тема уже занята", status: 409 };
      ids = [...ids, input.studentId!];
    } else {
      ids = ids.filter(id => id !== input.studentId);
    }
    if (input.action !== "release") {
      const active = new Set((await getPeople(true)).map(p => p.id));
      if (ids.some(id => !active.has(id))) return { error: "Выбери действующего пользователя", status: 400 };
    }
    const result = await collection.updateOne({ id: list.id, revision: list.revision }, {
      $set: { topics: list.topics.map(t => t.id === topic.id ? { ...t, studentIds: ids } : t) },
      $inc: { revision: 1 },
    });
    if(result.modifiedCount){if(input.action==="claim"&&topic.studentIds.length){const p=(await getPeople()).find(x=>x.id===input.studentId);void sendPush(topic.studentIds,"seminarParticipants",{title:"Новый участник семинара",body:`${p?.name??"Кто-то"} присоединился к теме «${topic.title}»`,url:"/seminars"})}return{ok:true};}
  }
  return { error: "Записи изменились. Попробуй ещё раз", status: 409 };
}
