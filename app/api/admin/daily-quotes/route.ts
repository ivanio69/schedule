import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import type { DailyQuote } from "@/lib/daily-quotes";

export const dynamic = "force-dynamic";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const cleanText = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 600) : "";

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const quotes = await (await getDatabase()).collection<DailyQuote>("daily_quotes")
    .find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(300).toArray();
  return NextResponse.json({ quotes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const quoteText = cleanText(body?.text);
  if (!quoteText) return NextResponse.json({ error: "Введи текст цитаты" }, { status: 400 });
  const now = new Date().toISOString();
  const quote: DailyQuote = { id: randomUUID(), text: quoteText, active: true, createdAt: now, updatedAt: now };
  await (await getDatabase()).collection<DailyQuote>("daily_quotes").insertOne(quote);
  return NextResponse.json({ quote });
}

export async function PATCH(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const update: Partial<DailyQuote> = { updatedAt: new Date().toISOString() };
  if (body.text !== undefined) {
    const quoteText = cleanText(body.text);
    if (!quoteText) return NextResponse.json({ error: "Цитата не может быть пустой" }, { status: 400 });
    update.text = quoteText;
  }
  if (typeof body.active === "boolean") update.active = body.active;
  const quote = await (await getDatabase()).collection<DailyQuote>("daily_quotes").findOneAndUpdate(
    { id: body.id },
    { $set: update },
    { returnDocument: "after", projection: { _id: 0 } }
  );
  return quote ? NextResponse.json({ quote }) : NextResponse.json({ error: "Цитата не найдена" }, { status: 404 });
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан ID" }, { status: 400 });
  const db = await getDatabase();
  await Promise.all([
    db.collection<DailyQuote>("daily_quotes").deleteOne({ id }),
    db.collection("daily_quote_selections").deleteMany({ quoteId: id }),
  ]);
  return NextResponse.json({ ok: true });
}
