"use client";

import { useState } from "react";
import EventDialog from "./EventDialog";
import styles from "./PersonalEvents.module.css";
import { normalizePersonalEvent, type PersonalEvent } from "@/lib/personal-events";

export default function PersonalEventEditor({ date, event, onClose, onSaved }: {
  date: string; event?: PersonalEvent; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setDate] = useState(event?.date ?? date);
  const [start, setStart] = useState(event?.timeStart ?? "18:00");
  const [end, setEnd] = useState(event?.timeEnd ?? "19:00");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save(remove = false) {
    if (saving) return;
    const input = { title, date: eventDate, timeStart: start, timeEnd: end, location, notes };
    if (!remove && !normalizePersonalEvent(input)) { setError("Укажите название, дату и время. Конец должен быть позже начала."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(remove ? `/api/personal-events?id=${encodeURIComponent(event!.id)}` : "/api/personal-events", {
        method: remove ? "DELETE" : event ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(!remove ? { body: JSON.stringify({ ...input, id: event?.id }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить событие");
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось сохранить событие"); }
    finally { setSaving(false); }
  }

  const formattedDate = new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"long" }).format(new Date((event?.date ?? date) + "T12:00:00"));
  const content = deleting ? <section className={styles.confirmation} aria-labelledby="delete-event-title">
    <div className={styles.warningIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></div>
    <h3 id="delete-event-title">Удалить событие?</h3>
    <p>Событие и его заметки исчезнут из вашего расписания. Восстановить их не получится.</p>
    <div className={styles.eventPreview}><strong>{event?.title}</strong><span>{formattedDate} · {event?.timeStart}–{event?.timeEnd}</span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" autoFocus className={styles.secondary} disabled={saving} onClick={()=>{setDeleting(false);setError("")}}>Оставить</button><button type="button" className={styles.danger} disabled={saving} onClick={()=>void save(true)}>{saving?"Удаляю…":"Удалить событие"}</button></div>
  </section> : <form className={styles.form} onSubmit={e => { e.preventDefault(); void save(); }}>
    {!event&&<div className={styles.formHead}><div><p>ЛИЧНОЕ СОБЫТИЕ</p><h2>Новые планы</h2></div><span className={styles.privacy}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Видно только вам</span></div>}
    <div className={styles.grid}>
      <label className={styles.wide}>Название<input autoFocus required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, встреча или поход в театр" /></label>
      <label>Дата<input type="date" required value={eventDate} onChange={e=>setDate(e.target.value)} /></label>
      <label>Место<input maxLength={240} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Адрес или аудитория" /></label>
      <div className={`${styles.timeRow} ${styles.wide}`}><label>Начало<input type="time" required value={start} onChange={e=>setStart(e.target.value)} /></label><label>Конец<input type="time" required value={end} onChange={e=>setEnd(e.target.value)} /></label></div>
      <label className={styles.wide}>Заметки<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Что взять, подготовить или не забыть…" /></label>
    </div>
    <div className={styles.summary}><span>Время события</span><strong>{start || "—"}–{end || "—"}</strong><span>Без приглашений и общих уведомлений</span></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      {event&&<button type="button" className={`${styles.danger} ${styles.deleteTrigger}`} disabled={saving} onClick={()=>{setDeleting(true);setError("")}}>Удалить</button>}
      <button type="button" className={styles.secondary} disabled={saving} onClick={onClose}>Отмена</button>
      <button type="submit" className={styles.primary} disabled={saving}>{saving?"Сохраняю…":event?"Сохранить изменения":"Создать событие"}</button>
    </div>
  </form>;

  if (!event) return <section className="rehearsal-form personal-event-form">{content}</section>;
  return <EventDialog compact={deleting} title={deleting?"Подтверждение удаления":"Личное событие"} eyebrow="ВИДНО ТОЛЬКО ВАМ" busy={saving} onClose={()=>{if(deleting){setDeleting(false);setError("")}else onClose()}}>{content}</EventDialog>;
}
