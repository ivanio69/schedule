"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
 { href: "/", label: "Сегодня", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3M18 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 13h2M14 13h2M8 17h2"/></svg> },
 { href: "/schedule", label: "Полное расписание", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg> },
 { href: "/individual-slots", label: "Индивидуальные", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg> },
 { href: "/settings", label: "Настройки", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1-1.5 2.6-.2-.1a2.3 2.3 0 0 0-2.3 0l-.2.1a2.3 2.3 0 0 0-1.1 2v.2h-3v-.2a2.3 2.3 0 0 0-1.1-2l-.2-.1a2.3 2.3 0 0 0-2.3 0l-.2.1-1.5-2.6.1-.1a2.3 2.3 0 0 0 0-2.3l-.1-.2a2.3 2.3 0 0 0 0-2.3l-.1-.1 1.5-2.6.2.1a2.3 2.3 0 0 0 2.3 0l.2-.1a2.3 2.3 0 0 0 1.1-2V4h3v.2a2.3 2.3 0 0 0 1.1 2l.2.1a2.3 2.3 0 0 0 2.3 0l.2-.1 1.5 2.6-.1.1a2.3 2.3 0 0 0 0 2.3l.1.2a2.3 2.3 0 0 0 0 2.3Z"/></svg> },
];

export default function AppNavigation(){
 const pathname=usePathname();
 if(pathname.startsWith("/admin")) return null;
 const logout=()=>{localStorage.removeItem("schedule_person_id");window.location.href="/";};
 return <>
  {pathname==="/"&&<button type="button" className="dashboard-logout" onClick={logout}>Выйти</button>}
  <nav className="app-navigation" aria-label="Основные разделы">
   {items.map(({href,label,icon})=><Link key={href} className={pathname===href?"is-active":""} href={href} aria-label={label} title={label}>{icon}<span>{label}</span></Link>)}
   <style jsx global>{`
    @view-transition { navigation: auto; }
    ::view-transition-old(root){animation:page-out .16s ease both}
    ::view-transition-new(root){animation:page-in .24s cubic-bezier(.22,1,.36,1) both}
    @keyframes page-out{to{opacity:0;transform:translateY(-5px)}}
    @keyframes page-in{from{opacity:0;transform:translateY(7px);filter:blur(2px)}}
    @keyframes nav-pop{from{opacity:0;transform:scale(.92) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes nav-icon-in{from{opacity:0;transform:scale(.72) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
    @media (prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none!important}}
    .app-navigation{position:sticky;top:10px;z-index:100;display:flex;align-items:center;justify-content:center;gap:3px;width:max-content;max-width:calc(100% - 24px);margin:10px auto -24px;padding:4px;border:1px solid rgba(39,39,44,.9);border-radius:16px;background:rgba(17,17,20,.78);backdrop-filter:blur(18px) saturate(1.15);box-shadow:0 10px 30px rgba(0,0,0,.16);animation:nav-pop .32s cubic-bezier(.22,1,.36,1) both}
    .app-navigation a{position:relative;display:grid;place-items:center;width:42px;height:38px;border-radius:11px;color:#777780;text-decoration:none;transition:color .2s ease,background .2s ease,transform .2s cubic-bezier(.22,1,.36,1),width .2s ease}
    .app-navigation a svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:transform .22s cubic-bezier(.22,1,.36,1)}
    .app-navigation a span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .app-navigation a::after{content:"";position:absolute;bottom:3px;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:0;transform:scale(0);transition:opacity .2s ease,transform .2s ease}
    .app-navigation a:hover{color:#f5f5f5;background:#18181c;transform:translateY(-1px)}
    .app-navigation a:hover svg{transform:scale(1.08)}
    .app-navigation a.is-active{color:#111114;background:#f2f2f2;box-shadow:0 3px 12px rgba(255,255,255,.08)}
    .app-navigation a.is-active::after{opacity:.45;transform:scale(1)}
    .app-navigation a.is-active svg{animation:nav-icon-in .28s cubic-bezier(.22,1,.36,1) both}
    .dashboard-switcher,.quick-app-nav,.bottom-nav{display:none!important}
    .dashboard-logout{position:absolute;top:62px;right:max(14px,calc((100% - 980px)/2));z-index:90;border:1px solid #27272c;border-radius:10px;padding:7px 10px;color:#777780;background:#111114;cursor:pointer;font-size:10px;font-weight:700;transition:color .18s ease,background .18s ease,transform .18s ease}
    .dashboard-logout:hover{color:#f5f5f5;background:#18181c;transform:translateY(-1px)}
    .dashboard-header-actions{display:none!important}
    @media(max-width:700px){.app-navigation{top:8px;width:auto;margin:8px auto -18px}.app-navigation a{width:40px;height:36px}.app-navigation a svg{width:17px;height:17px}.dashboard-logout{top:52px;right:10px}}
   `}</style>
  </nav>
 </>;
}