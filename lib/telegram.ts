import { createHmac } from "node:crypto";
import { authSecret } from "@/lib/auth-session";

type TelegramUser = { id: number; is_bot: boolean; first_name: string; username?: string };
type TelegramResult<T> = { ok: boolean; result?: T; description?: string };

export class TelegramApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

export function telegramConfigured() {
  return Boolean(botToken() && authSecret());
}

async function telegramApi<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = botToken();
  if (!token) throw new TelegramApiError("Telegram-бот не настроен", 503);
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as TelegramResult<T> | null;
  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new TelegramApiError(data?.description ?? "Ошибка Telegram Bot API", response.status || 502);
  }
  return data.result;
}

export async function getTelegramBot() {
  return telegramApi<TelegramUser>("getMe");
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

export function telegramWebhookSecret() {
  const token = botToken();
  const secret = authSecret();
  if (!token || !secret) return "";
  return createHmac("sha256", secret).update("telegram-webhook:" + token).digest("hex");
}

function webhookBase(origin: string) {
  const explicit = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production && process.env.VERCEL_ENV === "production") return "https://" + production.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return origin.replace(/\/$/, "");
}

export async function ensureTelegramWebhook(origin: string) {
  const secret = telegramWebhookSecret();
  if (!secret) throw new TelegramApiError("Telegram-бот не настроен", 503);
  const url = webhookBase(origin) + "/api/telegram/webhook";
  await telegramApi("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  return url;
}
