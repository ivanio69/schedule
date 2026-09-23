import { getDatabase, getPeople } from "@/lib/database";
import type { DashboardAnnouncement } from "@/lib/announcements";

export type ManagedAnnouncement = DashboardAnnouncement & { acknowledgementCount: number; recipientCount: number };

export async function decorateAnnouncementsWithAcknowledgements(items: DashboardAnnouncement[]): Promise<ManagedAnnouncement[]> {
  if (!items.length) return [];
  const [people, acknowledgements] = await Promise.all([
    getPeople(true),
    (await getDatabase()).collection("announcement_acknowledgements").find({ announcementId: { $in: items.map(item => item.id) } }, { projection: { _id: 0, announcementId: 1, personId: 1 } }).toArray(),
  ]);
  const activeIds = new Set(people.map(person => person.id));
  const byAnnouncement = new Map<string, Set<string>>();
  for (const row of acknowledgements) {
    const announcementId = typeof row.announcementId === "string" ? row.announcementId : "";
    const personId = typeof row.personId === "string" ? row.personId : "";
    if (!announcementId || !personId) continue;
    const set = byAnnouncement.get(announcementId) ?? new Set<string>();
    set.add(personId);
    byAnnouncement.set(announcementId, set);
  }
  return items.map(item => {
    const targets = item.audience === "all" ? people.map(person => person.id) : item.recipientIds.filter(id => activeIds.has(id));
    const targetSet = new Set(targets);
    const acknowledgementCount = [...(byAnnouncement.get(item.id) ?? new Set<string>())].filter(id => targetSet.has(id)).length;
    return { ...item, acknowledgementCount, recipientCount: targets.length };
  });
}
