"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resetLocalAppearance } from "@/lib/appearance-client";
import styles from "./HeadmanPanel.module.css";
import type { HeadmanTab } from "@/components/HeadmanPanel";

type Props={
  active:HeadmanTab;
  onChange:(tab:HeadmanTab)=>void;
  affectedLessons:number;
  reports:number;
  actorName:string;
};

const ITEMS:{id:HeadmanTab;label:string;icon:string}[]=[
  {id:"today",label:"Сегодня",icon:"●"},
  {id:"reports",label:"Отметки",icon:"≡"},
  {id:"announcements",label:"Объявления",icon:"✦"},
  {id:"analytics",label:"Аналитика",icon:"⌁"},
  {id:"anger",label:"Гневная кнопка",icon:"!"},
];

export default function HeadmanSidebarNavigation({active,onChange,affectedLessons,reports,actorName}:Props){
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [loggingOut,setLoggingOut]=useState(false);
  useEffect(()=>{
    if(!drawerOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setDrawerOpen(false)};
    window.addEventListener("keydown",onKeyDown);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKeyDown)};
  },[drawerOpen]);
  const select=(tab:HeadmanTab)=>{onChange(tab);setDrawerOpen(false)};
  const logout=async()=>{
    if(loggingOut)return;
    setLoggingOut(true);
    try{await fetch("/api/auth/session",{method:"DELETE",cache:"no-store"}).catch(()=>null)}finally{
      localStorage.removeItem("schedule_person_id");
      resetLocalAppearance({animate:true});
      window.dispatchEvent(new Event("schedule-auth-change"));
      window.location.replace("/login");
    }
  };
  return <>
    <div className={styles.headmanMobileBar}>
      <button type="button" className={styles.headmanBurger} onClick={()=>setDrawerOpen(true)} aria-label="Открыть меню старосты"><span/><span/><span/></button>
      <div className={styles.headmanMobileBrand}><b>214Р</b><span>Панель старосты</span></div>
      <Link href="/" className={styles.headmanMobileExit} aria-label="Вернуться в приложение">↗</Link>
    </div>
    <button type="button" className={styles.headmanBackdrop+(drawerOpen?" "+styles.headmanBackdropOpen:"")} onClick={()=>setDrawerOpen(false)} aria-label="Закрыть меню"/>
    <aside className={styles.headmanSidebar+(drawerOpen?" "+styles.headmanSidebarOpen:"")}>
      <header className={styles.headmanSidebarHead}>
        <div className={styles.headmanSidebarBrand}><span>214Р</span><div><strong>Староста</strong><small>{actorName}</small></div></div>
        <button type="button" className={styles.headmanSidebarClose} onClick={()=>setDrawerOpen(false)} aria-label="Закрыть меню">×</button>
      </header>
      <nav className={styles.headmanSidebarNav} aria-label="Разделы панели старосты">
        <p>Работа</p>
        {ITEMS.map(item=><button type="button" key={item.id} className={active===item.id?styles.headmanSidebarActive:""} onClick={()=>select(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.id==="today"&&affectedLessons>0?<b>{affectedLessons}</b>:item.id==="reports"&&reports>0?<b>{reports}</b>:null}</button>)}
      </nav>
      <footer className={styles.headmanSidebarFooter}>
        <Link href="/"><i>←</i><span>В приложение</span></Link>
        <button type="button" disabled={loggingOut} onClick={()=>void logout()}><i>↪</i><span>{loggingOut?"Выходим…":"Выйти"}</span></button>
      </footer>
    </aside>
  </>;
}
