"use client";
import { useEffect, useState } from "react";
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
 const [authenticated,setAuthenticated]=useState(false);
 const [mounted,setMounted]=useState(false);
 const [compact,setCompact]=useState(false);
 useEffect(()=>{
  setMounted(true);
  setAuthenticated(Boolean(localStorage.getItem("schedule_person_id")));
  const sync=()=>setAuthenticated(Boolean(localStorage.getItem("schedule_person_id")));
  window.addEventListener("storage",sync);
  let lastY=window.scrollY;
  const onScroll=()=>{const y=window.scrollY;setCompact(y>80&&y>lastY);lastY=y};
  window.addEventListener("scroll",onScroll,{passive:true});
  return()=>{window.removeEventListener("storage",sync);window.removeEventListener("scroll",onScroll)};
 },[]);
 useEffect(()=>{document.body.classList.toggle("has-app-navigation",mounted&&authenticated);return()=>document.body.classList.remove("has-app-navigation")},[mounted,authenticated]);
 if(pathname.startsWith("/admin") || !mounted || !authenticated) return null;
 return <nav className={`app-navigation${compact?" is-compact":""}`} aria-label="Основные разделы">
   {items.map(({href,label,icon})=><Link key={href} className={pathname===href?"is-active":""} href={href} aria-label={label} title={label}>{icon}<span>{label}</span></Link>)}
   <style jsx global>{`
    @view-transition { navigation: auto; }
    ::view-transition-old(root){animation:page-out .16s ease both}
    ::view-transition-new(root){animation:page-in .24s cubic-bezier(.22,1,.36,1) both}
    @keyframes page-out{to{opacity:0;transform:translateY(-5px)}}
    @keyframes page-in{from{opacity:0;transform:translateY(7px);filter:blur(2px)}}
    @keyframes nav-pop{from{opacity:0;transform:translate(-50%,12px) scale(.94)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
    @keyframes nav-icon-in{from{opacity:0;transform:scale(.72) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
    @media (prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root),.app-navigation{animation:none!important}}
    body.has-app-navigation{padding-bottom:calc(104px + env(safe-area-inset-bottom))}
    .app-navigation{position:fixed;left:50%;bottom:18px;z-index:1000;display:flex;align-items:center;justify-content:center;gap:5px;width:min(430px,calc(100% - 28px));padding:6px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:rgba(20,20,24,.76);backdrop-filter:blur(24px) saturate(1.3);box-shadow:0 18px 55px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.07);transform:translateX(-50%);animation:nav-pop .35s cubic-bezier(.22,1,.36,1) both;transition:padding .25s ease,border-radius .25s ease,box-shadow .25s ease}
    .app-navigation.is-compact{padding:4px;border-radius:18px;box-shadow:0 12px 38px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.06)}
    .app-navigation a{position:relative;display:grid;place-items:center;width:76px;height:54px;border-radius:16px;color:#777780;text-decoration:none;transition:color .2s ease,background .2s ease,transform .22s cubic-bezier(.22,1,.36,1),width .25s ease,height .25s ease,border-radius .25s ease}
    .app-navigation.is-compact a{width:62px;height:46px;border-radius:14px}
    .app-navigation a svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:transform .22s cubic-bezier(.22,1,.36,1)}
    .app-navigation.is-compact a svg{width:19px;height:19px}
    .app-navigation a span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .app-navigation a::after{content:"";position:absolute;bottom:5px;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:0;transform:scale(0);transition:opacity .2s ease,transform .2s ease}
    .app-navigation a:hover{color:#f5f5f5;background:rgba(255,255,255,.07);transform:translateY(-2px)}
    .app-navigation a:hover svg{transform:scale(1.08)}
    .app-navigation a.is-active{color:#111114;background:#f2f2f2;box-shadow:0 5px 18px rgba(255,255,255,.12)}
    .app-navigation a.is-active::after{opacity:.4;transform:scale(1)}
    .app-navigation a.is-active svg{animation:nav-icon-in .28s cubic-bezier(.22,1,.36,1) both}
    .dashboard-switcher,.quick-app-nav,.bottom-nav,.dashboard-header-actions{display:none!important}
    @media(max-width:700px){body.has-app-navigation{padding-bottom:calc(92px + env(safe-area-inset-bottom))}.app-navigation{bottom:calc(10px + env(safe-area-inset-bottom));width:calc(100% - 20px);border-radius:20px}.app-navigation a{width:25%;height:52px}.app-navigation.is-compact a{height:44px;width:25%}}
   `}</style>
 </nav>;
}
