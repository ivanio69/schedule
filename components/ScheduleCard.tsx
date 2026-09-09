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
      const response = await fetch("/api/profile/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, notes }),
      });
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
    <article
      className="schedule-card"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="schedule-card__time" aria-label={`Время: ${lesson.timeStart} — ${lesson.timeEnd}`}>
        <span>{lesson.timeStart}</span>
        <span>{lesson.timeEnd}</span>
      </div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <h2>{lesson.class}</h2>
          <span className={`group-badge ${shared ? "group-badge--shared" : ""}`}>
            {shared ? "Обе группы" : `${lesson.group[0]} подгруппа`}
          </span>
        </div>
        <div className="schedule-card__meta">
          <span>{lesson.professor}</span>
          <span aria-hidden="true">·</span>
          <span>ауд. {lesson.auditorium}</span>
        </div>
        {personId && (editing || note) && (
          <div className="schedule-card__note" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            {editing ? (
              <div className="schedule-card__note-editor">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Личная заметка к паре…" maxLength={2000} autoFocus />
                <div className="schedule-card__note-actions">
                  <button type="button" onClick={() => setEditing(false)}>Отмена</button>
                  <button type="button" disabled={saving} onClick={() => void saveNote()}>{saving ? "Сохраняю…" : "Сохранить"}</button>
                </div>
              </div>
            ) : (
              <button type="button" className="schedule-card__note-text" onClick={() => setEditing(true)}>Заметка: {note}</button>
            )}
          </div>
        )}
        {personId && !editing && !note && (
          <button type="button" className="schedule-card__add-note" onClick={(event) => { event.stopPropagation(); setEditing(true); }}>
            ＋ Личная заметка
          </button>
        )}
      </div>
    </article>
  );
}
