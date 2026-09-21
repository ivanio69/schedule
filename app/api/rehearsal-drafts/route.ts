import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import type { RehearsalDraft } from "@/lib/rehearsal-drafts";
import type { RehearsalBlock } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length < 128;
const validDate = (value: unknown) => value === "" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const names = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string")
  ? [...new Set(value.map(item => item.trim()).filter(Boolean))].slice(0, 100)
  : [];
const tags = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string")
  ? [...new Set(value.map(item => item.trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 8)
  : [];
const conflictKeys = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string")
  ? [...new Set(value.map(item => item.trim().slice(0, 320)).filter(Boolean))].slice(0, 250)
  : [];

function blocks(value: unknown): RehearsalBlock[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item): RehearsalBlock[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<RehearsalBlock>;
    const timeStart = validTime(raw.timeStart) ? raw.timeStart : "18:00";
    const timeEnd = validTime(raw.timeEnd) ? raw.timeEnd : "19:00";
    return [{
      id: validId(raw.id) ? raw.id : randomUUID(),
      title: text(raw.title, 120),
      timeStart,
      timeEnd,
      notes: text(raw.notes, 2000),
      participants: names(raw.participants),
    }];
  });
}

async function activeOwner(ownerId: string) {
  return (await getPeople(true)).some(person => person.id === ownerId);
}

export async function GET(request: Request) {
  try {
    const ownerId = new URL(request.url).searchParams.get("personId");
    if (!validId(ownerId) || !await activeOwner(ownerId)) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    const drafts = await (await getDatabase()).collection<RehearsalDraft>("rehearsal_drafts")
      .find({ ownerId }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(20).toArray();
    return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load rehearsal drafts", error);
    return NextResponse.json({ error: "Не удалось загрузить черновики" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    if (!raw || !validId(raw.ownerId) || !await activeOwner(raw.ownerId)) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    const kind = raw.kind === "scheduled" ? "scheduled" : "simple";
    if (!validDate(raw.date)) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    const collection = (await getDatabase()).collection<RehearsalDraft>("rehearsal_drafts");
    const existing = validId(raw.id) ? await collection.findOne({ id: raw.id, ownerId: raw.ownerId }) : null;
    if (raw.id && !existing) return NextResponse.json({ error: "Черновик не найден" }, { status: 404 });
    const now = new Date().toISOString();
    const draft: RehearsalDraft = {
      id: existing?.id ?? randomUUID(),
      ownerId: raw.ownerId,
      kind,
      subject: text(raw.subject, 120),
      responsible: text(raw.responsible, 120),
      date: typeof raw.date === "string" ? raw.date : "",
      notes: text(raw.notes, 2000),
      tags: tags(raw.tags),
      ignoredConflictKeys: conflictKeys(raw.ignoredConflictKeys),
      timeStart: validTime(raw.timeStart) ? raw.timeStart : "18:00",
      timeEnd: validTime(raw.timeEnd) ? raw.timeEnd : "20:00",
      participantMode: raw.participantMode === "blocks" ? "blocks" : "rehearsal",
      participants: names(raw.participants),
      blocks: blocks(raw.blocks),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await collection.replaceOne({ id: draft.id, ownerId: draft.ownerId }, draft, { upsert: true });
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to save rehearsal draft", error);
    return NextResponse.json({ error: "Не удалось сохранить черновик" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const ownerId = url.searchParams.get("personId");
    const id = url.searchParams.get("id");
    if (!validId(ownerId) || !validId(id)) return NextResponse.json({ error: "Некорректный черновик" }, { status: 400 });
    await (await getDatabase()).collection<RehearsalDraft>("rehearsal_drafts").deleteOne({ id, ownerId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete rehearsal draft", error);
    return NextResponse.json({ error: "Не удалось удалить черновик" }, { status: 500 });
  }
}
