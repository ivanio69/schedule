"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Person } from "@/lib/people";
import {
  ANNOUNCEMENT_COLOR_PRESETS,
  DEFAULT_ANNOUNCEMENT_ACCENT,
  DEFAULT_ANNOUNCEMENT_BACKGROUND,
  announcementColors,
  announcementTextColor,
  type DashboardAnnouncement,
} from "@/lib/announcements";
import styles from "./HeadmanAnnouncements.module.css";

type ManagedAnnouncement = DashboardAnnouncement & { acknowledgementCount?: number; recipientCount?: number };

function localDateTimeValue(value:string|null){
  if(!value)return "";
  const date=new Date(value);
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
}

export default function HeadmanAnnouncements({ people }: { people:Person[] }){
  const [items,setItems]=useState<ManagedAnnouncement[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[editingId,setEditingId]=useState<string|null>(null),[editorOpen,setEditorOpen]=useState(false),[status,setStatus]=useState("");
  const [title,setTitle]=useState(""),[body,setBody]=useState(""),[audience,setAudience]=useState<"all"|"selected">("all"),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(""),[endsAt,setEndsAt]=useState(""),[sendPush,setSendPush]=useState(false),[requiresAcknowledgement,setRequiresAcknowledgement]=useState(false);
  const [accentColor,setAccentColor]=useState(DEFAULT_ANNOUNCEMENT_ACCENT),[backgroundColor,setBackgroundColor]=useState(DEFAULT_ANNOUNCEMENT_BACKGROUND);

  const load=useCallback(async()=>{setLoading(true);try{const response=await fetch("/api/headman/announcements",{cache:"no-store"});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error??"Не удалось загрузить объявления");setItems(data?.announcements??[])}catch(error){setStatus(error instanceof Error?error.message:"Не удалось загрузить объявления")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);

  const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase("ru");return q?people.filter(person=>person.name.toLocaleLowerCase("ru").includes(q)):people},[people,query]);
  const togglePerson=(id:string)=>setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const reset=()=>{setEditingId(null);setEditorOpen(false);setTitle("");setBody("");setAudience("all");setSelected([]);setQuery("");setEndsAt("");setAccentColor(DEFAULT_ANNOUNCEMENT_ACCENT);setBackgroundColor(DEFAULT_ANNOUNCEMENT_BACKGROUND);setSendPush(false);setRequiresAcknowledgement(false)};
  const create=()=>{reset();setEditorOpen(true);setStatus("");requestAnimationFrame(()=>document.getElementById("headman-announcement-editor")?.scrollIntoView({behavior:"smooth",block:"nearest"}))};
  const edit=(item:ManagedAnnouncement)=>{const colors=announcementColors(item);setEditingId(item.id);setEditorOpen(true);setTitle(item.title);setBody(item.body);setAudience(item.audience);setSelected(item.recipientIds);setEndsAt(localDateTimeValue(item.endsAt));setAccentColor(colors.accentColor);setBackgroundColor(colors.backgroundColor);setSendPush(false);setRequiresAcknowledgement(item.requiresAcknowledgement===true);setStatus("");requestAnimationFrame(()=>document.getElementById("headman-announcement-editor")?.scrollIntoView({behavior:"smooth",block:"nearest"}))};

  const save=async()=>{if(busy||!title.trim()||!body.trim()||(audience==="selected"&&!selected.length))return;setBusy(true);setStatus("");try{const response=await fetch("/api/headman/announcements",{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...(editingId?{id:editingId}:{}),title,body,audience,recipientIds:selected,endsAt:endsAt?new Date(endsAt).toISOString():null,accentColor,backgroundColor,sendPush,requiresAcknowledgement})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error??"Не удалось сохранить объявление");setStatus((editingId?"Объявление обновлено":"Объявление опубликовано")+(sendPush?data.push?.error?" · Push не отправлен":" · Push "+(data.push?.sent??0)+"/"+(data.push?.subscriptions??0):""));reset();await load()}catch(error){setStatus(error instanceof Error?error.message:"Не удалось сохранить объявление")}finally{setBusy(false)}};
  const setActive=async(item:DashboardAnnouncement,active:boolean)=>{setBusy(true);setStatus("");try{const response=await fetch("/api/headman/announcements",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,active})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error??"Не удалось изменить объявление");setItems(current=>current.map(value=>value.id===item.id?data.announcement:value))}catch(error){setStatus(error instanceof Error?error.message:"Не удалось изменить объявление")}finally{setBusy(false)}};
  const remove=async(id:string)=>{if(!confirm("Удалить объявление?"))return;setBusy(true);setStatus("");try{const response=await fetch("/api/headman/announcements?id="+encodeURIComponent(id),{method:"DELETE"});if(!response.ok)throw new Error("Не удалось удалить объявление");setItems(current=>current.filter(item=>item.id!==id));if(editingId===id)reset()}catch(error){setStatus(error instanceof Error?error.message:"Не удалось удалить объявление")}finally{setBusy(false)}};

  const previewStyle={"--announcement-accent":accentColor,"--announcement-bg":backgroundColor,"--announcement-text":announcementTextColor(backgroundColor)} as CSSProperties;
  const activeCount=items.filter(item=>item.active).length;

  return <section className={styles.root}>
    <header className={styles.sectionHead}><h2>Объявления</h2><div><span>{activeCount} активных</span><button type="button" className={styles.createButton} onClick={create}>＋ Новое</button><button type="button" onClick={()=>void load()} disabled={loading||busy} aria-label="Обновить объявления">↻</button></div></header>
    <div className={styles.layout+(editorOpen?" "+styles.withEditor:"")}>
      {editorOpen&&<section className={styles.editor} id="headman-announcement-editor">
        <div className={styles.editorHead}><h3>{editingId?"Редактирование":"Новое объявление"}</h3>{editingId&&<button type="button" onClick={reset}>Отмена</button>}</div>
        <label className={styles.field}>Заголовок<input maxLength={120} value={title} onChange={event=>setTitle(event.target.value)} placeholder="Например, Сбор группы"/></label>
        <label className={styles.field}>Текст<textarea rows={4} maxLength={1200} value={body} onChange={event=>setBody(event.target.value)} placeholder="Что нужно сообщить…"/></label>
        <div className={styles.segment}><button className={audience==="all"?styles.active:""} onClick={()=>setAudience("all")}>Всем</button><button className={audience==="selected"?styles.active:""} onClick={()=>setAudience("selected")}>Выбранным{selected.length?" · "+selected.length:""}</button></div>
        {audience==="selected"&&<div className={styles.peoplePicker}><div className={styles.peoplePickerTools}><button type="button" onClick={()=>setSelected(filtered.map(person=>person.id))}>Выбрать всех{query.trim()?" найденных":""}</button><button type="button" disabled={!selected.length} onClick={()=>setSelected([])}>Очистить</button></div><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Найти человека…"/><div>{filtered.map(person=><button type="button" key={person.id} className={selected.includes(person.id)?styles.active:""} onClick={()=>togglePerson(person.id)}>{person.name}</button>)}</div></div>}
        <div className={styles.colors}><div><span>Цвет</span><div className={styles.palette}>{ANNOUNCEMENT_COLOR_PRESETS.map(preset=><button type="button" key={preset.id} className={accentColor===preset.accent&&backgroundColor===preset.background?styles.active:""} onClick={()=>{setAccentColor(preset.accent);setBackgroundColor(preset.background)}} title={preset.label} style={{"--swatch-accent":preset.accent,"--swatch-bg":preset.background} as CSSProperties}/>)}</div></div><label>Акцент<input type="color" value={accentColor} onChange={event=>setAccentColor(event.target.value)}/></label><label>Фон<input type="color" value={backgroundColor} onChange={event=>setBackgroundColor(event.target.value)}/></label></div>
        <div className={styles.preview} style={previewStyle}><strong>{title.trim()||"Заголовок объявления"}</strong><p>{body.trim()||"Здесь будет текст объявления."}</p></div>
        <label className={styles.field}>Показывать до <small>необязательно</small><input type="datetime-local" value={endsAt} onChange={event=>setEndsAt(event.target.value)}/></label>
        <button type="button" className={styles.pushToggle} aria-pressed={requiresAcknowledgement} onClick={()=>setRequiresAcknowledgement(value=>!value)}><span><strong>Ознакомление</strong><small>Показать получателям кнопку «Ознакомился»</small></span><i><u/></i></button>
        <button type="button" className={styles.pushToggle} aria-pressed={sendPush} onClick={()=>setSendPush(value=>!value)}><span><strong>Push</strong><small>{audience==="all"?"Всем получателям":"Выбранным · "+selected.length}</small></span><i><u/></i></button>
        <button type="button" className={styles.save} disabled={busy||!title.trim()||!body.trim()||(audience==="selected"&&!selected.length)} onClick={()=>void save()}>{busy?"Сохраняю…":editingId?"Сохранить изменения":sendPush?"Опубликовать и отправить Push":"Опубликовать"}</button>
        {status&&<p className={styles.status} role="status">{status}</p>}
      </section>}
      <section className={styles.list}>
        <header><strong>Опубликованные</strong><span>{items.length}</span></header>
        {loading&&!items.length?<div className={styles.empty}>Загружаем…</div>:items.length?items.map(item=>{const colors=announcementColors(item);const style={"--announcement-accent":colors.accentColor,"--announcement-bg":colors.backgroundColor,"--announcement-text":announcementTextColor(colors.backgroundColor)} as CSSProperties;return <article key={item.id} className={item.active?styles.itemActive:""} style={style}><div><span>{(item.active?"АКТИВНО":"ВЫКЛЮЧЕНО")+" · "+(item.audience==="all"?"ВСЕМ":item.recipientIds.length+" ЧЕЛ.")}</span><strong>{item.title}</strong><p>{item.body}</p><small>{item.endsAt?"до "+new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(item.endsAt)):"без срока"}{item.requiresAcknowledgement?" · ознакомились "+(item.acknowledgementCount??0)+"/"+(item.recipientCount??0):""}</small></div><div className={styles.itemActions}><button disabled={busy} onClick={()=>edit(item)}>Редактировать</button><button disabled={busy} onClick={()=>void setActive(item,!item.active)}>{item.active?"Скрыть":"Включить"}</button><button className={styles.danger} disabled={busy} onClick={()=>void remove(item.id)}>Удалить</button></div></article>}):<div className={styles.empty}>Объявлений пока нет.</div>}
      </section>
    </div>
  </section>;
}
