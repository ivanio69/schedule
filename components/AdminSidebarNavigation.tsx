"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AdminTab = "schedule" | "people" | "individuals" | "seminars" | "rehearsals" | "notifications" | "announcements" | "analytics" | "statistics" | "diagnostics";

type NavItem = {
  value: AdminTab;
  label: string;
  short: string;
  icon: "calendar" | "people" | "person" | "book" | "music" | "bell" | "megaphone" | "analytics" | "chart" | "pulse";
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Управление",
    items: [
      { value: "schedule", label: "Расписание", short: "Расписание", icon: "calendar" },
      { value: "people", label: "Люди", short: "Люди", icon: "people" },
      { value: "individuals", label: "Индивидуальные", short: "Инд.", icon: "person" },
      { value: "seminars", label: "Семинары", short: "Семинары", icon: "book" },
      { value: "rehearsals", label: "Репетиции", short: "Репетиции", icon: "music" },
    ],
  },
  {
    label: "Коммуникация",
    items: [
      { value: "notifications", label: "Уведомления", short: "Push", icon: "bell" },
      { value: "announcements", label: "Объявления", short: "Объявл.", icon: "megaphone" },
    ],
  },
  {
    label: "Система",
    items: [
      { value: "analytics", label: "Аналитика", short: "Аналитика", icon: "analytics" },
      { value: "statistics", label: "Статистика", short: "Стат.", icon: "chart" },
      { value: "diagnostics", label: "Диагностика", short: "Диагн.", icon: "pulse" },
    ],
  },
];

function Icon({ name }: { name: NavItem["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "calendar") return <svg {...common}><path d="M7 3v3M17 3v3M4.5 8.5h15M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="M8 12h3M13 12h3M8 16h3"/></svg>;
  if (name === "people") return <svg {...common}><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 10a2.5 2.5 0 1 0 0-5"/><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M15 13.5h.8a4.2 4.2 0 0 1 4.2 4.2V20"/></svg>;
  if (name === "person") return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M6 20v-2a6 6 0 0 1 12 0v2M9 15.5h6"/></svg>;
  if (name === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></svg>;
  if (name === "music") return <svg {...common}><path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 5 2 7H4c0-2 2-2 2-7ZM10 20h4"/></svg>;
  if (name === "megaphone") return <svg {...common}><path d="M4 13V9h4l10-4v12L8 13H4Z"/><path d="m8 13 1.5 6h3L11 14"/></svg>;
  if (name === "analytics") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 6 4-3"/></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
  return <svg {...common}><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21"/><path d="M4 4h16v16H4z" opacity=".18"/></svg>;
}

function resolveActive(pathname: string, tab: string | null): AdminTab {
  if (pathname.startsWith("/admin/rehearsals")) return "rehearsals";
  if (pathname.startsWith("/admin/individual")) return "individuals";
  const values = new Set<AdminTab>(["schedule","people","individuals","seminars","rehearsals","notifications","announcements","analytics","statistics","diagnostics"]);
  return values.has(tab as AdminTab) ? tab as AdminTab : "schedule";
}

export default function AdminSidebarNavigation() {
  const pathname = usePathname();
  const [active, setActive] = useState<AdminTab>("schedule");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("admin_sidebar_collapsed") === "1"); } catch {}
  }, []);

  useEffect(() => {
    const sync = () => setActive(resolveActive(window.location.pathname, new URLSearchParams(window.location.search).get("tab")));
    const onAdminTab = (event: Event) => {
      const value = (event as CustomEvent<AdminTab>).detail;
      if (value) setActive(value);
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("admin:tabchange", onAdminTab);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("admin:tabchange", onAdminTab);
    };
  }, [pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, active]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed(value => {
      const next = !value;
      try { localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return <>
    <div className="admin-mobile-bar">
      <button className="admin-nav-burger" type="button" onClick={() => setDrawerOpen(true)} aria-label="Открыть меню администратора" aria-expanded={drawerOpen} aria-controls="admin-sidebar">
        <span/><span/><span/>
      </button>
      <Link href="/admin" className="admin-mobile-brand"><b>214Р</b><span>Админка</span></Link>
      <Link href="/" className="admin-mobile-exit" aria-label="Вернуться в приложение">↗</Link>
    </div>

    <button className={`admin-sidebar-backdrop${drawerOpen ? " is-open" : ""}`} type="button" aria-label="Закрыть меню" onClick={() => setDrawerOpen(false)}/>

    <aside id="admin-sidebar" className={`admin-sidebar${collapsed ? " is-collapsed" : ""}${drawerOpen ? " is-open" : ""}`}>
      <header className="admin-sidebar-head">
        <Link href="/admin" className="admin-sidebar-brand" aria-label="Админка 214Р">
          <span className="admin-sidebar-logo">214Р</span>
          <span className="admin-sidebar-brand-copy"><strong>Админка</strong><small>Панель управления</small></span>
        </Link>
        <button className="admin-sidebar-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"} title={collapsed ? "Развернуть" : "Свернуть"}>
          <span/><span/><span/>
        </button>
        <button className="admin-sidebar-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Закрыть меню">×</button>
      </header>

      <nav className="admin-sidebar-nav" aria-label="Разделы администратора">
        {GROUPS.map(group => <section className="admin-sidebar-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map(item => <Link
            key={item.value}
            href={`/admin?tab=${item.value}`}
            className={active === item.value ? "is-active" : ""}
            aria-current={active === item.value ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            onClick={() => {
              setActive(item.value);
              window.dispatchEvent(new CustomEvent<AdminTab>("admin:tabchange", { detail: item.value }));
            }}
          >
            <span className="admin-sidebar-icon"><Icon name={item.icon}/></span>
            <span className="admin-sidebar-label">{item.label}</span>
            <small>{item.short}</small>
          </Link>)}
        </section>)}
      </nav>

      <footer className="admin-sidebar-footer">
        <Link href="/" title={collapsed ? "В приложение" : undefined}>
          <span className="admin-sidebar-icon">←</span>
          <span className="admin-sidebar-label">В приложение</span>
        </Link>
      </footer>
    </aside>
  </>;
}
