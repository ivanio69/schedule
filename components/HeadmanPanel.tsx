"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import styles from "./HeadmanPanel.module.css";
import type { Person } from "@/lib/people";
import { attendanceReasonText, type AttendanceReport } from "@/lib/attendance";
import HeadmanAnnouncements from "@/components/HeadmanAnnouncements";
import HeadmanSidebarNavigation from "@/components/HeadmanSidebarNavigation";

type Overview={
  actor:Person;
  reports:AttendanceReport[];
  people:Person[];
  date:string;
  lessons:{key:string;title:string;start:string;end:string;auditorium:string;status:string|null}[];
};
type ReportFilter="today"|"upcoming"|"all";
export type HeadmanTab="today"|"reports"|"announcements"|"analytics"|"anger";

const localDateKeyFrom=(date:Date)=>date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
const localDateKey=()=>localDateKeyFrom(new Date());
const shortDate=(value:string)=>value.split("-").reverse().join(".");
const displayToday=()=>new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(new Date());

export default function HeadmanPanel(){
  const reducedMotion=useReducedMotion();
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<HeadmanTab>("today");
  const [filter,setFilter]=useState<ReportFilter>("today");
  const [analyticsDays,setAnalyticsDays]=useState<30|90>(30);
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
  const analytics=useMemo(()=>{
    const end=new Date(today+"T00:00:00");
    const start=new Date(end);start.setDate(start.getDate()-(analyticsDays-1));
    const startKey=localDateKeyFrom(start);
    const scoped=reports.filter(report=>report.dateTo>=startKey&&report.dateFrom<=today);
    const absences=scoped.filter(report=>report.kind==="absence");
    const lates=scoped.filter(report=>report.kind==="late");
    const peopleCount=new Set(scoped.map(report=>report.personId)).size;
    const activeDates=new Set(scoped.flatMap(report=>[report.dateFrom,report.dateTo])).size;
    const trendLength=Math.min(14,analyticsDays);
    const trend=Array.from({length:trendLength},(_,index)=>{
      const date=new Date(end);date.setDate(date.getDate()-(trendLength-1-index));
      const key=localDateKeyFrom(date);
      const absence=absences.filter(report=>report.dateFrom<=key&&report.dateTo>=key).length;
      const late=lates.filter(report=>report.dateFrom===key).length;
      return {key,label:String(date.getDate()).padStart(2,"0")+"."+String(date.getMonth()+1).padStart(2,"0"),absence,late,total:absence+late};
    });
    const maxTrend=Math.max(1,...trend.map(item=>item.total));
    const reasonMap=new Map<string,number>();
    for(const report of absences){const reason=attendanceReasonText(report)||"Не указана";reasonMap.set(reason,(reasonMap.get(reason)??0)+1)}
    const reasons=[...reasonMap.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,6);
    const lessonMap=new Map<string,number>();
    for(const report of scoped){if(!report.lessonTitle)continue;lessonMap.set(report.lessonTitle,(lessonMap.get(report.lessonTitle)??0)+1)}
    const lessons=[...lessonMap.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,6);
    let advance=0;
    for(const report of scoped){
      const created=Date.parse(report.createdAt);
      if(!Number.isFinite(created))continue;
      if(report.lessonStart){
        const event=Date.parse(report.dateFrom+"T"+report.lessonStart+":00");
        if(Number.isFinite(event)&&event-created>=60*60*1000)advance++;
      }else if(report.createdAt.slice(0,10)<report.dateFrom)advance++;
    }
    return {total:scoped.length,absences:absences.length,lates:lates.length,peopleCount,activeDates,trend,maxTrend,reasons,lessons,advance,advancePercent:scoped.length?Math.round(advance/scoped.length*100):0};
  },[reports,analyticsDays,today]);
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
  if(!overview)return <main className={styles.page}><div className={styles.loading}>{status||"Нет данных"}</div></main>;

  const tabTitle:Record<HeadmanTab,string>={today:"Сегодня",reports:"Отметки",announcements:"Объявления",analytics:"Аналитика",anger:"Гневная кнопка"};
  return <div className={styles.workspace}>
    <HeadmanSidebarNavigation active={tab} onChange={setTab} affectedLessons={affectedLessons} reports={reports.length} actorName={overview.actor.name}/>
    <main className={styles.page}>
    <header className={styles.topbar}>
      <div>
        <strong>{tabTitle[tab]}</strong>
        <span>Панель старосты · {displayToday()}</span>
      </div>
      <button className={styles.refresh} type="button" disabled={loading} onClick={()=>void load()} aria-label="Обновить">↻</button>
    </header>


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

    {tab==="analytics"&&<section className={styles.analyticsView}>
      <header className={styles.analyticsHead}><div><span>ПОСЕЩАЕМОСТЬ</span><h2>Аналитика отметок</h2><p>Сводка строится только по отметкам «опоздаю» и «меня не будет».</p></div><div className={styles.analyticsPeriod}><button type="button" className={analyticsDays===30?styles.active:""} onClick={()=>setAnalyticsDays(30)}>30 дней</button><button type="button" className={analyticsDays===90?styles.active:""} onClick={()=>setAnalyticsDays(90)}>90 дней</button></div></header>
      <div className={styles.analyticsSummary}>
        <article><span>Всего отметок</span><strong>{analytics.total}</strong><small>{analyticsDays} дней</small></article>
        <article><span>Отсутствия</span><strong>{analytics.absences}</strong><small>включая периоды</small></article>
        <article><span>Опоздания</span><strong>{analytics.lates}</strong><small>по конкретным парам</small></article>
        <article><span>Предупредили заранее</span><strong>{analytics.advancePercent}%</strong><small>{analytics.advance} отметок ≥ 1 часа</small></article>
      </div>
      <div className={styles.analyticsGrid}>
        <section className={styles.analyticsCard}><header><div><span>ДИНАМИКА</span><h3>Последние 14 дней</h3></div><small>{analytics.peopleCount} чел. с отметками</small></header><div className={styles.analyticsTrend}>{analytics.trend.map(item=><div key={item.key} title={item.label+" · "+item.total}><div className={styles.analyticsBarTrack}><i style={{height:(item.total/analytics.maxTrend*100)+"%"}}><b style={{height:(item.late/Math.max(1,item.total)*100)+"%"}}/></i></div><small>{item.label.slice(0,2)}</small></div>)}</div><div className={styles.analyticsLegend}><span><i/>Отсутствия</span><span><i/>Опоздания</span></div></section>
        <section className={styles.analyticsCard}><header><div><span>ПРИЧИНЫ</span><h3>Почему отсутствуют</h3></div></header><div className={styles.analyticsList}>{analytics.reasons.length?analytics.reasons.map(item=><div key={item.label}><span>{item.label}</span><b>{item.count}</b><i style={{width:(item.count/Math.max(1,analytics.reasons[0]?.count??1)*100)+"%"}}/></div>):<p>Пока нет данных</p>}</div></section>
        <section className={styles.analyticsCard}><header><div><span>ПАРЫ</span><h3>Где чаще ставят отметки</h3></div></header><div className={styles.analyticsList}>{analytics.lessons.length?analytics.lessons.map(item=><div key={item.label}><span>{item.label}</span><b>{item.count}</b><i style={{width:(item.count/Math.max(1,analytics.lessons[0]?.count??1)*100)+"%"}}/></div>):<p>Пока нет данных</p>}</div></section>
        <section className={styles.analyticsCard}><header><div><span>ОХВАТ</span><h3>Активность</h3></div></header><div className={styles.analyticsFacts}><div><strong>{analytics.peopleCount}</strong><span>людей оставляли отметки</span></div><div><strong>{analytics.activeDates}</strong><span>дат затронуто отметками</span></div><div><strong>{analytics.total?Math.round(analytics.total/analyticsDays*10)/10:0}</strong><span>отметок в день в среднем</span></div></div></section>
      </div>
    </section>}

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
    </main>
  </div>;
}
