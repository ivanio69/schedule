"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
const ADMIN_EXIT_MS = 220;

export default function AppNavigation(){
 const pathname=usePathname();
 const authenticated=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 const inAdmin=pathname.startsWith("/admin");
 const inLogin=pathname==="/login";
 const [rendered,setRendered]=useState(false);
 const [initialReady,setInitialReady]=useState(false);
 const [leavingAdmin,setLeavingAdmin]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

 useEffect(()=>{
   if(!authenticated||inLogin){
     setInitialReady(false);
     return;
   }
   if(inAdmin || initialReady) return;

   let firstFrame=0;
   let secondFrame=0;
   const revealWhenReady=()=>{
     if(document.querySelector(".app-loading-state.is-screen")) return;
     cancelAnimationFrame(firstFrame);
     cancelAnimationFrame(secondFrame);
     firstFrame=requestAnimationFrame(()=>{
       secondFrame=requestAnimationFrame(()=>setInitialReady(true));
     });
   };

   const observer=new MutationObserver(revealWhenReady);
   observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
   revealWhenReady();

   return()=>{
     observer.disconnect();
     cancelAnimationFrame(firstFrame);
     cancelAnimationFrame(secondFrame);
   };
 },[authenticated,inAdmin,inLogin,initialReady]);

 useEffect(()=>{
   if(timer.current){clearTimeout(timer.current);timer.current=null;}

   if(!authenticated || inLogin || (!inAdmin && !initialReady)){
     setRendered(false);
     setLeavingAdmin(false);
     document.body.classList.remove("has-app-navigation");
     return;
   }

   if(!inAdmin){
     // App routes never put the navigation through an enter/exit state.
     // It stays mounted and fully visible while only the page content animates.
     setRendered(true);
     setLeavingAdmin(false);
     document.body.classList.add("has-app-navigation");
     return;
   }

   document.body.classList.remove("has-app-navigation");
   if(rendered){
     setLeavingAdmin(true);
     timer.current=setTimeout(()=>{
       setRendered(false);
       setLeavingAdmin(false);
       timer.current=null;
     },ADMIN_EXIT_MS);
   }

   return()=>{
     if(timer.current){clearTimeout(timer.current);timer.current=null;}
   };
 // rendered is intentionally not a dependency: changing mount state must not
 // restart this effect and cancel the admin exit timer.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[authenticated,inAdmin,inLogin,initialReady]);

 useEffect(()=>()=>document.body.classList.remove("has-app-navigation"),[]);

 if(!rendered) return null;

 return <nav className={`app-navigation navigation-labelled navigation-icons-only ${leavingAdmin?"is-exiting":"is-visible"}`} aria-label="Основные разделы" aria-hidden={leavingAdmin}>
   {items.map(({href,label,icon}) => {
     const active=pathname===href || (href!=="/" && pathname.startsWith(href+"/"));
     return <Link key={href} className={active?"is-active":""} href={href}
       aria-current={active?"page":undefined} aria-label={label} title={label} tabIndex={leavingAdmin?-1:undefined}>
       <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{icon}</svg>
       <span className="app-navigation-label" aria-hidden="true">{label}</span>
     </Link>;
   })}
 </nav>;
}
