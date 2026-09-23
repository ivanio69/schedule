import { getDatabase, getPeople } from "@/lib/database";

export type CleanupCounts = {
  authCodes: number;
  telegramLinks: number;
  attendanceReports: number;
  announcements: number;
  rehearsalDrafts: number;
  analyticsSessions: number;
  orphanPushSubscriptions: number;
};

export type CleanupResult = {
  startedAt: string;
  lastRunAt: string;
  totalDeleted: number;
  counts: CleanupCounts;
};

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

export async function runAutomaticCleanup(now = new Date()): Promise<CleanupResult> {
  const db = await getDatabase();
  const startedAt = now.toISOString();
  const today = startedAt.slice(0, 10);
  const oneDayAgo = daysAgo(now, 1);
  const sevenDaysAgo = daysAgo(now, 7);
  const thirtyDaysAgo = daysAgo(now, 30);
  const analyticsCutoff = daysAgo(now, 180);
  const people = await getPeople(false);
  const activeIds = people.filter(person => person.active).map(person => person.id);

  const [authCodes, telegramLinks, attendanceReports, announcements, rehearsalDrafts, analyticsSessions, orphanPushSubscriptions] = await Promise.all([
    db.collection("auth_codes").deleteMany({ $or: [{ expiresAt: { $lt: startedAt } }, { usedAt: { $lt: oneDayAgo } }] }),
    db.collection("auth_telegram_links").deleteMany({ $or: [{ expiresAt: { $lt: startedAt } }, { linkedAt: { $lt: oneDayAgo } }] }),
    db.collection("attendance_reports").deleteMany({ dateTo: { $lt: today } }),
    db.collection("dashboard_announcements").deleteMany({ endsAt: { $type: "string", $lt: thirtyDaysAgo } }),
    db.collection("rehearsal_drafts").deleteMany({ updatedAt: { $lt: thirtyDaysAgo } }),
    db.collection("usage_analytics_sessions").deleteMany({ lastSeenAt: { $lt: analyticsCutoff } }),
    db.collection("push_subscriptions").deleteMany({ personId: { $nin: activeIds }, updatedAt: { $lt: sevenDaysAgo } }),
  ]);

  const counts: CleanupCounts = {
    authCodes: authCodes.deletedCount,
    telegramLinks: telegramLinks.deletedCount,
    attendanceReports: attendanceReports.deletedCount,
    announcements: announcements.deletedCount,
    rehearsalDrafts: rehearsalDrafts.deletedCount,
    analyticsSessions: analyticsSessions.deletedCount,
    orphanPushSubscriptions: orphanPushSubscriptions.deletedCount,
  };
  const totalDeleted = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const result: CleanupResult = { startedAt, lastRunAt: new Date().toISOString(), totalDeleted, counts };
  await db.collection("system_maintenance").updateOne({ id: "cleanup" }, { $set: { id: "cleanup", ...result } }, { upsert: true });
  return result;
}
