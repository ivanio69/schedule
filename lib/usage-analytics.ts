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
  routeViews?: Partial<Record<UsageRoute, number>>;
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
      routeViews: {},
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
    sessions.updateOne({ _id: input.sessionId, personId: input.personId }, { $set: { lastSeenAt: nowIso }, $inc: { pageViews: 1, [`routeViews.${route}`]: 1 } }),
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

const ANALYTICS_PERIODS = [7,14,30,90] as const;

export async function getUsageAnalyticsReport(requestedDays = 14) {
  const db = await getDatabase();
  const periodDays = ANALYTICS_PERIODS.includes(requestedDays as (typeof ANALYTICS_PERIODS)[number]) ? requestedDays : 14;
  const now = Date.now();
  const sinceIso = new Date(now - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const [people, userDocs, sessionDocs, pushDeviceCounts] = await Promise.all([
    getPeople(),
    db.collection<UsageUserDocument>("usage_analytics_users").find({}).toArray(),
    db.collection<UsageSessionDocument>("usage_analytics_sessions").find({ startedAt: { $gte: sinceIso } }).sort({ startedAt: 1 }).toArray(),
    db.collection("push_subscriptions").aggregate<{ _id: string; devices: number }>([
      { $match: { personId: { $type: "string" } } },
      { $group: { _id: "$personId", devices: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const userDocMap = new Map(userDocs.map(item => [item._id, item]));
  const pushMap = new Map(pushDeviceCounts.map(item => [item._id, item.devices]));
  const perPerson = new Map<string, {
    sessions: number;
    activeSeconds: number;
    pageViews: number;
    activeDays: Set<string>;
    deviceCounts: Partial<Record<UsageDevice, number>>;
    modeCounts: Partial<Record<UsageMode, number>>;
    routeViews: Partial<Record<UsageRoute, number>>;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  }>();
  const routeTotals = Object.fromEntries(ROUTES.map(route => [route, 0])) as Record<UsageRoute, number>;
  const dailyMap = new Map<string, { sessions: number; activeSeconds: number; users: Set<string> }>();

  for (const session of sessionDocs) {
    const current = perPerson.get(session.personId) ?? {
      sessions: 0,
      activeSeconds: 0,
      pageViews: 0,
      activeDays: new Set<string>(),
      deviceCounts: {},
      modeCounts: {},
      routeViews: {},
      firstSeenAt: null,
      lastSeenAt: null,
    };
    current.sessions += 1;
    current.activeSeconds += session.activeSeconds ?? 0;
    current.pageViews += session.pageViews ?? 0;
    current.activeDays.add(session.startedAt.slice(0, 10));
    current.deviceCounts[session.device] = (current.deviceCounts[session.device] ?? 0) + 1;
    current.modeCounts[session.mode] = (current.modeCounts[session.mode] ?? 0) + 1;
    current.firstSeenAt = !current.firstSeenAt || session.startedAt < current.firstSeenAt ? session.startedAt : current.firstSeenAt;
    current.lastSeenAt = !current.lastSeenAt || session.lastSeenAt > current.lastSeenAt ? session.lastSeenAt : current.lastSeenAt;
    for (const route of ROUTES) {
      const views = session.routeViews?.[route] ?? 0;
      current.routeViews[route] = (current.routeViews[route] ?? 0) + views;
      routeTotals[route] += views;
    }
    perPerson.set(session.personId, current);

    const date = session.startedAt.slice(0, 10);
    const daily = dailyMap.get(date) ?? { sessions: 0, activeSeconds: 0, users: new Set<string>() };
    daily.sessions += 1;
    daily.activeSeconds += session.activeSeconds ?? 0;
    daily.users.add(session.personId);
    dailyMap.set(date, daily);
  }

  const users = people.map(person => {
    const period = perPerson.get(person.id);
    const stored = userDocMap.get(person.id);
    const routeViews = period?.routeViews ?? {};
    const favoriteRoute = ROUTES.reduce<UsageRoute | null>((best, route) => {
      if (!best) return (routeViews[route] ?? 0) > 0 ? route : null;
      return (routeViews[route] ?? 0) > (routeViews[best] ?? 0) ? route : best;
    }, null);
    const sessions = period?.sessions ?? 0;
    const totalActiveSeconds = period?.activeSeconds ?? 0;
    return {
      personId: person.id,
      name: person.name,
      active: person.active,
      role: person.role ?? "user",
      sessions,
      totalActiveSeconds,
      averageSessionSeconds: sessions ? Math.round(totalActiveSeconds / sessions) : 0,
      pageViews: period?.pageViews ?? 0,
      activeDays: period?.activeDays.size ?? 0,
      firstSeenAt: period?.firstSeenAt ?? null,
      lastSeenAt: period?.lastSeenAt ?? null,
      lastSeenOverallAt: stored?.lastSeenAt ?? null,
      favoriteRoute,
      deviceCounts: period?.deviceCounts ?? {},
      modeCounts: period?.modeCounts ?? {},
      pushDevices: pushMap.get(person.id) ?? 0,
    };
  }).sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") || a.name.localeCompare(b.name, "ru"));

  const totalSessions = users.reduce((sum, item) => sum + item.sessions, 0);
  const totalActiveSeconds = users.reduce((sum, item) => sum + item.totalActiveSeconds, 0);
  const totalPageViews = users.reduce((sum, item) => sum + item.pageViews, 0);
  const activeUsers = users.filter(item => item.sessions > 0).length;
  const returningUsers = users.filter(item => item.sessions > 1).length;
  const pushUsers = users.filter(item => item.pushDevices > 0).length;
  const pushDevices = users.reduce((sum, item) => sum + item.pushDevices, 0);

  const daily = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(now - (periodDays - 1 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const row = dailyMap.get(date);
    return { date, sessions: row?.sessions ?? 0, activeSeconds: row?.activeSeconds ?? 0, activeUsers: row?.users.size ?? 0 };
  });

  const topRoutes = ROUTES.map(route => ({ route, views: routeTotals[route] }))
    .filter(item => item.views > 0)
    .sort((a, b) => b.views - a.views);

  const pushDevicesByPerson = users
    .map(user => ({ personId: user.personId, name: user.name, active: user.active, devices: user.pushDevices }))
    .sort((a, b) => b.devices - a.devices || a.name.localeCompare(b.name, "ru"));

  return {
    periodDays,
    summary: {
      trackedUsers: activeUsers,
      totalUsers: people.length,
      activeUsers,
      totalSessions,
      totalActiveSeconds,
      averageSessionSeconds: totalSessions ? Math.round(totalActiveSeconds / totalSessions) : 0,
      totalPageViews,
      returningUsers,
      pushUsers,
      pushDevices,
    },
    users,
    daily,
    topRoutes,
    pushDevicesByPerson,
  };
}
