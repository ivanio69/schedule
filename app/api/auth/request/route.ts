import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import { authConfigured, authHmac } from "@/lib/auth-session";
import { ensureTelegramWebhook, getTelegramBot, sendTelegramMessage, TelegramApiError, telegramConfigured } from "@/lib/telegram";
import type { Person } from "@/lib/people";

export const dynamic = "force-dynamic";

type AuthCodeDoc = {
  id: string;
  personId: string;
  codeHash: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

type TelegramLinkDoc = {
  id: string;
  personId: string;
  tokenHash: string;
  expectedUsername: string;
  createdAt: string;
  expiresAt: string;
  linkedAt?: string;
};

function maskUsername(value: string) {
  if (value.length <= 4) return "@" + value[0] + "***";
  return "@" + value.slice(0,2) + "•••" + value.slice(-2);
}

async function createLink(request: NextRequest, person: Person) {
  if (!person.telegramUsername) {
    return NextResponse.json({ error: "Для этого профиля не указан Telegram username. Обратись к администратору." }, { status: 409 });
  }
  await ensureTelegramWebhook(new URL(request.url).origin);
  const bot = await getTelegramBot();
  if (!bot.username) throw new TelegramApiError("У Telegram-бота нет username", 503);

  const db = await getDatabase();
  const rawToken = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  const link: TelegramLinkDoc = {
    id: randomUUID(),
    personId: person.id,
    tokenHash: authHmac("telegram-link:" + rawToken),
    expectedUsername: person.telegramUsername.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  await db.collection<TelegramLinkDoc>("auth_telegram_links").deleteMany({ personId: person.id });
  await db.collection<TelegramLinkDoc>("auth_telegram_links").insertOne(link);

  return NextResponse.json({
    status: "link_required",
    linkId: link.id,
    botUrl: "https://t.me/" + bot.username + "?start=link_" + rawToken,
    telegram: maskUsername(person.telegramUsername),
    expiresIn: 600,
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!authConfigured() || !telegramConfigured()) {
      return NextResponse.json({ error: "Telegram-вход ещё не настроен на сервере" }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as { personId?: unknown } | null;
    const personId = typeof body?.personId === "string" ? body.personId : "";
    const person = (await getPeople(false)).find(item => item.id === personId && item.active);
    if (!person) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    if (!person.telegramUsername) {
      return NextResponse.json({ error: "Для этого профиля не указан Telegram username. Обратись к администратору." }, { status: 409 });
    }
    if (!person.telegramChatId) return createLink(request, person);

    const db = await getDatabase();
    const now = new Date();
    const nowIso = now.toISOString();
    await Promise.all([
      db.collection<AuthCodeDoc>("auth_codes").deleteMany({ expiresAt: { $lt: nowIso } }),
      db.collection<TelegramLinkDoc>("auth_telegram_links").deleteMany({ expiresAt: { $lt: nowIso } }),
    ]);
    const recent = await db.collection<AuthCodeDoc>("auth_codes").findOne(
      { personId: person.id, createdAt: { $gte: new Date(now.getTime() - 30_000).toISOString() }, usedAt: { $exists: false } },
      { sort: { createdAt: -1 } },
    );
    if (recent) {
      const retryAfter = Math.max(1, Math.ceil((30_000 - (now.getTime() - Date.parse(recent.createdAt))) / 1000));
      return NextResponse.json({ error: "Код уже отправлен. Подожди немного.", retryAfter }, { status: 429 });
    }

    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    const doc: AuthCodeDoc = {
      id,
      personId: person.id,
      codeHash: authHmac("login-code:" + id + ":" + person.id + ":" + code),
      attempts: 0,
      createdAt: nowIso,
      expiresAt: expiresAt.toISOString(),
    };
    await db.collection<AuthCodeDoc>("auth_codes").insertOne(doc);

    try {
      await sendTelegramMessage(
        person.telegramChatId,
        "Код входа в Расписание 214Р: " + code + "\n\nКод действует 10 минут. Никому его не сообщай.",
      );
    } catch (error) {
      await db.collection<AuthCodeDoc>("auth_codes").deleteOne({ id });
      if (error instanceof TelegramApiError && (error.status === 400 || error.status === 403)) {
        await db.collection<Person>("people").updateOne(
          { id: person.id },
          { $unset: { telegramChatId: "", telegramUserId: "", telegramLinkedAt: "" } },
        );
        return createLink(request, { ...person, telegramChatId: undefined, telegramUserId: undefined, telegramLinkedAt: undefined });
      }
      throw error;
    }

    return NextResponse.json({
      status: "code_sent",
      requestId: id,
      telegram: maskUsername(person.telegramUsername),
      expiresIn: 600,
      resendAfter: 30,
    });
  } catch (error) {
    console.error("Failed to request Telegram login", error);
    const message = error instanceof Error ? error.message : "Не удалось отправить код";
    return NextResponse.json({ error: message }, { status: error instanceof TelegramApiError ? error.status : 500 });
  }
}
