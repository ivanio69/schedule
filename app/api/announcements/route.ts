import { NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import { announcementVisibleTo, type DashboardAnnouncement } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId");
    if (!personId || personId.length > 128) return NextResponse.json({ announcements: [] }, { headers: { "Cache-Control": "no-store" } });
    const people = await getPeople(true);
    if (!people.some(person => person.id === personId)) return NextResponse.json({ announcements: [] }, { headers: { "Cache-Control": "no-store" } });
    const db = await getDatabase();
    const announcements = await db.collection<DashboardAnnouncement>("dashboard_announcements")
      .find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(30).toArray();
    const visible = announcements.filter(item => announcementVisibleTo(item, personId));
    const acknowledgements = visible.length
      ? await db.collection("announcement_acknowledgements")
          .find({ personId, announcementId: { $in: visible.map(item => item.id) } }, { projection: { _id: 0, announcementId: 1, acknowledgedAt: 1 } })
          .toArray()
      : [];
    const acknowledgedById = new Map(acknowledgements.map(item => [
      typeof item.announcementId === "string" ? item.announcementId : "",
      typeof item.acknowledgedAt === "string" ? item.acknowledgedAt : null,
    ]));
    return NextResponse.json(
      { announcements: visible.map(item => ({ ...item, acknowledgedAt: acknowledgedById.get(item.id) ?? null })) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to load dashboard announcements", error);
    return NextResponse.json({ announcements: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
