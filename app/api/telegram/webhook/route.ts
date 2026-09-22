import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { authHmac, safeEqualHex } from "@/lib/auth-session";
import { sendTelegramMessage, telegramWebhookSecret } from "@/lib/telegram";
import type { Person } from "@/lib/people";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string; first_name?: string };
  };
};
type LinkDoc = {
  id:string;
  personId:string;
  tokenHash:string;
  expectedUsername:string;
  expiresAt:string;
  linkedAt?:string;
};

export async function POST(request: NextRequest) {
  const expectedSecret = telegramWebhookSecret();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expectedSecret || !receivedSecret || expectedSecret !== receivedSecret) {
    return NextResponse.json({ ok:false }, { status:401 });
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  const text = update?.message?.text?.trim() ?? "";
  const match = text.match(/^\/start(?:@\w+)?\s+link_([A-Za-z0-9_-]+)$/);
  if (!match) return NextResponse.json({ ok:true });

  const chatId = update?.message?.chat?.id;
  const telegramUserId = update?.message?.from?.id;
  const username = update?.message?.from?.username?.toLowerCase() ?? "";
  if (!chatId || !telegramUserId) return NextResponse.json({ ok:true });

  const db = await getDatabase();
  const tokenHash = authHmac("telegram-link:" + match[1]);
  const link = await db.collection<LinkDoc>("auth_telegram_links").findOne({ tokenHash });
  if (!link || link.expiresAt <= new Date().toISOString()) {
    await sendTelegramMessage(String(chatId), "⌛ <b>Ссылка для привязки истекла</b>\n\nВернись в приложение и запроси новую.");
    return NextResponse.json({ ok:true });
  }

  if (!username || username !== link.expectedUsername) {
    await sendTelegramMessage(String(chatId), "⚠️ <b>Не удалось привязать Telegram</b>\n\nИмя пользователя этого аккаунта не совпадает с именем пользователя, указанным для выбранного профиля. Проверь аккаунт или обратись к администратору.");
    return NextResponse.json({ ok:true });
  }

  const now = new Date().toISOString();
  await db.collection<Person>("people").updateOne(
    { id:link.personId, active:true },
    { $set:{ telegramChatId:String(chatId), telegramUserId:String(telegramUserId), telegramLinkedAt:now } },
  );
  await db.collection<LinkDoc>("auth_telegram_links").updateOne({ id:link.id }, { $set:{ linkedAt:now } });
  await sendTelegramMessage(String(chatId), "✅ <b>Telegram привязан</b>\n\nТеперь коды входа в <b>Расписание 214Р</b> будут приходить сюда. Вернись в приложение — первый код отправится автоматически.");
  return NextResponse.json({ ok:true });
}
