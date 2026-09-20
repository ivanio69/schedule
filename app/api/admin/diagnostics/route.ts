import { createHmac, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople, getSchedule } from "@/lib/database";
import versionInfo from "@/version.json";

type CheckStatus = "ok" | "warn" | "error";
type Check = { id: string; label: string; status: CheckStatus; detail: string };

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });

  const checks: Check[] = [];
  try {
    const db = await getDatabase();
    const pingStarted = performance.now();
    await db.command({ ping: 1 });
    const databaseLatencyMs = Math.max(0, Math.round(performance.now() - pingStarted));
    checks.push({
      id: "database",
      label: "MongoDB",
      status: databaseLatencyMs > 800 ? "warn" : "ok",
      detail: `Доступна · ping ${databaseLatencyMs} мс`,
    });

    const [people, schedule, pushSubscriptions, rehearsals, individualLessons, individualSlots, seminarLists, calendarSubscriptions] = await Promise.all([
      getPeople(),
      getSchedule(),
      db.collection("push_subscriptions").find({}, { projection: { _id: 0, personId: 1, updatedAt: 1 } }).toArray(),
      db.collection("rehearsals").countDocuments(),
      db.collection("individual_lessons").countDocuments(),
      db.collection("individual_slots").countDocuments(),
      db.collection("seminars").countDocuments(),
      db.collection("calendar_subscriptions").countDocuments(),
    ]);

    const activeIds = new Set(people.filter(person => person.active).map(person => person.id));
    const orphanPush = pushSubscriptions.filter(item => typeof item.personId !== "string" || !activeIds.has(item.personId)).length;
    const staleBefore = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const stalePush = pushSubscriptions.filter(item => {
      const stamp = typeof item.updatedAt === "string" ? Date.parse(item.updatedAt) : NaN;
      return !Number.isFinite(stamp) || stamp < staleBefore;
    }).length;
    const pushUsers = new Set(pushSubscriptions.map(item => item.personId).filter((id): id is string => typeof id === "string" && activeIds.has(id))).size;
    const lessons = schedule.days.reduce((total, day) => total + day.table.length, 0);

    const vapidPublic = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const vapidPrivate = Boolean(process.env.VAPID_PRIVATE_KEY);
    checks.push({
      id: "push-config",
      label: "Web Push",
      status: vapidPublic && vapidPrivate ? "ok" : "error",
      detail: vapidPublic && vapidPrivate ? "VAPID настроен" : "Не хватает публичного или приватного VAPID-ключа",
    });
    checks.push({
      id: "push-data",
      label: "Push-подписки",
      status: orphanPush > 0 || stalePush > Math.max(3, Math.floor(pushSubscriptions.length / 2)) ? "warn" : "ok",
      detail: `${pushSubscriptions.length} устройств · ${pushUsers} активных пользователей · устаревших ${stalePush} · без активного профиля ${orphanPush}`,
    });

    const adminSecret = Boolean(process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD);
    checks.push({
      id: "admin-secret",
      label: "Админ-сессия",
      status: adminSecret ? "ok" : "error",
      detail: adminSecret ? "Секрет сессии настроен" : "Нет ADMIN_SESSION_SECRET / ADMIN_PASSWORD",
    });

    const githubToken = Boolean(process.env.GITHUB_TOKEN);
    checks.push({
      id: "github",
      label: "GitHub / DEV",
      status: githubToken ? "ok" : "warn",
      detail: githubToken ? "Токен GitHub доступен для поиска DEV-сборок" : "GITHUB_TOKEN не задан — DEV-поиск может упираться в публичные лимиты",
    });

    const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    checks.push({
      id: "vercel",
      label: "Vercel",
      status: productionUrl || process.env.VERCEL_ENV !== "production" ? "ok" : "warn",
      detail: `Среда: ${process.env.VERCEL_ENV ?? "local"}${process.env.VERCEL_REGION ? ` · регион ${process.env.VERCEL_REGION}` : ""}${productionUrl ? " · production URL найден" : ""}`,
    });

    return NextResponse.json({
      diagnostics: {
        generatedAt: new Date().toISOString(),
        version: process.env.VERCEL_ENV === "preview" ? `${versionInfo.release}.dev${versionInfo.dev}` : versionInfo.release,
        release: versionInfo.release,
        pr: versionInfo.pr,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
        databaseLatencyMs,
        checks,
        counts: {
          people: people.length,
          activePeople: activeIds.size,
          lessons,
          rehearsals,
          individualLessons,
          individualSlots,
          seminarLists,
          pushSubscriptions: pushSubscriptions.length,
          pushUsers,
          calendarSubscriptions,
        },
      },
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Failed to build diagnostics", error);
    checks.push({ id: "runtime", label: "Сервер", status: "error", detail: "Не удалось собрать диагностику" });
    return NextResponse.json({
      diagnostics: {
        generatedAt: new Date().toISOString(),
        version: versionInfo.release,
        release: versionInfo.release,
        pr: versionInfo.pr,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
        databaseLatencyMs: null,
        checks,
        counts: null,
      },
    }, { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
