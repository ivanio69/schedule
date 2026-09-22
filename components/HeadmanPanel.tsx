"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import styles from "./HeadmanPanel.module.css";
import type { Person } from "@/lib/people";
import { attendanceReasonText, type AttendanceReport } from "@/lib/attendance";
import HeadmanAnnouncements from "@/components/HeadmanAnnouncements";

type Overview={
  actor:Person;
  reports:AttendanceReport[];
  people:Person[];
  date:string;
  lessons:{key:string;title:string;start:string;end:string;auditorium:string;status:string|null}[];
};
type ReportFilter="today"|"upcoming"|"all";

const localDateKey=()=>{
  const date=new Date();
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
};
const shortDate=(value:string)=>value.split("-").reverse().join(".");
const displayToday=()=>new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(new Date());

export default function HeadmanPanel(){
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState<ReportFilter>("today");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [angerSelected,setAngerSelected]=useState<string[]>([]);
  const [angerType,setAngerType]=useState<"late"|"absence">("late");
  const [selectedAbsence,setSelectedAbsence]=useState<AttendanceReport|null>(null);

  const load=async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/headman/overview?date="+encodeURIComponent(localDateKey()),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось загрузить панель");
      setOverview(data);
    }catch(error){
      setStatus(error instanceof Error?error.message:"Не удалось загрузить панель");
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{void load()},[]);

  const today=localDateKey();
  const people=overview?.people??[];
  const reports=overview?.reports??[];
  const appliesToday=(report:AttendanceReport)=>report.dateFrom<=today&&report.dateTo>=today;
  const lateToday=reports.filter(report=>report.kind==="late"&&report.dateFrom===today);
  const absentToday=reports.filter(report=>report.kind==="absence"&&appliesToday(report));
  const absentPeopleToday=new Set(absentToday.map(report=>report.personId)).size;
  const latePeopleToday=new Set(lateToday.map(report=>report.personId)).size;
  const periodReports=reports.filter(report=>report.kind==="absence"&&report.scope==="period"&&report.dateTo>=today);
  const visible=useMemo(()=>reports.filter(report=>filter==="all"||filter==="today"?filter==="all"||report.dateFrom<=today&&report.dateTo>=today:report.dateTo>=today),[reports,filter,today]);

  const lessonRows=(overview?.lessons??[]).map(lesson=>{
    const rawAbsence=reports.filter(report=>report.kind==="absence"&&report.dateFrom<=today&&report.dateTo>=today&&(report.scope!=="lesson"||report.lessonKey===lesson.key));
    const absence=[...new Map(rawAbsence.sort((a,b)=>(a.scope==="lesson"?0:a.scope==="day"?1:2)-(b.scope==="lesson"?0:b.scope==="day"?1:2)).map(report=>[report.personId,report] as const)).values()];
    const absentIds=new Set(absence.map(report=>report.personId));
    const late=reports.filter(report=>report.kind==="late"&&report.dateFrom===today&&report.lessonKey===lesson.key&&!absentIds.has(report.personId));
    return {lesson,absence,late};
  });

  const toggle=(setter:Dispatch<SetStateAction<string[]>>,id:string)=>setter(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const candidates=angerType==="late"
    ? [...new Set(lateToday.map(item=>item.personId))].filter(id=>id!==overview?.actor.id)
    : [...new Set(absentToday.map(item=>item.personId))].filter(id=>id!==overview?.actor.id);
  const reminderPreview=angerType==="late"?"злата злится. не опаздывай.":"злата очень сильно злиться. предупреждай если прогуливаешь.";

  const setReminderType=(type:"late"|"absence")=>{
    setAngerType(type);
    setAngerSelected([]);
  };

  const sendAnger=async()=>{
    if(busy||!angerSelected.length)return;
    setBusy(true);
    setStatus("");
    try{
      const response=await fetch("/api/headman/reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipients:angerSelected,type:angerType})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error??"Не удалось отправить");
      setStatus("Отправлено · "+(data.delivery?.sent??0)+"/"+(data.delivery?.subscriptions??0)+" устройств");
      setAngerSelected([]);
    }catch(error){
      setStatus(error instanceof Error?error.message:"Не удалось отправить");
    }finally{
      setBusy(false);
    }
  };

  const reportText=(report:AttendanceReport)=>{
    if(report.kind==="late")return "Опоздает на «"+(report.lessonTitle??"пару")+"» · "+(report.lessonStart??"");
    const reason=attendanceReasonText(report);
    if(report.scope==="lesson")return "Не будет на «"+(report.lessonTitle??"паре")+"» · "+shortDate(report.dateFrom)+" · "+reason;
    if(report.scope==="day")return "Не будет весь день · "+shortDate(report.dateFrom)+" · "+reason;
    return "Не будет "+shortDate(report.dateFrom)+"–"+shortDate(report.dateTo)+" · "+reason;
  };

  if(loading&&!overview)return <main className={styles.page}><div className={styles.loading}>Загружаем…</div></main>;

  return <main className={styles.page}>
    <header className={styles.head}>
      <div><h1>Сегодня</h1><span>{displayToday()}</span></div>
      <button className={styles.refresh} type="button" disabled={loading} onClick={()=>void load()} aria-label="Обновить">↻</button>
    </header>

    <section className={styles.quickStats}>
      <div><strong>{absentPeopleToday}</strong><span>не будет</span></div>
      <div><strong>{latePeopleToday}</strong><span>опоздают</span></div>
      <div><strong>{periodReports.length}</strong><span>длительных</span></div>
    </section>

    <section className={styles.todayLessons}>
      <header><h2>Пары</h2><span>{lessonRows.length}</span></header>
      <div className={styles.lessonList}>
        {lessonRows.length?lessonRows.map(({lesson,absence,late})=><article className={styles.lessonRow} key={lesson.key}>
          <div className={styles.lessonTime}><strong>{lesson.start}</strong><small>{lesson.end}</small></div>
          <div className={styles.lessonMain}><strong>{lesson.title}</strong><small>{lesson.auditorium||"—"}</small></div>
          <div className={styles.lessonPeople}>
            {absence.length>0&&<div className={styles.absentGroup}><span>НЕ БУДЕТ · {absence.length}</span><div className={styles.personLinks}>{absence.map(item=><button type="button" key={item.id} onClick={()=>setSelectedAbsence(item)}>{item.personName}</button>)}</div></div>}
            {late.length>0&&<div className={styles.lateGroup}><span>ОПОЗДАЮТ · {late.length}</span><p>{late.map(item=>item.personName).join(" · ")}</p></div>}
            {!absence.length&&!late.length&&<span className={styles.clear}>Отметок нет</span>}
          </div>
        </article>):<div className={styles.empty}>Сегодня пар нет</div>}
      </div>
    </section>

    <section className={styles.workGrid}>
      <article className={styles.panel}>
        <header className={styles.panelHead}>
          <strong>Отметки</strong>
          <div className={styles.filters}>
            <button className={filter==="today"?styles.active:""} onClick={()=>setFilter("today")}>Сегодня</button>
            <button className={filter==="upcoming"?styles.active:""} onClick={()=>setFilter("upcoming")}>Актуальные</button>
            <button className={filter==="all"?styles.active:""} onClick={()=>setFilter("all")}>Все</button>
          </div>
        </header>
        <div className={styles.reports}>{visible.length?visible.map(report=><div className={styles.report} key={report.id}>
          <div className={styles.avatar}>{report.personName.trim().charAt(0).toUpperCase()}</div>
          <div>{report.kind==="absence"?<button type="button" className={styles.reportPerson} onClick={()=>setSelectedAbsence(report)}>{report.personName}</button>:<strong>{report.personName}</strong>}<p>{reportText(report)}</p><small>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(report.updatedAt))}</small></div>
          <span className={styles.badge+" "+(report.kind==="late"?styles.badgeLate:styles.badgeAbsence)}>{report.kind==="late"?"ОПОЗДАНИЕ":"ОТСУТСТВИЕ"}</span>
        </div>):<div className={styles.empty}>Нет отметок</div>}</div>
      </article>

      <section className={styles.reminder}>
        <header><strong>Напоминание</strong></header>
        <div className={styles.segment}><button className={angerType==="late"?styles.active:""} onClick={()=>setReminderType("late")}>Опоздание</button><button className={angerType==="absence"?styles.active:""} onClick={()=>setReminderType("absence")}>Прогул</button></div>
        <div className={styles.reminderPreview}>«{reminderPreview}»</div>
        <div className={styles.reminderTools}>
          <button type="button" disabled={!candidates.length} onClick={()=>setAngerSelected(candidates)}>По отметкам · {candidates.length}</button>
          {angerSelected.length>0&&<button type="button" onClick={()=>setAngerSelected([])}>Снять выбор</button>}
        </div>
        <div className={styles.peopleChips}>{people.filter(person=>person.id!==overview?.actor.id).map(person=><button type="button" key={person.id} className={angerSelected.includes(person.id)?styles.active:""} onClick={()=>toggle(setAngerSelected,person.id)}>{person.name}</button>)}</div>
        <button className={styles.sendReminder} disabled={busy||!angerSelected.length} onClick={()=>void sendAnger()}>Отправить · {angerSelected.length}</button>
        {status&&<p className={styles.status} role="status">{status}</p>}
      </section>
    </section>

    <HeadmanAnnouncements people={people}/>

    {selectedAbsence&&typeof document!=="undefined"&&createPortal(<div className={styles.modalOverlay} role="presentation" onMouseDown={()=>setSelectedAbsence(null)}>
      <section className={styles.absenceModal} role="dialog" aria-modal="true" aria-label={"Отсутствие: "+selectedAbsence.personName} onMouseDown={event=>event.stopPropagation()}>
        <header><div><span>ОТСУТСТВИЕ</span><h2>{selectedAbsence.personName}</h2></div><button type="button" onClick={()=>setSelectedAbsence(null)} aria-label="Закрыть">×</button></header>
        <div className={styles.absenceDetails}>
          <div><span>Когда</span><strong>{selectedAbsence.scope==="lesson"?(selectedAbsence.lessonTitle??"Пара")+" · "+(selectedAbsence.lessonStart??""):selectedAbsence.scope==="day"?"Весь день · "+shortDate(selectedAbsence.dateFrom):shortDate(selectedAbsence.dateFrom)+"–"+shortDate(selectedAbsence.dateTo)}</strong></div>
          <div><span>Причина</span><strong>{attendanceReasonText(selectedAbsence)||"Не указана"}</strong></div>
          <div><span>Отправлено</span><strong>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(selectedAbsence.createdAt))}</strong></div>
          {selectedAbsence.updatedAt!==selectedAbsence.createdAt&&<div><span>Обновлено</span><strong>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(selectedAbsence.updatedAt))}</strong></div>}
        </div>
        {(()=>{const username=people.find(person=>person.id===selectedAbsence.personId)?.telegramUsername;return username?<a className={styles.telegramLink} href={"https://t.me/"+encodeURIComponent(username)} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>:<div className={styles.telegramMissing}>Telegram не указан</div>})()}
      </section>
    </div>,document.body)}
  </main>;
}
