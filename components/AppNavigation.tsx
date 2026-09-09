"use client";

import { usePathname } from "next/navigation";

export default function AppNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <style jsx global>{`
        .app-navigation{position:sticky;top:12px;z-index:100;display:grid;grid-template-columns:1fr 1.5fr;gap:4px;width:min(calc(100% - 32px),520px);margin:12px auto -18px;padding:4px;border:1px solid #27272c;border-radius:14px;background:rgba(17,17,20,.88);backdrop-filter:blur(14px);box-shadow:0 12px 35px rgba(0,0,0,.22)}
        .app-navigation a{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:10px;color:#94949d;text-decoration:none;font-size:12px;font-weight:750;transition:.18s ease}
        .app-navigation a:hover{color:#f5f5f5;background:#18181c}.app-navigation a.is-active{color:#111114;background:#f2f2f2}
        .dashboard-switcher,.quick-app-nav{display:none!important}
        .rehearsals-toolbar{width:min(calc(100% - 32px),980px);margin:30px auto -18px;display:flex;justify-content:flex-end}
        @view-transition{navigation:auto}
        ::view-transition-old(root){animation:page-out .18s ease both}
        ::view-transition-new(root){animation:page-in .28s ease both}
        @keyframes page-out{to{opacity:0;transform:translateY(-8px)}}
        @keyframes page-in{from{opacity:0;transform:translateY(10px)}}
        @media(max-width:600px){.app-navigation{width:min(calc(100% - 20px),520px);top:8px;margin-bottom:-8px}.app-navigation a{min-height:42px}.rehearsals-toolbar{width:min(calc(100% - 20px),980px);margin-top:24px}}
      `}</style>
      <nav className="app-navigation" aria-label="Основные разделы">
        <a className={pathname === "/" ? "is-active" : ""} href="/">Дашборд</a>
        <a className={pathname === "/schedule" ? "is-active" : ""} href="/schedule">Полное расписание</a>
      </nav>
    </>
  );
}
