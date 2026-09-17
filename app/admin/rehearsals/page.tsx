"use client";
import { useEffect, useState } from "react";
import type { Rehearsal } from "@/lib/schedule";
import AdminPageFrame from "@/components/AdminPageFrame";

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
export default function AdminRehearsalsPage(){
 const [date,setDate]=useState(today()),[items,setItems]=useState<Rehearsal[]>([]),[subject,setSubject]=useState(""),[responsible,setResponsible]=useState(""),[start,setStart]=useState("18:00"),[end,setEnd]=useState("20:00"),[message,setMessage]=useState(""),[saving,setSaving]=useState(false);
 const load=async()=>{const r=await fetch(`/api/admin/rehearsals?date=${encodeURIComponent(date)}`,{cache:"no-store"});if(r.status===401){location.href="/admin";return}const d=await r.json();if(r.ok)setItems(d.rehearsals??[]);else setMessage(d.error??"Ошибка загрузки")};
 useEffect(()=>{void load()},[date]);
 const create=async()=>{setSaving(true);setMessage("");const r=await fetch("/api/admin/rehearsals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,responsible,date,timeStart:start,timeEnd:end})});const d=await r.json();if(r.ok){setSubject("");setResponsible("");setMessage("Общая репетиция создана");await load()}else setMessage(d.error??"Ошибка");setSaving(false)};
 const remove=async(id:string)=>{if(!confirm("Удалить общую репетицию?"))return;const r=await fetch(`/api/admin/rehearsals?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(r.ok)await load()};
 const globalItems=items.filter(x=>x.isGlobal);
 return <AdminPageFrame eyebrow="Schedule Admin · Репетиции" title="Общие репетиции" description="Созданные здесь репетиции видит вся группа. В расписании они выделены отдельно." actions={<a className="admin-secondary" href="/admin">← В админку</a>}>
  <section className="admin-card admin-rehearsal-form"><div className="admin-form-grid admin-form-grid-main"><label>Дата<input className="admin-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Название<input className="admin-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Например, общая репетиция показа"/></label><label>Ответственный<input className="admin-input" value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="ФИО"/></label></div><div className="admin-editor-row"><label>Начало<input className="admin-input" type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Конец<input className="admin-input" type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label></div><div className="admin-actions admin-rehearsal-actions"><button className="admin-primary" disabled={saving} onClick={()=>void create()}>{saving?"Создаю…":"＋ Создать общую репетицию"}</button></div>{message&&<p className={message.includes("создана")?"admin-success":"admin-error"}>{message}</p>}</section>
  <section className="admin-rehearsal-list">{globalItems.map(item=><article className="admin-card admin-rehearsal-item" key={item.id}><strong className="admin-rehearsal-time">{item.timeStart}–{item.timeEnd}</strong><div className="admin-rehearsal-copy"><strong>{item.subject}</strong><div className="admin-muted">Ответственный: {item.responsible} · вся группа</div></div><button className="admin-danger" onClick={()=>void remove(item.id)}>Удалить</button></article>)}{globalItems.length===0&&<div className="admin-card admin-empty">На эту дату общих репетиций нет.</div>}</section>
 </AdminPageFrame>;
}
