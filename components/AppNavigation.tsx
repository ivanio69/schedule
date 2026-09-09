"use client";

import { usePathname } from "next/navigation";

export default function AppNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="app-navigation" aria-label="Основные разделы">
      <a className={pathname === "/" ? "is-active" : ""} href="/">Дашборд</a>
      <a className={pathname === "/schedule" ? "is-active" : ""} href="/schedule">Полное расписание</a>
    </nav>
  );
}
