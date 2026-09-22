import { NextRequest, NextResponse } from "next/server";
import { getPeople } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import { sendPush } from "@/lib/push";

export async function POST(request: NextRequest) {
  const actor = await getRoleSessionPerson(request, ["headman", "admin"]);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await request.json().catch(() => null) as { recipients?: unknown; type?: unknown } | null;
  const type = body?.type === "absence" ? "absence" : body?.type === "late" ? "late" : null;
  const requested = Array.isArray(body?.recipients) ? body.recipients.filter((id): id is string => typeof id === "string") : [];
  const people = await getPeople(true);
  const validIds = new Set(people.map(item => item.id));
  const recipients = [...new Set(requested)].filter(id => validIds.has(id) && id !== actor.id).slice(0, 40);
  if (!type || !recipients.length) return NextResponse.json({ error: "Выбери людей и тип напоминания" }, { status: 400 });

  const title = "⚠️ Строгое напоминание";
  const message = type === "late"
    ? "Староста просит не опаздывать: приходи вовремя и предупреждай заранее, если задерживаешься."
    : "Староста просит не пропускать без предупреждения: отметь отсутствие и причину заранее.";
  const delivery = await sendPush(recipients, null, { title, body: message, url: "/" });
  return NextResponse.json({ ok: true, recipients: recipients.length, delivery });
}
