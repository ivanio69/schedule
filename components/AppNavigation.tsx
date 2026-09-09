"use client";
import { usePathname } from "next/navigation";

export default function AppNavigation(){
 const pathname=usePathname();
 if(pathname.startsWith("/admin")) return null;
 const logout=()=>{localStorage.removeItem("schedule_person_id");window.location.href="/";};
 return <>
  {pathname==="/"&&<button type="button" className="dashboard-logout" onClick={logout}>Выйти</button>}
  <nav className="app-navigation" aria-label="Основные разделы">
   <a className={pathname==="/"?"is-active":""} href="/">Дашборд</a>
   <a className={pathname==="/schedule"?"is-active":""} href="/schedule">Полное расписание</a>
   <a className={pathname==="/settings"?"is-active":""} href="/settings">Настройки</a>
   <style jsx global>{`.app-navigation{position:sticky;top:12px;z-index:100;display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:4px;width:min(calc(100% - 32px),620px);margin:12px auto -18px;padding:4px;border:1px solid #27272c;border-radius:14px;background:rgba(17,17,20,.88);backdrop-filter:blur(14px)}.app-navigation a{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:10px;color:#94949d;text-decoration:none;font-size:12px;font-weight:750}.app-navigation a.is-active{color:#111114;background:#f2f2f2}.dashboard-switcher,.quick-app-nav,.bottom-nav{display:none!important}.dashboard-logout{position:absolute;top:70px;right:max(14px,calc((100% - 980px)/2));z-index:90;border:1px solid #27272c;border-radius:10px;padding:8px 11px;color:#94949d;background:#111114;cursor:pointer;font-size:11px;font-weight:700}.dashboard-logout:hover{color:#f5f5f5;background:#18181c}.dashboard-header-actions{display:none!important}@media(max-width:600px){.app-navigation{width:calc(100% - 20px)}.app-navigation a{min-height:42px;font-size:11px}.dashboard-logout{top:64px;right:10px}}`}</style>
  </nav>
 </>;
}