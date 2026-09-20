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
    const announcements = await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements")
      .find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(30).toArray();
    return NextResponse.json(
      { announcements: announcements.filter(item => announcementVisibleTo(item, personId)) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to load dashboard announcements", error);
    return NextResponse.json({ announcements: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
