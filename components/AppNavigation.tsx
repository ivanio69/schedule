"use client";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
 { href: "/", label: "Сегодня", icon: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> },
 { href: "/schedule", label: "Полное расписание", icon: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2M7 18h2"/></> },
 { href: "/individual-slots", label: "Индивидуальные занятия", icon: <><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-4M18 12v8m-4-4h8"/></> },
 { href: "/seminars", label: "Семинары", icon: <><path d="M12 6v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v14h-4a6 6 0 0 0-5 3 6 6 0 0 0-5-3H3Z"/></> },
 { href: "/settings", label: "Настройки", icon: <><path d="M4 7h3m4 0h9M4 17h9m4 0h3"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></> },
];

const subscribe = (notify: () => void) => {
 window.addEventListener("storage", notify);
 window.addEventListener("schedule-auth-change", notify);
 return () => {window.removeEventListener("storage", notify);window.removeEventListener("schedule-auth-change", notify);};
};
const getSnapshot = () => Boolean(localStorage.getItem("schedule_person_id"));
const getServerSnapshot = () => false;

export default function AppNavigation(){
 const pathname=usePathname();
 const authenticated=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 useEffect(()=>{document.body.classList.toggle("has-app-navigation",authenticated&&!pathname.startsWith("/admin"));return()=>document.body.classList.remove("has-app-navigation")},[authenticated,pathname]);
 if(pathname.startsWith("/admin") || !authenticated) return null;
 return <nav className="app-navigation" aria-label="Основные разделы">
   {items.map(({href,label,icon}) => {
     const active=pathname===href || (href!=="/" && pathname.startsWith(href+"/"));
     return <Link key={href} className={active?"is-active":""} href={href}
       aria-current={active?"page":undefined} aria-label={label} title={label}>
       <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{icon}</svg>
     </Link>;
   })}
 </nav>;
}
