"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IndividualSlot } from "@/lib/individual-slots";
import LoadingState from "@/components/LoadingState";
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
type Slot=IndividualSlot&{studentNames?:string[];studentName?:string|null};
const namesOf=(s:Slot)=>s.studentNames?.length?s.studentNames:(s.studentName?[s.studentName]:[]);
export default function IndividualSlots(){
const [slots,setSlots]=useState<Slot[]>([]),[personId,setPersonId]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState("");
const [loadError,setLoadError]=useState("");
const pending=useRef(false);
const load=async(id?:string)=>{
  if(id)setPersonId(id);
  try {
    const today=new Date();
    const response=await fetch(`/api/individual-slots?from=${dateKey(today)}&to=${dateKey(addDays(today,21))}`,{cache:"no-store"});
    if(!response.ok)throw new Error("Не удалось загрузить занятия");
    setSlots((await response.json()).slots??[]);
    setLoadError("");
  } catch { setLoadError("Не удалось обновить занятия. Проверь подключение и попробуй ещё раз."); }
  finally {setLoading(false);}
};
useEffect(()=>{const timer=window.setTimeout(()=>{const id=localStorage.getItem("schedule_person_id");if(id)void load(id);else setLoading(false)},0);return()=>window.clearTimeout(timer)},[]);
const mine=useMemo(()=>slots.filter(s=>s.studentIds?.includes(personId??"")||s.studentId===personId),[slots,personId]);const available=useMemo(()=>slots.filter(s=>(s.studentIds?.length??(s.studentId?1:0))<(s.capacity??1)),[slots]);const groups=useMemo(()=>{const map=new Map<string,Slot[]>();for(const s of slots){const a=map.get(s.subject)??[];a.push(s);map.set(s.subject,a)}return [...map.entries()]},[slots]);if(loading)return <LoadingState screen label="Загружаем индивидуальные" detail="Получаем доступные занятия и твои записи."/>;if(!personId)return <section className="student-slots"><div className="student-slots-empty"><h2>Твои индивидуальные занятия</h2><p><Link href="/">Выбери своё имя</Link>, чтобы увидеть занятия и записаться.</p></div></section>;const changeBooking=async(s:Slot,action:"claim"|"release")=>{
  if(pending.current)return;
  if(action==="release"&&!confirm("Отменить запись на это занятие?"))return;
  pending.current=true;setBusy(s.id);setMessage("");
  try {
    const response=await fetch("/api/individual-slots",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,slotId:s.id,studentId:personId})});
    const data=await response.json();
    if(!response.ok){await load(personId);throw new Error(data.error??"Не удалось сохранить запись");}
    setMessage(action==="claim"?"Запись оформлена":"Запись отменена");
    await load(personId);
  }catch(error){setMessage(error instanceof Error?error.message:"Не удалось сохранить запись. Проверь подключение.");}
  finally {pending.current=false;setBusy(null);}
};
const book=(slot:Slot)=>changeBooking(slot,"claim");
const release=(slot:Slot)=>changeBooking(slot,"release");
const fmt=(v:string)=>new Intl.DateTimeFormat("ru-RU",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${v}T12:00:00`));return <section className="student-slots"><header><div><p>ИНДИВИДУАЛЬНЫЕ</p><h2>Запись на занятия</h2><span>Все доступные и занятые слоты по предметам.</span></div><strong>{available.length}</strong></header>{loadError&&<div className="student-slots-message" role="alert">{loadError} <button disabled={busy!==null} onClick={()=>void load(personId)}>Попробовать снова</button></div>}{message&&<div role="status" className="student-slots-message">{message}</div>}{mine.length>0&&<div className="student-slots-mine"><h3>Мои записи</h3>{mine.map(s=><article key={s.id}><div><small>{fmt(s.date)} · {s.timeStart}–{s.timeEnd}</small><strong>{s.subject}</strong><span>{s.professor}{s.auditorium?` · ${s.auditorium}`:""}</span></div><button disabled={busy!==null} onClick={()=>void release(s)}>{busy===s.id?"…":"Отменить"}</button></article>)}</div>}{slots.length===0&&!loadError?<div className="student-slots-empty"><div className="student-slots-empty-icon">—</div><h3>Нет доступных индивидуальных</h3><p>Сейчас нет доступных индивидуальных занятий. Попробуйте зайти позже.</p></div>:<div className="student-slot-subjects">{groups.map(([subject,items])=><section key={subject}><h3>{subject}</h3><div className="student-slots-list">{items.map(s=>{const names=namesOf(s),used=s.studentIds?.length??names.length;const mineHere=s.studentIds?.includes(personId)||s.studentId===personId;return <article key={s.id} className={used>0?"is-booked":"is-free"}><div className="student-slot-date"><strong>{fmt(s.date)}</strong><span>{s.timeStart}–{s.timeEnd}</span></div><div className="student-slot-info"><span>{s.professor}{s.auditorium?` · ${s.auditorium}`:""}</span>{s.note&&<small>{s.note}</small>}<div className="student-slot-students">{names.length?<>Записаны: <strong>{names.join(", ")}</strong></>:"Пока никто не записан"}</div></div><div className="student-slot-capacity">{used}/{s.capacity}</div>{mineHere?<button disabled={busy!==null} onClick={()=>void release(s)}>{busy===s.id?"…":"Отменить"}</button>:used<(s.capacity??1)?<button disabled={busy!==null} onClick={()=>void book(s)}>{busy===s.id?"Записываюсь…":"Записаться"}</button>:<span className="student-slot-full">Занято</span>}</article>})}</div></section>)}</div>}</section>}
