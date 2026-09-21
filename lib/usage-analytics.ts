import { getDatabase, getPeople } from "@/lib/database";

export type UsageRoute = "dashboard" | "schedule" | "seminars" | "individuals" | "settings" | "rehearsal-editor" | "other";
export type UsageDevice = "mobile" | "tablet" | "desktop";
export type UsageMode = "pwa" | "browser";
export type UsageEvent =
  | { type: "start"; personId: string; sessionId: string; device: UsageDevice; mode: UsageMode }
  | { type: "pageview"; personId: string; sessionId: string; route: UsageRoute; device: UsageDevice; mode: UsageMode }
  | { type: "heartbeat"; personId: string; sessionId: string; seconds: number; device: UsageDevice; mode: UsageMode };

type UsageUserDocument = {
  _id: string;
  personId: string;
  sessions?: number;
  totalActiveSeconds?: number;
  pageViews?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastRoute?: UsageRoute;
  activeDays?: string[];
  deviceCounts?: Partial<Record<UsageDevice, number>>;
  modeCounts?: Partial<Record<UsageMode, number>>;
  routeViews?: Partial<Record<UsageRoute, number>>;
};

type UsageSessionDocument = {
  _id: string;
  personId: string;
  startedAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  pageViews: number;
  device: UsageDevice;
  mode: UsageMode;
};

const ROUTES: UsageRoute[] = ["dashboard","schedule","seminars","individuals","settings","rehearsal-editor","other"];
const DEVICES: UsageDevice[] = ["mobile","tablet","desktop"];
const MODES: UsageMode[] = ["pwa","browser"];

const safeRoute = (value: unknown): UsageRoute => ROUTES.includes(value as UsageRoute) ? value as UsageRoute : "other";
const safeDevice = (value: unknown): UsageDevice => DEVICES.includes(value as UsageDevice) ? value as UsageDevice : "desktop";
const safeMode = (value: unknown): UsageMode => MODES.includes(value as UsageMode) ? value as UsageMode : "browser";
const validId = (value: unknown, max = 120) => typeof value === "string" && value.length > 0 && value.length <= max;

async function ensureSession(input: UsageEvent) {
  const db = await getDatabase();
  const sessions = db.collection<UsageSessionDocument>("usage_analytics_sessions");
  const users = db.collection<UsageUserDocument>("usage_analytics_users");
  const existing = await sessions.findOne({ _id: input.sessionId }, { projection: { personId: 1 } });
  if (existing) return existing.personId === input.personId ? { db, sessions, users, isNew: false } : null;

  const person = await db.collection("people").findOne({ id: input.personId, active: true }, { projection: { _id: 1 } });
  if (!person) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  const day = nowIso.slice(0, 10);
  const device = safeDevice(input.device);
  const mode = safeMode(input.mode);

  try {
    await sessions.insertOne({
      _id: input.sessionId,
      personId: input.personId,
      startedAt: nowIso,
      lastSeenAt: nowIso,
      activeSeconds: 0,
      pageViews: 0,
      device,
      mode,
    });
  } catch {
    const raced = await sessions.findOne({ _id: input.sessionId }, { projection: { personId: 1 } });
    if (!raced || raced.personId !== input.personId) return null;
    return { db, sessions, users, isNew: false };
  }

  await users.updateOne(
    { _id: input.personId },
    {
      $setOnInsert: { personId: input.personId, firstSeenAt: nowIso },
      $set: { lastSeenAt: nowIso },
      $inc: { sessions: 1, [`deviceCounts.${device}`]: 1, [`modeCounts.${mode}`]: 1 },
      $addToSet: { activeDays: day },
    },
    { upsert: true },
  );
  return { db, sessions, users, isNew: true };
}

export async function recordUsageEvent(raw: UsageEvent) {
  if (!validId(raw.personId, 100) || !validId(raw.sessionId, 100)) return false;
  const input = { ...raw, device: safeDevice(raw.device), mode: safeMode(raw.mode) } as UsageEvent;
  const context = await ensureSession(input);
  if (!context) return false;

  const nowIso = new Date().toISOString();
  const day = nowIso.slice(0, 10);
  const { sessions, users } = context;

  if (input.type === "start") {
    if (!context.isNew) {
      await Promise.all([
        sessions.updateOne({ _id: input.sessionId, personId: input.personId }, { $set: { lastSeenAt: nowIso } }),
        users.updateOne({ _id: input.personId }, { $set: { lastSeenAt: nowIso }, $addToSet: { activeDays: day } }),
      ]);
    }
    return true;
  }

  if (input.type === "heartbeat") {
    const seconds = Math.max(1, Math.min(60, Math.round(Number(input.seconds) || 0)));
    await Promise.all([
      sessions.updateOne({ _id: input.sessionId, personId: input.personId }, { $set: { lastSeenAt: nowIso }, $inc: { activeSeconds: seconds } }),
      users.updateOne({ _id: input.personId }, { $set: { lastSeenAt: nowIso }, $inc: { totalActiveSeconds: seconds }, $addToSet: { activeDays: day } }),
    ]);
    return true;
  }

  const route = safeRoute(input.route);
  await Promise.all([
    sessions.updateOne({ _id: input.sessionId, personId: input.personId }, { $set: { lastSeenAt: nowIso }, $inc: { pageViews: 1 } }),
    users.updateOne(
      { _id: input.personId },
      {
        $set: { lastSeenAt: nowIso, lastRoute: route },
        $inc: { pageViews: 1, [`routeViews.${route}`]: 1 },
        $addToSet: { activeDays: day },
      },
    ),
  ]);
  return true;
}

