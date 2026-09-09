import { NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal } from "@/lib/database";
import type { Rehearsal } from "@/lib/schedule";

function validTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validPayload(value: unknown): value is Omit<Rehearsal, "id" | "createdAt"> {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<Rehearsal>;
  return typeof input.creatorId === "string" && input.creatorId.length >= 8 && input.creatorId.length <= 128
    && typeof input.title === "string" && input.title.trim().length >= 1 && input.title.trim().length <= 120
    && typeof input.auditorium === "string" && input.auditorium.trim().length <= 80
    && validTime(input.timeStart) && validTime(input.timeEnd)
    && Number.isInteger(input.week) && input.week >= 1 && input.week <= 100
    && Number.isInteger(input.day) && input.day >= 0 && input.day <= 5;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!validPayload(body)) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });
    if (body.timeStart >= body.timeEnd) return NextResponse.json({ error: "Время окончания должно быть позже начала" }, { status: 400 });

    const rehearsal = await createRehearsal({
      ...body,
      title: body.title.trim(),
      auditorium: body.auditorium.trim(),
    });
    return NextResponse.json({ rehearsal }, { status: 201 });
  } catch (error) {
    console.error("Failed to create rehearsal", error);
    return NextResponse.json({ error: "Не удалось создать репетицию" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const creatorId = url.searchParams.get("creatorId");
    if (!id || !creatorId) return NextResponse.json({ error: "Не хватает данных" }, { status: 400 });
    const deleted = await deleteRehearsal(id, creatorId);
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Репетиция не найдена" }, { status: 404 });
  } catch (error) {
    console.error("Failed to delete rehearsal", error);
    return NextResponse.json({ error: "Не удалось удалить репетицию" }, { status: 500 });
  }
}
