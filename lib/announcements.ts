export type AnnouncementAudience = "all" | "selected";

export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  recipientIds: string[];
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function announcementVisibleTo(announcement: DashboardAnnouncement, personId: string, now = Date.now()) {
  if (!announcement.active) return false;
  const start = Date.parse(announcement.startsAt);
  const end = announcement.endsAt ? Date.parse(announcement.endsAt) : null;
  if (Number.isFinite(start) && start > now) return false;
  if (end !== null && Number.isFinite(end) && end < now) return false;
  return announcement.audience === "all" || announcement.recipientIds.includes(personId);
}
