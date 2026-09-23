import { createHmac, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople, getSchedule } from "@/lib/database";
import versionInfo from "@/version.json";

type CheckStatus = "ok" | "warn" | "error";
type Check = { id: string; label: string; status: CheckStatus; detail: string };
type Note = { id: string; title: string; detail: string };

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const checks: Check[] = [];
  const notes: Note[] = [{
    id: "vercel-build-rate-limit",
    title: "Vercel build rate limiting",
    detail: "При частых preview-деплоях Vercel может отклонить новую сборку с build-rate-limit. Это лимит платформы, а не ошибка кода. После освобождения окна лимита следующий деплой запускается обычно.",
  }];

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

    const [
      people,
      schedule,
      pushSubscriptions,
      rehearsals,
      individualLessons,
      individualSlots,
      seminarLists,
      calendarSubscriptions,
      usageSessions,
      analyticsUsers,
      announcements,
      activeAnnouncements,
      quotes,
      activeQuotes,
      scheduleChanges,
      profileSettings,
      cleanupState,
    ] = await Promise.all([
      getPeople(),
      getSchedule(),
      db.collection("push_subscriptions").find({}, { projection: { _id: 0, personId: 1, updatedAt: 1 } }).toArray(),
      db.collection("rehearsals").countDocuments(),
      db.collection("individual_lessons").countDocuments(),
      db.collection("individual_slots").countDocuments(),
      db.collection("seminars").countDocuments(),
      db.collection("calendar_subscriptions").countDocuments(),
      db.collection("usage_analytics_sessions").countDocuments(),
      db.collection("usage_analytics_users").countDocuments(),
      db.collection("dashboard_announcements").countDocuments(),
      db.collection("dashboard_announcements").countDocuments({ active: true }),
      db.collection("daily_quotes").countDocuments(),
      db.collection("daily_quotes").countDocuments({ active: true }),
      db.collection("schedule_changes").countDocuments(),
      db.collection("profile_settings").countDocuments(),
      db.collection("system_maintenance").findOne({ id: "cleanup" }, { projection: { _id: 0 } }),
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
    const roleCounts = {
      admin: people.filter(person => person.role === "admin").length,
      headman: people.filter(person => person.role === "headman").length,
      user: people.filter(person => person.role !== "admin" && person.role !== "headman").length,
    };

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

    const sessionSecret = Boolean(process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD);
    checks.push({
      id: "role-access",
      label: "Роли и админ-доступ",
      status: !sessionSecret || roleCounts.admin === 0 ? "error" : "ok",
      detail: sessionSecret
        ? `Админов ${roleCounts.admin} · старост ${roleCounts.headman} · пользователей ${roleCounts.user}`
        : "Нет секрета для подписи role-сессии",
    });

    checks.push({
      id: "analytics-data",
      label: "Аналитика",
      status: usageSessions > 0 ? "ok" : "warn",
      detail: `${usageSessions} сессий · ${analyticsUsers} профилей с историей`,
    });

    const cleanupStamp = typeof cleanupState?.lastRunAt === "string" ? Date.parse(cleanupState.lastRunAt) : NaN;
    const cleanupAgeHours = Number.isFinite(cleanupStamp) ? Math.max(0, Math.round((Date.now() - cleanupStamp) / 3_600_000)) : null;
    checks.push({
      id: "automatic-cleanup",
      label: "Автоочистка",
      status: cleanupAgeHours === null || cleanupAgeHours > 48 ? "warn" : "ok",
      detail: cleanupAgeHours === null
        ? "Ещё не запускалась · ежедневный cron запланирован на 03:17 UTC"
        : `Последний запуск ${cleanupAgeHours < 1 ? "меньше часа назад" : cleanupAgeHours + " ч назад"} · удалено ${Number(cleanupState?.totalDeleted ?? 0)} записей`,
    });
    checks.push({
      id: "cron-secret",
      label: "Cron-защита",
      status: process.env.CRON_SECRET ? "ok" : "warn",
      detail: process.env.CRON_SECRET
        ? "CRON_SECRET настроен"
        : "CRON_SECRET не задан · используется резервная проверка production cron-заголовка Vercel",
    });

    checks.push({
      id: "content-data",
      label: "Контент дашборда",
      status: "ok",
      detail: `Объявления ${activeAnnouncements}/${announcements} активных · цитаты ${activeQuotes}/${quotes} активных`,
    });

    const githubToken = Boolean(process.env.GITHUB_TOKEN);
    checks.push({
      id: "github",
      label: "GitHub / DEV",
      status: githubToken ? "ok" : "warn",
      detail: githubToken ? "Токен GitHub доступен для поиска DEV-сборок" : "GITHUB_TOKEN не задан — DEV-поиск может упираться в публичные лимиты",
    });

    const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
    checks.push({
      id: "vercel",
      label: "Vercel",
      status: productionUrl || process.env.VERCEL_ENV !== "production" ? "ok" : "warn",
      detail: `Среда: ${process.env.VERCEL_ENV ?? "local"}${process.env.VERCEL_REGION ? ` · регион ${process.env.VERCEL_REGION}` : ""}${gitSha ? ` · commit ${gitSha.slice(0,7)}` : ""}`,
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
        notes,
        runtime: {
          region: process.env.VERCEL_REGION ?? null,
          commitSha: gitSha || null,
          deploymentUrl: process.env.VERCEL_URL ?? null,
          productionUrl: productionUrl ?? null,
          node: process.version,
          uptimeSeconds: Math.round(process.uptime()),
        },
        roles: roleCounts,
        cleanup: cleanupState ? {
          lastRunAt: typeof cleanupState.lastRunAt === "string" ? cleanupState.lastRunAt : null,
          totalDeleted: Number(cleanupState.totalDeleted ?? 0),
          counts: cleanupState.counts ?? {},
        } : null,
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
          usageSessions,
          analyticsUsers,
          announcements,
          activeAnnouncements,
          quotes,
          activeQuotes,
          scheduleChanges,
          profileSettings,
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
        notes,
        runtime: null,
        roles: null,
        counts: null,
      },
    }, { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
