import { NextResponse } from "next/server";
import { buildPersonalCalendar, ensureCalendarSubscription, getCalendarSubscription, resolveCalendarSubscription, revokeCalendarSubscription } from "@/lib/apple-calendar";
import { getPeople } from "@/lib/database";

export const dynamic = "force-dynamic";

function validPersonId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 128;
}

function subscriptionUrl(request: Request, token: string) {
  const url = new URL("/api/calendar/apple", request.url);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (token) {
      const subscription = await resolveCalendarSubscription(token);
      if (!subscription) return new NextResponse("Calendar not found", { status: 404 });
      const content = await buildPersonalCalendar(subscription.personId);
      if (!content) return new NextResponse("Calendar not found", { status: 404 });
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="schedule-214r.ics"',
          "Cache-Control": "private, no-store",
        },
      });
    }

    const personId = url.searchParams.get("personId");
    if (!validPersonId(personId)) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
    const existing = await getCalendarSubscription(personId);
    return NextResponse.json(
      { enabled: Boolean(existing), url: existing ? subscriptionUrl(request, existing.token) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load Apple Calendar subscription", error);
    return NextResponse.json({ error: "Не удалось загрузить подписку календаря" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !validPersonId(body.personId)) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
    const people = await getPeople(true);
    if (!people.some(person => person.id === body.personId)) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    const subscription = await ensureCalendarSubscription(body.personId, body.rotate === true);
    return NextResponse.json(
      { enabled: true, url: subscriptionUrl(request, subscription.token) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to create Apple Calendar subscription", error);
    return NextResponse.json({ error: "Не удалось создать ссылку календаря" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !validPersonId(body.personId)) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
    await revokeCalendarSubscription(body.personId);
    return NextResponse.json({ enabled: false });
  } catch (error) {
    console.error("Failed to revoke Apple Calendar subscription", error);
    return NextResponse.json({ error: "Не удалось отключить календарь" }, { status: 500 });
  }
}
