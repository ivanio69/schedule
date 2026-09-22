export const DASHBOARD_SECTION_IDS = ["tomorrow", "summary", "today", "seminars"] as const;
export type DashboardSectionId = (typeof DASHBOARD_SECTION_IDS)[number];

export type DashboardSettings = {
  showAnnouncements: boolean;
  showQuote: boolean;
  order: DashboardSectionId[];
  hidden: DashboardSectionId[];
};

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  showAnnouncements: true,
  showQuote: true,
  order: [...DASHBOARD_SECTION_IDS],
  hidden: [],
};

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  tomorrow: "Завтра",
  summary: "Сводка",
  today: "Сегодня",
  seminars: "Мои семинары",
};

export function normalizeDashboardSettings(value: unknown): DashboardSettings {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const inputOrder = Array.isArray(raw.order) ? raw.order : [];
  const order = [
    ...inputOrder.filter((item): item is DashboardSectionId => typeof item === "string" && DASHBOARD_SECTION_IDS.includes(item as DashboardSectionId)),
    ...DASHBOARD_SECTION_IDS,
  ].filter((item, index, all) => all.indexOf(item) === index) as DashboardSectionId[];
  const hidden = Array.isArray(raw.hidden)
    ? raw.hidden.filter((item): item is DashboardSectionId => typeof item === "string" && DASHBOARD_SECTION_IDS.includes(item as DashboardSectionId))
    : [];
  return {
    showAnnouncements: raw.showAnnouncements !== false,
    showQuote: raw.showQuote !== false,
    order,
    hidden: [...new Set(hidden)],
  };
}
