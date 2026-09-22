"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import styles from "./AttendanceActions.module.css";
import { attendanceReasonText, type AttendanceReason, type AttendanceReport, type AttendanceScope } from "@/lib/attendance";

export type AttendanceLessonOption = { key:string; title:string; start:string; end:string };

export default function AttendanceActions({ date, lessons, reports, onReportsChange }: { date:string; lessons:AttendanceLessonOption[]; reports:AttendanceReport[]; onReportsChange:(reports:AttendanceReport[])=>void }) {
  const reducedMotion = useReducedMotion();
  const [mode,setMode]=useState<"late"|"absence"|null>(null);
  const [scope,setScope]=useState<AttendanceScope>("lesson");
  const [lessonKey,setLessonKey]=useState("");
  const [reason,setReason]=useState<AttendanceReason>("sick");
  const [reasonText,setReasonText]=useState("");
  const [dateFrom,setDateFrom]=useState(date);
  const [dateTo,setDateTo]=useState(date);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const clock=new Date();
  const minute=clock.getHours()*60+clock.getMinutes();
  const today=`${clock.getFullYear()}-${String(clock.getMonth()+1).padStart(2,"0")}-${String(clock.getDate()).padStart(2,"0")}`;
  const toMinutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m};
  const lateLesson=useMemo(()=>lessons.find(item=>toMinutes(item.start)<=minute&&toMinutes(item.end)>minute)??lessons.find(item=>toMinutes(item.start)>minute)??null,[lessons,minute]);
  const absenceLessons=useMemo(()=>date>today?lessons:date<today?[]:lessons.filter(item=>toMinutes(item.end)>minute),[date,lessons,minute,today]);
  const selectedLesson=absenceLessons.find(item=>item.key===lessonKey)??absenceLessons[0]??null;
  const openLate=()=>{if(!lateLesson)return;setLessonKey(lateLesson.key);setMode("late");setStatus("")};
  const openAbsence=()=>{setLessonKey(absenceLessons[0]?.key??"");setScope("lesson");setDateFrom(date);setDateTo(date);setMode("absence");setStatus("")};
  const submit=async()=>{
    if(!mode||busy)return;
    setBusy(true);setStatus("");
    try{
      const now=new Date();
      const clientDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const clientTime=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const payload=mode==="late"
        ?{kind:"late",date,lessonKey:lateLesson?.key,clientDate,clientTime}
        :{kind:"absence",scope,date,dateFrom:scope==="period"?dateFrom:date,dateTo:scope==="period"?dateTo:date,lessonKey:scope==="lesson"?selectedLesson?.key:undefined,reason,reasonText,clientDate,clientTime};
      const response=await fetch("/api/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error??"Не удалось отправить");
      const sentMode=mode;setMode(null);
      if(data?.report)onReportsChange([data.report,...reports.filter(item=>item.key!==data.report.key)]);
      setStatus(sentMode==="late"?"Староста получила отметку об опоздании.":"Староста получила отметку об отсутствии.");
    }catch(error){setStatus(error instanceof Error?error.message:"Не удалось отправить отметку")}
    finally{setBusy(false)}
  };
  const cancelReport=async(report:AttendanceReport)=>{
    if(busy)return;
    setBusy(true);setStatus("");
    try{
      const response=await fetch("/api/attendance?id="+encodeURIComponent(report.id),{method:"DELETE"});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error??"Не удалось отменить");
      onReportsChange(reports.filter(item=>item.id!==report.id));
      setStatus("Отметка отменена. Староста получила обновление.");
    }catch(error){setStatus(error instanceof Error?error.message:"Не удалось отменить отметку")}
    finally{setBusy(false)}
  };
  const reportLabel=(report:AttendanceReport)=>{
    if(report.kind==="late")return "Опоздаю · "+(report.lessonStart??"")+" · "+(report.lessonTitle??"Пара");
    const reason=attendanceReasonText(report);
    if(report.scope==="lesson")return "Не будет · "+(report.lessonStart??"")+" · "+(report.lessonTitle??"Пара")+" · "+reason;
    if(report.scope==="day")return "Не будет весь день · "+report.dateFrom.split("-").reverse().join(".")+" · "+reason;
    return "Не будет "+report.dateFrom.split("-").reverse().join(".")+"–"+report.dateTo.split("-").reverse().join(".")+" · "+reason;
  };
  const ready=mode==="late"?!!lateLesson:scope==="lesson"?!!selectedLesson:scope==="period"?!!dateFrom&&!!dateTo&&dateFrom<=dateTo:true;
  return <>
    <section className={styles.root} aria-label="Сообщить старосте"><button type="button" className={styles.action+" "+styles.late} disabled={!lateLesson||busy} onClick={openLate}>Я опоздаю</button><button type="button" className={styles.action+" "+styles.absence} disabled={busy} onClick={openAbsence}>Меня не будет</button>{reports.length>0&&<div className={styles.reports}><span>МОИ ОТМЕТКИ</span>{reports.map(report=><div className={styles.report} key={report.id}><div><strong>{reportLabel(report)}</strong><small>Староста уведомлена</small></div><button type="button" disabled={busy} onClick={()=>void cancelReport(report)}>Отменить</button></div>)}</div>}{status&&<p className={styles.status} role="status">{status}</p>}</section>
    {typeof document!=="undefined"&&createPortal(<AnimatePresence>{mode&&<motion.div className={styles.overlay} onMouseDown={()=>!busy&&setMode(null)} initial={reducedMotion?false:{opacity:0}} animate={{opacity:1}} exit={reducedMotion?undefined:{opacity:0}}><motion.section className={styles.modal} onMouseDown={event=>event.stopPropagation()} initial={reducedMotion?false:{opacity:0,y:12,scale:.985}} animate={{opacity:1,y:0,scale:1}} exit={reducedMotion?undefined:{opacity:0,y:8,scale:.99}}>
      <div className={styles.head}><div><span>СООБЩИТЬ СТАРОСТЕ</span><h2>{mode==="late"?"Я опоздаю":"Меня не будет"}</h2></div><button className={styles.close} type="button" onClick={()=>setMode(null)} aria-label="Закрыть">×</button></div>
      {mode==="late"?<p className={styles.copy}>{lateLesson?"Отметим опоздание на «"+lateLesson.title+"» · "+lateLesson.start+"–"+lateLesson.end:"Сегодня больше нет пар."}</p>:<>
        <div className={styles.choices}><button type="button" className={scope==="lesson"?styles.active:""} onClick={()=>setScope("lesson")}>Одна пара</button><button type="button" className={scope==="day"?styles.active:""} onClick={()=>setScope("day")}>Весь день</button><button type="button" className={scope==="period"?styles.active:""} onClick={()=>setScope("period")}>Период</button></div>
        {scope==="lesson"&&(absenceLessons.length?<label className={styles.field}>Пара<select value={selectedLesson?.key??""} onChange={event=>setLessonKey(event.target.value)}>{absenceLessons.map(item=><option key={item.key} value={item.key}>{item.start} · {item.title}</option>)}</select></label>:<p className={styles.copy}>Сегодня больше нет текущих или будущих пар.</p>)}
        {scope==="day"&&<p className={styles.copy}>Отсутствие на весь день · {date.split("-").reverse().join(".")}</p>}
        {scope==="period"&&<div className={styles.dates}><label className={styles.field}>С<input type="date" min={date} value={dateFrom} onChange={event=>setDateFrom(event.target.value)}/></label><label className={styles.field}>По<input type="date" min={dateFrom||date} value={dateTo} onChange={event=>setDateTo(event.target.value)}/></label></div>}
        <div className={styles.reasons}><button type="button" className={reason==="sick"?styles.active:""} onClick={()=>setReason("sick")}>Больничный</button><button type="button" className={reason==="event"?styles.active:""} onClick={()=>setReason("event")}>Мероприятие</button><button type="button" className={reason==="other"?styles.active:""} onClick={()=>setReason("other")}>Другое</button></div>
        {reason==="other"&&<label className={styles.field}>Причина<textarea rows={3} maxLength={300} value={reasonText} onChange={event=>setReasonText(event.target.value)} placeholder="Коротко опиши причину"/></label>}
      </>}
      <div className={styles.footer}><button type="button" disabled={busy} onClick={()=>setMode(null)}>Отмена</button><button type="button" className={styles.primary} disabled={busy||!ready||(mode==="absence"&&reason==="other"&&!reasonText.trim())} onClick={()=>void submit()}>{busy?"Отправляю…":"Сообщить старосте"}</button></div>
    </motion.section></motion.div>}</AnimatePresence>,document.body)}
  </>;
}
