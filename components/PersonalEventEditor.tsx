"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizePersonalEvent, type PersonalEvent } from "@/lib/personal-events";

export default function PersonalEventEditor({ date, event, onClose, onSaved }: {
  date: string; event?: PersonalEvent; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setDate] = useState(event?.date ?? date);
  const [start, setStart] = useState(event?.timeStart ?? "18:00");
  const [end, setEnd] = useState(event?.timeEnd ?? "19:00");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

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

  return createPortal(<dialog ref={dialog} className="details-modal personal-event-dialog" aria-labelledby="personal-event-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); if (e.target === e.currentTarget && !saving && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) onClose(); }}>
    <div className="details-modal__header"><div><span className="details-modal__eyebrow">Видно только вам</span><h2 id="personal-event-title">{event ? "Личное событие" : "Новое личное событие"}</h2></div><button type="button" className="details-modal__close" disabled={saving} onClick={onClose} aria-label="Закрыть">×</button></div>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="details-modal__edit-grid">
        <label>Название<input className="admin-input" autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Дата<input className="admin-input" type="date" required value={eventDate} onChange={e => setDate(e.target.value)} /></label>
        <label>Начало<input className="admin-input" type="time" required value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Конец<input className="admin-input" type="time" required value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label className="details-modal__edit-notes">Место<input className="admin-input" maxLength={240} value={location} onChange={e => setLocation(e.target.value)} placeholder="Где проходит событие" /></label>
        <label className="details-modal__edit-notes">Заметки<textarea className="admin-input" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Что нужно запомнить" /></label>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="details-modal__actions">
        {event && <button type="button" className="admin-secondary" disabled={saving} onClick={() => setDeleting(value => !value)}>Удалить</button>}
        <button type="button" className="admin-secondary" disabled={saving} onClick={onClose}>Отмена</button>
        <button type="submit" className="admin-primary" disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</button>
      </div>
      {deleting && <div role="alert"><p>Удалить личное событие?</p><button type="button" className="admin-secondary" disabled={saving} onClick={() => setDeleting(false)}>Оставить</button><button type="button" className="admin-primary" disabled={saving} onClick={() => void save(true)}>Удалить событие</button></div>}
    </form>
    <style jsx global>{`
      dialog.personal-event-dialog { position: fixed; inset: 0; margin: auto; padding: 24px; width: min(600px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow: auto; color: var(--text); background: var(--surface, var(--bg, #fff)); border: 1px solid var(--border); border-radius: 24px; }
      dialog.personal-event-dialog::backdrop { background: rgb(0 0 0 / .4); backdrop-filter: blur(8px); }
      .personal-event-dialog label { display: grid; gap: 8px; }
      .personal-event-dialog textarea { min-height: 120px; }
      @media(max-width: 600px) { dialog.personal-event-dialog { width: 100%; max-width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom)); } }
    `}</style>
  </dialog>, document.body);
}