export async function deleteUsageAnalyticsForPerson(personId: string) {
  const db = await getDatabase();
  await Promise.all([
    db.collection("usage_analytics_users").deleteOne({ _id: personId }),
    db.collection("usage_analytics_sessions").deleteMany({ personId }),
  ]);
}

export async function getUsageAnalyticsReport() {
  const db = await getDatabase();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since14 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [people, userDocs, recentByPerson, dailyRows] = await Promise.all([
    getPeople(),
    db.collection<UsageUserDocument>("usage_analytics_users").find({}).toArray(),
    db.collection<UsageSessionDocument>("usage_analytics_sessions").aggregate<{ _id: string; sessions: number; activeSeconds: number }>([
      { $match: { startedAt: { $gte: since7 } } },
      { $group: { _id: "$personId", sessions: { $sum: 1 }, activeSeconds: { $sum: "$activeSeconds" } } },
    ]).toArray(),
    db.collection<UsageSessionDocument>("usage_analytics_sessions").aggregate<{ _id: string; sessions: number; activeSeconds: number; users: string[] }>([
      { $match: { startedAt: { $gte: `${since14}T00:00:00.000Z` } } },
      { $group: { _id: { $substrBytes: ["$startedAt", 0, 10] }, sessions: { $sum: 1 }, activeSeconds: { $sum: "$activeSeconds" }, users: { $addToSet: "$personId" } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  const docs = new Map(userDocs.map(item => [item._id, item]));
  const recent = new Map(recentByPerson.map(item => [item._id, item]));
  const routeTotals = Object.fromEntries(ROUTES.map(route => [route, 0])) as Record<UsageRoute, number>;

  for (const item of userDocs) {
    for (const route of ROUTES) routeTotals[route] += item.routeViews?.[route] ?? 0;
  }

  const users = people.map(person => {
    const item = docs.get(person.id);
    const last7 = recent.get(person.id);
    const routeViews = item?.routeViews ?? {};
    const favoriteRoute = ROUTES.reduce<UsageRoute | null>((best, route) => {
      if (!best) return (routeViews[route] ?? 0) > 0 ? route : null;
      return (routeViews[route] ?? 0) > (routeViews[best] ?? 0) ? route : best;
    }, null);
    const sessions = item?.sessions ?? 0;
    const totalActiveSeconds = item?.totalActiveSeconds ?? 0;
    return {
      personId: person.id,
      name: person.name,
      active: person.active,
      sessions,
      totalActiveSeconds,
      averageSessionSeconds: sessions ? Math.round(totalActiveSeconds / sessions) : 0,
      pageViews: item?.pageViews ?? 0,
      activeDays: item?.activeDays?.length ?? 0,
      firstSeenAt: item?.firstSeenAt ?? null,
      lastSeenAt: item?.lastSeenAt ?? null,
      favoriteRoute,
      deviceCounts: item?.deviceCounts ?? {},
      modeCounts: item?.modeCounts ?? {},
      sessions7d: last7?.sessions ?? 0,
      activeSeconds7d: last7?.activeSeconds ?? 0,
    };
  }).sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") || a.name.localeCompare(b.name, "ru"));

  const totalSessions = users.reduce((sum, item) => sum + item.sessions, 0);
  const totalActiveSeconds = users.reduce((sum, item) => sum + item.totalActiveSeconds, 0);
  const totalPageViews = users.reduce((sum, item) => sum + item.pageViews, 0);
  const activeUsers7d = users.filter(item => item.sessions7d > 0).length;
  const trackedUsers = users.filter(item => item.sessions > 0).length;
  const returningUsers = users.filter(item => item.sessions > 1).length;

  const dailyMap = new Map(dailyRows.map(row => [row._id, row]));
  const daily = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.now() - (13 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const row = dailyMap.get(date);
    return { date, sessions: row?.sessions ?? 0, activeSeconds: row?.activeSeconds ?? 0, activeUsers: row?.users?.length ?? 0 };
  });

  const topRoutes = ROUTES.map(route => ({ route, views: routeTotals[route] })).filter(item => item.views > 0).sort((a, b) => b.views - a.views);

  return {
    summary: {
      trackedUsers,
      totalUsers: people.length,
      activeUsers7d,
      totalSessions,
      totalActiveSeconds,
      averageSessionSeconds: totalSessions ? Math.round(totalActiveSeconds / totalSessions) : 0,
      totalPageViews,
      returningUsers,
    },
    users,
    daily,
    topRoutes,
  };
}
