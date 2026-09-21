export type AnnouncementAudience = "all" | "selected";

export const DEFAULT_ANNOUNCEMENT_ACCENT = "#5f8f72";
export const DEFAULT_ANNOUNCEMENT_BACKGROUND = "#e8f5ed";

export const ANNOUNCEMENT_COLOR_PRESETS = [
  { id: "mint", label: "Мята", accent: "#4f9272", background: "#e5f4ea" },
  { id: "blue", label: "Синий", accent: "#4d7fa8", background: "#e7f0f8" },
  { id: "violet", label: "Фиолетовый", accent: "#7f69ad", background: "#eee9f8" },
  { id: "amber", label: "Янтарный", accent: "#b57a2b", background: "#fbf0dd" },
  { id: "rose", label: "Розовый", accent: "#b96679", background: "#f9e8ed" },
  { id: "graphite", label: "Графит", accent: "#66716c", background: "#e9edeb" },
] as const;

export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  recipientIds: string[];
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  accentColor?: string;
  backgroundColor?: string;
  createdAt: string;
  updatedAt: string;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeAnnouncementColor(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

export function announcementColors(announcement: Pick<DashboardAnnouncement, "accentColor" | "backgroundColor">) {
  return {
    accentColor: normalizeAnnouncementColor(announcement.accentColor, DEFAULT_ANNOUNCEMENT_ACCENT),
    backgroundColor: normalizeAnnouncementColor(announcement.backgroundColor, DEFAULT_ANNOUNCEMENT_BACKGROUND),
  };
}

export function announcementTextColor(backgroundColor: string) {
  const color = normalizeAnnouncementColor(backgroundColor, DEFAULT_ANNOUNCEMENT_BACKGROUND).slice(1);
  const channel = (part: string) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(color.slice(0, 2))
    + 0.7152 * channel(color.slice(2, 4))
    + 0.0722 * channel(color.slice(4, 6));

  const dark = "#111613";
  const light = "#f7faf8";
  const darkLuminance = 0.007;
  const lightLuminance = 0.956;
  const contrastWithDark = (luminance + 0.05) / (darkLuminance + 0.05);
  const contrastWithLight = (lightLuminance + 0.05) / (luminance + 0.05);
  return contrastWithLight >= contrastWithDark ? light : dark;
}

export function announcementVisibleTo(announcement: DashboardAnnouncement, personId: string, now = Date.now()) {
  if (!announcement.active) return false;
  const start = Date.parse(announcement.startsAt);
  const end = announcement.endsAt ? Date.parse(announcement.endsAt) : null;
  if (Number.isFinite(start) && start > now) return false;
  if (end !== null && Number.isFinite(end) && end < now) return false;
  return announcement.audience === "all" || announcement.recipientIds.includes(personId);
}
