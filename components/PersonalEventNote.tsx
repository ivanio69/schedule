"use client";

import { useEffect, useState } from "react";

const PERSON_KEY = "schedule_person_id";
let cachedPersonId = "";
let cachedNotes: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

async function loadNotes(personId: string) {
  if (cachedPersonId !== personId) {
    cachedPersonId = personId;
    cachedNotes = null;
    pending = null;
  }
  if (cachedNotes) return cachedNotes;
  if (!pending) {
    pending = fetch(`/api/profile/settings?personId=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        cachedNotes = data?.notes && typeof data.notes === "object" ? data.notes : {};
        return cachedNotes!;
      })
      .catch(() => {
        cachedNotes = {};
        return cachedNotes;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

export default function PersonalEventNote({ noteKey }: { noteKey: string }) {
  const [personId, setPersonId] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem(PERSON_KEY) ?? "";
    setPersonId(id);
    if (!id) return;
    let stopped = false;
    void loadNotes(id).then(notes => {
      if (stopped) return;
      const value = typeof notes[noteKey] === "string" ? notes[noteKey] : "";
      setNote(value);
      setDraft(value);
    });
    return () => { stopped = true; };
  }, [noteKey]);

  const startEditing = () => { setDraft(note); setEditing(true); };
  const save = async () => {
    if (!personId || saving) return;
    setSaving(true);
    try {
      const value = draft.trim();
      const response = await fetch("/api/profile/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, key: noteKey, value }),
      });
      if (!response.ok) throw new Error();
      setNote(value);
      setDraft(value);
      if (cachedPersonId === personId) {
        cachedNotes = { ...(cachedNotes ?? {}), ...(value ? { [noteKey]: value } : {}) };
        if (!value && cachedNotes) delete cachedNotes[noteKey];
      }
      setEditing(false);
    } catch {} finally { setSaving(false); }
  };

  if (!personId) return null;
  return <div className="personal-event-note" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {editing ? <div className="personal-event-note__editor">
      <textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} placeholder="Личная заметка — видна только тебе…" autoFocus/>
      <div><button type="button" onClick={() => setEditing(false)}>Отмена</button><button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></div>
    </div> : note ? <button type="button" className="personal-event-note__value" onClick={startEditing}><span>Личная заметка</span>{note}</button>
      : <button type="button" className="personal-event-note__add" onClick={startEditing}>＋ Личная заметка</button>}
    <style jsx global>{`
      .personal-event-note{margin-top:10px}.personal-event-note__add{padding:0;border:0;color:var(--muted);background:transparent;cursor:pointer;font-size:10px;font-weight:750}
      .personal-event-note__value{display:grid;width:100%;gap:4px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--event-color,var(--accent)) 22%,var(--border));border-radius:10px;color:var(--muted-strong);background:color-mix(in srgb,var(--event-color,var(--accent)) 5%,var(--surface));cursor:pointer;text-align:left;font-size:11px;line-height:1.45}.personal-event-note__value span{color:var(--muted);font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .personal-event-note__editor{padding:9px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised)}.personal-event-note__editor textarea{display:block;width:100%;min-height:66px;resize:vertical;border:0;outline:0;color:var(--text);background:transparent;font:11px/1.5 inherit}.personal-event-note__editor>div{display:flex;justify-content:flex-end;gap:5px;margin-top:6px}.personal-event-note__editor button{border:1px solid var(--border);border-radius:8px;padding:6px 8px;color:var(--muted);background:var(--surface);cursor:pointer;font-size:9px;font-weight:750}.personal-event-note__editor button:last-child{color:var(--accent-text);background:var(--accent);border-color:var(--accent)}
    `}</style>
  </div>;
}
