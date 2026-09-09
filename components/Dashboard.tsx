"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndividualLesson, Person } from "@/lib/people";
import { formatWeekRange, getCurrentWeek, getLessonsForWeek, type Rehearsal, type ScheduleData } from "@/lib/schedule";

function minutes(value: string) { const [h,m]=value.split(":").map(Number); return h*60+m; }
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function todayIndex() { const d=new Date().getDay(); return d===0 ? -1 : d-1; }
function currentDateForDay(index:number) { const d=new Date(); const delta=index-(d.getDay()-1); d.setDate(d.getDate()+delta); return d; }

type EventItem = { kind:"group"|"individual"|"rehearsal"; start:string; end:string; title:string; subtitle:string; detail:string; note?:string };

export default function Dashboard() {
  const [people,setPeople]=useState<Person[]>([]); const [person,setPerson]=useState<Person|null>(null); const [schedule,setSchedule]=useState<ScheduleData|null>(null); const [individuals,setIndividuals]=useState<IndividualLesson[]>([]); const [rehearsals,setRehearsals]=useState<Rehearsal[]>([]); const [now,setNow]=useState(new Date()); const [showPicker,setShowPicker]=useState(false); const [loading,setLoading]=useState(true);
  useEffect(()=>{ const saved=localStorage.getItem("schedule_person_id"); Promise.all([fetch("/api/people",{cache:"no-store"}).then(r=>r.json()),fetch("/api/schedule",{cache:"no-store"}).then(r=>r.json())]).then(([p,s])=>{ setPeople(p.people??[]); const chosen=(p.people??[]).find((x:Person)=>x.id===saved)??null; setPerson(chosen); setSchedule(s.schedule??null); setRehearsals(s.rehearsals??[]); if(chosen) fetch(`/api/individuals?personId=${encodeURIComponent(chosen.id)}`,{cache:"no-store"}).then(r=>r.json()).then(x=>setIndividuals(x.lessons??[])); }).finally(()=>setLoading(false)); },[]);
  useEffect(()=>{ const timer=setInterval(()=>setNow(new Date()),10000); return()=>clearInterval(timer); },[]);
  const selectPerson=(p:Person)=>{ setPerson(p); localStorage.setItem("schedule_person_id",p.id); setShowPicker(false); fetch(`/api/individuals?personId=${encodeURIComponent(p.id)}`,{cache:"no-store"}).then(r=>r.json()).then(x=>setIndividuals(x.lessons??[])); };
  const today=todayIndex(); const week=schedule?getCurrentWeek(schedule,now):1; const todayDate=today>=0?currentDateForDay(today):now; const todayKey=dateKey(todayDate);
  const groupLessons=schedule&&today>=0?getLessonsForWeek(schedule,today,week,{ }):[];
  const todayIndividuals=individuals.filter(x=>x.date===todayKey);
  const todayRehearsals=rehearsals.filter(x=>x.date===todayKey);
  const events=useMemo<EventItem[]>(()=>[...groupLessons.map(x=>({kind:"group" as const,start:x.timeStart,end:x.timeEnd,title:x.class,subtitle:x.professor,detail:x.auditorium})),...todayIndividuals.map(x=>({kind:"individual" as const,start:x.timeStart,end:x.timeEnd,title:x.subject,subtitle:`Индивидуальное · ${x.professor}`,detail:x.auditorium,note:x.note})),...todayRehearsals.map(x=>({kind:"rehearsal" as const,start:x.timeStart,end:x.timeEnd,title:x.subject,subtitle:"Репетиция",detail:x.responsible}))].sort((a,b)=>minutes(a.start)-minutes(b.start)),[groupLessons,todayIndividuals,todayRehearsals]);
  const current=events.find(x=>minutes(x.start)<=now.getHours()*60+now.getMinutes() && minutes(x.end)>now.getHours()*60+now.getMinutes()); const next=events.find(x=>minutes(x.start)>now.getHours()*60+now.getMinutes());
  const countdown=(value:string)=>{ const diff=minutes(value)-(now.getHours()*60+now.getMinutes()); if(diff<=0)return "сейчас"; const h=Math.floor(diff/60),m=diff%60; return h?`через ${h} ч ${m} мин`:`через ${m} мин`; };
  if(loading)return <main className="dashboard-shell"><div className="dashboard-loading">Загрузка…</div></main>;
  if(!person)return <main className="dashboard-shell dashboard-login"><div className="dashboard-brand">214Р</div><p className="eyebrow">РАСПИСАНИЕ</p><h1>Кто сегодня<br/>учится?</h1><p className="dashboard-muted">Выбери себя — пароль не нужен.</p><div className="people-picker">{people.length?people.map(p=><button key={p.id} onClick={()=>selectPerson(p)}><strong>{p.name}</strong><small>Группа {p.group}</small></button>):<p>Список группы пока пуст. Попроси администратора добавить людей.</p>}</div></main>;
  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">РАСПИСАНИЕ · {formatWeekRange(schedule!,week)}</p><h1>Привет, {person.name.split(" ")[0]}.</h1><p className="dashboard-muted">Сегодня {new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(now)}</p></div><button className="dashboard-person" onClick={()=>setShowPicker(true)}><strong>{person.name}</strong><small>Группа {person.group} · сменить</small></button></header>
    <section className="dashboard-hero"><span>{current?"Сейчас":"Следующее"}</span><h2>{current?.title??next?.title??"На сегодня всё"}</h2>{current?<><p>{current.subtitle} · {current.detail}</p><strong className="dashboard-countdown">до конца {countdown(current.end)}</strong></>:next&&<><p>{next.subtitle} · {next.detail}</p><strong className="dashboard-countdown">начало {countdown(next.start)}</strong></>}</section>
    <section className="dashboard-grid"><div className="dashboard-card"><span>Следующая пара</span><strong>{next?.title??"—"}</strong><small>{next?`${next.start} · ${countdown(next.start)}`:"Больше занятий нет"}</small></div><div className="dashboard-card"><span>Сегодня</span><strong>{events.length}</strong><small>занятий и событий</small></div><div className="dashboard-card"><span>Неделя</span><strong>№ {week}</strong><small>{formatWeekRange(schedule!,week)}</small></div></section>
    <section className="dashboard-list"><div className="dashboard-section-title"><h2>Сегодня</h2><span>{events.length}</span></div>{events.length?events.map((e,i)=><article key={`${e.kind}-${e.start}-${i}`} className={`dashboard-event dashboard-event--${e.kind} ${current===e?"is-current":""}`}><div className="dashboard-event-time"><strong>{e.start}</strong><small>{e.end}</small></div><div><span className="dashboard-event-type">{e.kind==="individual"?"Индивидуальное":e.kind==="rehearsal"?"Репетиция":"Пара"}</span><h3>{e.title}</h3><p>{e.subtitle} · {e.detail}</p>{e.note&&<small>{e.note}</small>}</div></article>):<div className="dashboard-empty">На сегодня занятий нет.</div>}</section>
    {showPicker&&<div className="dashboard-modal-backdrop" onMouseDown={()=>setShowPicker(false)}><div className="dashboard-modal" onMouseDown={e=>e.stopPropagation()}><div className="dashboard-modal-head"><h2>Выбрать себя</h2><button onClick={()=>setShowPicker(false)}>×</button></div>{people.map(p=><button className="dashboard-person-option" key={p.id} onClick={()=>selectPerson(p)}><strong>{p.name}</strong><small>Группа {p.group}</small></button>)}</div></div>}
  </main>;
}
