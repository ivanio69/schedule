"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNavigation(){
 const pathname=usePathname();
 if(pathname.startsWith("/admin")) return null;
 const logout=()=>{localStorage.removeItem("schedule_person_id");window.location.href="/";};
 return <>
  {pathname==="/"&&<button type="button" className="dashboard-logout" onClick={logout}>Выйти</button>}
  <nav className="app-navigation" aria-label="Основные разделы">
   <Link className={pathname==="/"?"is-active":""} href="/">Сегодня</Link>
   <Link className={pathname==="/schedule"?"is-active":""} href="/schedule">Полное расписание</Link>
   <Link className={pathname==="/individual-slots"?"is-active":""} href="/individual-slots">Индивидуальные</Link>
   <Link className={pathname==="/seminars"?"is-active":""} href="/seminars">Семинары</Link>
   <Link className={pathname==="/settings"?"is-active":""} href="/settings">Настройки</Link>
   <style jsx global>{`
    @view-transition { navigation: auto; }
    ::view-transition-old(root){animation:page-out .16s ease both}
    ::view-transition-new(root){animation:page-in .24s ease both}
    @keyframes page-out{to{opacity:0;transform:translateY(-5px)}}
    @keyframes page-in{from{opacity:0;transform:translateY(7px)}}
    @media (prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none!important}}
    .app-navigation{position:sticky;top:12px;z-index:100;display:grid;grid-template-columns:1fr 1.25fr 1.1fr 1fr 1fr;gap:4px;width:min(calc(100% - 32px),820px);margin:12px auto -18px;padding:4px;border:1px solid #27272c;border-radius:14px;background:rgba(17,17,20,.88);backdrop-filter:blur(14px)}
    .app-navigation a{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:10px;color:#94949d;text-decoration:none;font-size:12px;font-weight:750;transition:color .18s ease,background .18s ease,transform .18s ease}
    .app-navigation a:hover{color:#f5f5f5;transform:translateY(-1px)}
    .app-navigation a.is-active{color:#111114;background:#f2f2f2}
    .dashboard-switcher,.quick-app-nav,.bottom-nav{display:none!important}
    .dashboard-logout{position:absolute;top:70px;right:max(14px,calc((100% - 980px)/2));z-index:90;border:1px solid #27272c;border-radius:10px;padding:8px 11px;color:#94949d;background:#111114;cursor:pointer;font-size:11px;font-weight:700;transition:color .18s ease,background .18s ease,transform .18s ease}
    .dashboard-logout:hover{color:#f5f5f5;background:#18181c;transform:translateY(-1px)}
    .dashboard-header-actions{display:none!important}
    @media(max-width:700px){.app-navigation{width:calc(100% - 20px);grid-template-columns:repeat(2,1fr)}.app-navigation a{min-height:42px;font-size:11px}.dashboard-logout{top:112px;right:10px}}
   `}</style>
  </nav>
 </>;
}