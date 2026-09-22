"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
type HeadmanTab="today"|"reports"|"announcements"|"anger";

const localDateKey=()=>{
  const date=new Date();
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
};
const shortDate=(value:string)=>value.split("-").reverse().join(".");
const displayToday=()=>new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(new Date());

export default function HeadmanPanel(){
  const reducedMotion=useReducedMotion();
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<HeadmanTab>("today");
  const [filter,setFilter]=useState<ReportFilter>("today");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [angerSelected,setAngerSelected]=useState<string[]>([]);
  const [angerType,setAngerType]=useState<"late"|"absence">("late");
  const [selectedReport,setSelectedReport]=useState<AttendanceReport|null>(null);
  const [quickAngerStatus,setQuickAngerStatus]=useState("");

  const load=async()=>{
    setLoading(true);
    try{
      const clock=new Date();
      const time=String(clock.getHours()).padStart(2,"0")+":"+String(clock.getMinutes()).padStart(2,"0");
      const response=await fetch("/api/headman/overview?date="+encodeURIComponent(localDateKey())+"&time="+encodeURIComponent(time),{cache:"no-store"});
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
  useEffect(()=>{
    const timer=setInterval(()=>void load(),60000);
    return()=>clearInterval(timer);
  },[]);

  const today=localDateKey();
  const people=overview?.people??[];
  const reports=overview?.reports??[];
  const appliesToday=(report:AttendanceReport)=>report.dateFrom<=today&&report.dateTo>=today;
  const lateToday=reports.filter(report=>report.kind==="late"&&report.dateFrom===today);
  const absentToday=reports.filter(report=>report.kind==="absence"&&appliesToday(report));
  const absentPeopleToday=new Set(absentToday.map(report=>report.personId)).size;
  const latePeopleToday=new Set(lateToday.map(report=>report.personId)).size;
  const visible=useMemo(()=>reports.filter(report=>filter==="all"||filter==="today"?filter==="all"||report.dateFrom<=today&&report.dateTo>=today:report.dateTo>=today),[reports,filter,today]);

  const now=new Date();
  const nowMinutes=now.getHours()*60+now.getMinutes();
  const toMinutes=(value:string)=>{const [hours,minutes]=value.split(":").map(Number);return hours*60+minutes};

  const lessonRows=(overview?.lessons??[]).map(lesson=>{
    const rawAbsence=reports.filter(report=>report.kind==="absence"&&report.dateFrom<=today&&report.dateTo>=today&&(report.scope!=="lesson"||report.lessonKey===lesson.key));
    const absence=[...new Map(rawAbsence.sort((a,b)=>(a.scope==="lesson"?0:a.scope==="day"?1:2)-(b.scope==="lesson"?0:b.scope==="day"?1:2)).map(report=>[report.personId,report] as const)).values()];
    const absentIds=new Set(absence.map(report=>report.personId));
    const late=reports.filter(report=>report.kind==="late"&&report.dateFrom===today&&report.lessonKey===lesson.key&&!absentIds.has(report.personId));
    const current=toMinutes(lesson.start)<=nowMinutes&&toMinutes(lesson.end)>nowMinutes;
    return {lesson,absence,late,current};
  });

  const currentLesson=lessonRows.find(item=>item.current);
  const affectedLessons=lessonRows.filter(item=>item.absence.length||item.late.length).length;
  const toggle=(setter:Dispatch<SetStateAction<string[]>>,id:string)=>setter(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);

  const candidates=angerType==="late"
    ? [...new Set(lateToday.map(item=>item.personId))].filter(id=>id!==overview?.actor.id)
    : [...new Set(absentToday.map(item=>item.personId))].filter(id=>id!==overview?.actor.id);
  const reminderPreview=angerType==="late"?"злата злится. не опаздывай.":"злата очень сильно злиться. предупреждай если прогуливаешь.";

  const setReminderType=(type:"late"|"absence")=>{
    setAngerType(type);
    setAngerSelected([]);
  };

  const openReport=(report:AttendanceReport)=>{
    setQuickAngerStatus("");
    setSelectedReport(report);
  };

  const sendQuickAnger=async()=>{
    if(!selectedReport||busy)return;
    setBusy(true);
    setQuickAngerStatus("");
    try{
      const response=await fetch("/api/headman/reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipients:[selectedReport.personId],type:selectedReport.kind==="late"?"late":"absence"})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error??"Не удалось отправить");
      setQuickAngerStatus("Отправлено · "+(data.delivery?.sent??0)+"/"+(data.delivery?.subscriptions??0));
    }catch(error){
      setQuickAngerStatus(error instanceof Error?error.message:"Не удалось отправить");
    }finally{
      setBusy(false);
    }
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
    <header className={styles.topbar}>
      <div>
        <strong>Староста</strong>
        <span>{displayToday()}</span>
      </div>
      <button className={styles.refresh} type="button" disabled={loading} onClick={()=>void load()} aria-label="Обновить">↻</button>
    </header>

    <nav className={styles.tabs} aria-label="Разделы панели старосты">
      <button className={tab==="today"?styles.active:""} onClick={()=>setTab("today")}><span>Сегодня</span>{affectedLessons>0&&<b>{affectedLessons}</b>}</button>
      <button className={tab==="reports"?styles.active:""} onClick={()=>setTab("reports")}><span>Отметки</span>{reports.length>0&&<b>{reports.length}</b>}</button>
      <button className={tab==="announcements"?styles.active:""} onClick={()=>setTab("announcements")}><span>Объявления</span></button>
      <button className={tab==="anger"?styles.active:""} onClick={()=>setTab("anger")}><span>Гневная кнопка</span></button>
    </nav>

    {tab==="today"&&<section className={styles.todayView}>
      <div className={styles.todaySummary}>
        <div><strong>{absentPeopleToday}</strong><span>не будет</span></div>
        <div><strong>{latePeopleToday}</strong><span>опоздают</span></div>
        <div><strong>{affectedLessons}</strong><span>пар с отметками</span></div>
        {currentLesson&&<div className={styles.currentSummary}><span>сейчас</span><strong>{currentLesson.lesson.start} · {currentLesson.lesson.title}</strong></div>}
      </div>

      <section className={styles.todayLessons}>
        {lessonRows.length?lessonRows.map(({lesson,absence,late,current})=><article className={styles.lessonRow+(current?" "+styles.currentLesson:"")} key={lesson.key}>
          <div className={styles.lessonTime}><strong>{lesson.start}</strong><small>{current?"сейчас":lesson.end}</small></div>
          <div className={styles.lessonMain}><strong>{lesson.title}</strong><small>{lesson.auditorium||"—"}</small></div>
          <div className={styles.lessonPeople}>
            {absence.length>0&&<div className={styles.absentGroup}><span>Не будет · {absence.length}</span><div className={styles.personLinks}>{absence.map(item=><button type="button" key={item.id} onClick={()=>openReport(item)}>{item.personName}</button>)}</div></div>}
            {late.length>0&&<div className={styles.lateGroup}><span>Опоздают · {late.length}</span><div className={styles.lateLinks}>{late.map(item=><button type="button" key={item.id} onClick={()=>openReport(item)}>{item.personName}</button>)}</div></div>}
            {!absence.length&&!late.length&&<span className={styles.clear}>Все без отметок</span>}
          </div>
        </article>):<div className={styles.empty}>Сегодня пар нет</div>}
      </section>
    </section>}

    {tab==="reports"&&<section className={styles.panel}>
      <header className={styles.panelHead}>
        <div className={styles.filters}>
          <button className={filter==="today"?styles.active:""} onClick={()=>setFilter("today")}>Сегодня</button>
          <button className={filter==="upcoming"?styles.active:""} onClick={()=>setFilter("upcoming")}>Актуальные</button>
          <button className={filter==="all"?styles.active:""} onClick={()=>setFilter("all")}>Все</button>
        </div>
        <span>{visible.length}</span>
      </header>
      <div className={styles.reports}>{visible.length?visible.map(report=><div
        className={styles.report+" "+styles.reportClickable+(report.kind==="late"?" "+styles.reportLateClickable:" "+styles.reportAbsenceClickable)}
        key={report.id}
        role="button"
        tabIndex={0}
        onClick={()=>openReport(report)}
        onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openReport(report)}}}
      >
        <div className={styles.avatar}>{report.personName.trim().charAt(0).toUpperCase()}</div>
        <div><strong>{report.personName}</strong><p>{reportText(report)}</p><small>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(report.updatedAt))}</small></div>
        <span className={styles.badge+" "+(report.kind==="late"?styles.badgeLate:styles.badgeAbsence)}>{report.kind==="late"?"ОПОЗДАНИЕ":"ОТСУТСТВИЕ"}</span>
      </div>):<div className={styles.empty}>Нет отметок</div>}</div>
    </section>}

    {tab==="announcements"&&<HeadmanAnnouncements people={people}/>}

    {tab==="anger"&&<section className={styles.angerPanel}>
      <div className={styles.segment}>
        <button className={angerType==="late"?styles.active:""} onClick={()=>setReminderType("late")}>Опоздание</button>
        <button className={angerType==="absence"?styles.active:""} onClick={()=>setReminderType("absence")}>Прогул</button>
      </div>
      <div className={styles.reminderPreview}>«{reminderPreview}»</div>
      <div className={styles.reminderTools}>
        <button type="button" disabled={!candidates.length} onClick={()=>setAngerSelected(candidates)}>Выбрать по отметкам · {candidates.length}</button>
        {angerSelected.length>0&&<button type="button" onClick={()=>setAngerSelected([])}>Очистить</button>}
      </div>
      <div className={styles.peopleChips}>{people.filter(person=>person.id!==overview?.actor.id).map(person=><button type="button" key={person.id} className={angerSelected.includes(person.id)?styles.active:""} onClick={()=>toggle(setAngerSelected,person.id)}>{person.name}</button>)}</div>
      <button className={styles.sendReminder} disabled={busy||!angerSelected.length} onClick={()=>void sendAnger()}>Отправить · {angerSelected.length}</button>
      {status&&<p className={styles.status} role="status">{status}</p>}
    </section>}

    {typeof document!=="undefined"&&createPortal(<AnimatePresence>{selectedReport&&<motion.div className={styles.modalOverlay} role="presentation" onMouseDown={()=>setSelectedReport(null)} initial={reducedMotion?false:{opacity:0,backdropFilter:"blur(0px)"}} animate={{opacity:1,backdropFilter:"blur(8px)"}} exit={reducedMotion?undefined:{opacity:0,backdropFilter:"blur(0px)"}} transition={{duration:.18}}>
      <motion.section className={styles.detailModal+" "+(selectedReport.kind==="late"?styles.detailModalLate:styles.detailModalAbsence)} role="dialog" aria-modal="true" aria-label={(selectedReport.kind==="late"?"Опоздание: ":"Отсутствие: ")+selectedReport.personName} onMouseDown={event=>event.stopPropagation()} initial={reducedMotion?false:{opacity:0,y:14,scale:.985,filter:"blur(5px)"}} animate={{opacity:1,y:0,scale:1,filter:"blur(0px)"}} exit={reducedMotion?undefined:{opacity:0,y:10,scale:.98,filter:"blur(8px)"}} transition={{duration:.18,ease:[.22,1,.36,1]}}>
        <header><div><span>{selectedReport.kind==="late"?"ОПОЗДАНИЕ":"ОТСУТСТВИЕ"}</span><h2>{selectedReport.personName}</h2></div><button type="button" onClick={()=>setSelectedReport(null)} aria-label="Закрыть">×</button></header>
        <div className={styles.detailGrid}>
          <div><span>Когда</span><strong>{selectedReport.kind==="late"?(selectedReport.lessonTitle??"Пара")+" · "+(selectedReport.lessonStart??""):selectedReport.scope==="lesson"?(selectedReport.lessonTitle??"Пара")+" · "+(selectedReport.lessonStart??""):selectedReport.scope==="day"?"Весь день · "+shortDate(selectedReport.dateFrom):shortDate(selectedReport.dateFrom)+"–"+shortDate(selectedReport.dateTo)}</strong></div>
          {selectedReport.kind==="absence"&&<div><span>Причина</span><strong>{attendanceReasonText(selectedReport)||"Не указана"}</strong></div>}
          <div><span>Отправлено</span><strong>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(selectedReport.createdAt))}</strong></div>
          {selectedReport.updatedAt!==selectedReport.createdAt&&<div><span>Обновлено</span><strong>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(selectedReport.updatedAt))}</strong></div>}
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.quickAnger} disabled={busy} onClick={()=>void sendQuickAnger()}>{busy?"Отправляю…":"😡 Гневная кнопка"}</button>
          {(()=>{const username=people.find(person=>person.id===selectedReport.personId)?.telegramUsername;return username?<a className={styles.telegramLink} href={"https://t.me/"+encodeURIComponent(username)} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>:<div className={styles.telegramMissing}>Telegram не указан</div>})()}
        </div>
        <p className={styles.quickAngerText}>«{selectedReport.kind==="late"?"злата злится. не опаздывай.":"злата очень сильно злиться. предупреждай если прогуливаешь."}»</p>
        {quickAngerStatus&&<p className={styles.quickAngerStatus} role="status">{quickAngerStatus}</p>}
      </motion.section>
    </motion.div>}</AnimatePresence>,document.body)}
  </main>;
}
