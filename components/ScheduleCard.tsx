import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/lib/schedule";

const PERSON_KEY = "schedule_person_id";

export function ScheduleCard({ lesson, onClick }: { lesson: Lesson; onClick?: () => void }) {
  const shared = lesson.group.length === 2;
  const noteKey = useMemo(() => `${lesson.class}|${lesson.timeStart}|${lesson.timeEnd}|${lesson.auditorium}|${lesson.group.join(",")}`, [lesson]);
  const [personId, setPersonId] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = window.localStorage.getItem(PERSON_KEY) ?? "";
    setPersonId(id);
    if (!id) return;
    fetch(`/api/profile/settings?personId=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setNote(typeof data?.notes?.[noteKey] === "string" ? data.notes[noteKey] : ""))
      .catch(() => {});
  }, [noteKey]);

  const saveNote = async () => {
    if (!personId) return;
    setSaving(true);
    try {
      const current = await fetch(`/api/profile/settings?personId=${encodeURIComponent(personId)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      const notes = { ...(current?.notes ?? {}) };
      if (note.trim()) notes[noteKey] = note.trim(); else delete notes[noteKey];
      const response = await fetch("/api/profile/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId, notes }) });
      if (!response.ok) throw new Error();
      setNote(note.trim());
      setEditing(false);
    } catch {
      // Keep the editor open so the text is not lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <article className="schedule-card" role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}>
        <div className="schedule-card__time" aria-label={`Время: ${lesson.timeStart} — ${lesson.timeEnd}`}><span>{lesson.timeStart}</span><span>{lesson.timeEnd}</span></div>
        <div className="schedule-card__body">
          <div className="schedule-card__title-row"><h2>{lesson.class}</h2><span className={`group-badge ${shared ? "group-badge--shared" : ""}`}>{shared ? "Обе группы" : `${lesson.group[0]} подгруппа`}</span></div>
          <div className="schedule-card__meta"><span>{lesson.professor}</span><span aria-hidden="true">·</span><span>ауд. {lesson.auditorium}</span></div>
          {personId && (editing || note) && <div className="schedule-card__note" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{editing ? <div className="schedule-card__note-editor"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Личная заметка к паре…" maxLength={2000} autoFocus /><div className="schedule-card__note-actions"><button type="button" onClick={() => setEditing(false)}>Отмена</button><button type="button" disabled={saving} onClick={() => void saveNote()}>{saving ? "Сохраняю…" : "Сохранить"}</button></div></div> : <button type="button" className="schedule-card__note-text" onClick={() => setEditing(true)}>Заметка: {note}</button>}</div>}
          {personId && !editing && !note && <button type="button" className="schedule-card__add-note" onClick={(event) => { event.stopPropagation(); setEditing(true); }}>＋ Личная заметка</button>}
        </div>
      </article>
      <style jsx global>{`.schedule-card__add-note{display:block;margin-top:11px;padding:0;border:0;color:#777780;background:transparent;cursor:pointer;font-size:11px;font-weight:700}.schedule-card__add-note:hover{color:#f5f5f5}.schedule-card__note{margin-top:11px}.schedule-card__note-text{display:block;width:100%;padding:9px 11px;border:1px solid #303036;border-radius:10px;color:#b8b8c0;background:rgba(255,255,255,.035);cursor:pointer;text-align:left;font-size:11px;line-height:1.45}.schedule-card__note-text:hover{border-color:#4a4a52;background:rgba(255,255,255,.055)}.schedule-card__note-editor{padding:10px;border:1px solid #3b3b42;border-radius:12px;background:#0d0d10}.schedule-card__note-editor textarea{display:block;width:100%;min-height:70px;resize:vertical;border:0;outline:0;color:#f5f5f5;background:transparent;font:12px/1.5 inherit}.schedule-card__note-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:7px}.schedule-card__note-actions button{border:1px solid #303036;border-radius:8px;padding:6px 9px;color:#94949d;background:#151519;cursor:pointer;font-size:10px;font-weight:700}.schedule-card__note-actions button:last-child{color:#111114;background:#f2f2f2;border-color:#f2f2f2}.schedule-card__note-actions button:hover{filter:brightness(1.08)}`}</style>
    </>
  );
}
