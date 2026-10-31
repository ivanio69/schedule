"use client";

import { useEffect, useState } from "react";
import type { Person } from "@/lib/people";
import type { Rehearsal } from "@/lib/schedule";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

export default function AdminRehearsals() {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [subject, setSubject] = useState("");
  const [responsible, setResponsible] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [mode, setMode] = useState<"global" | "users">("global");
  const [userItems, setUserItems] = useState<Rehearsal[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userEditing, setUserEditing] = useState<Rehearsal | null>(null);

  const load = async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/rehearsals?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    if (response.status === 401) { location.href = "/admin"; return; }
    const data = await response.json();
    if (response.ok) setItems(data.rehearsals ?? []);
    else setMessage(data.error ?? "Ошибка загрузки");
    setLoading(false);
  };

  useEffect(() => { if (mode === "global") void load(); }, [date, mode]);
  useEffect(() => {
    if (mode !== "users") return;
    let active = true;
    setUserLoading(true);
    void fetch("/api/admin/rehearsals?userCreated=true", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!active) return;
      if (response.ok) setUserItems(data.rehearsals ?? []);
      else setMessage(data.error ?? "Не удалось загрузить пользовательские репетиции");
    }).finally(() => { if (active) setUserLoading(false); });
    return () => { active = false; };
  }, [mode]);
  useEffect(() => {
    void fetch("/api/people", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const list = (await response.json()).people ?? [];
      setPeople(list);
      setParticipants(list.map((person: Person) => person.name));
    }).finally(() => setPeopleLoading(false));
  }, []);

  const toggleParticipant = (name: string) => setParticipants(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);

  const resetForm = () => {
    setEditingId("");
    setSubject("");
    setResponsible("");
    setStart("18:00");
    setEnd("20:00");
    setNotes("");
    setParticipants(people.map(person => person.name));
  };

  const beginEdit = (item: Rehearsal) => {
    setEditingId(item.id);
    setDate(item.date);
    setSubject(item.subject);
    setResponsible(item.responsible);
    setStart(item.timeStart);
    setEnd(item.timeEnd);
    setNotes(item.notes ?? "");
    setParticipants(item.participants ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const create = async () => {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/rehearsals", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingId ? { id: editingId } : {}),
        subject,
        responsible,
        date,
        timeStart: start,
        timeEnd: end,
        notes,
        participants,
        participantMode: "rehearsal",
        blocks: [],
      }),
    });
    const data = await response.json();
    if (response.ok) {
      const wasEditing = Boolean(editingId);
      resetForm();
      setMessage(wasEditing ? "Общая репетиция изменена" : "Общая репетиция создана");
      await load();
    } else setMessage(data.error ?? "Ошибка");
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить общую репетицию? Приглашённым придёт уведомление об отмене.")) return;
    const response = await fetch(`/api/admin/rehearsals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await load();
  };

  const globalItems = items.filter(item => item.isGlobal);
  const saveUserEdit = async () => {
    if (!userEditing) return;
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/rehearsals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...userEditing, userCreated: true }) });
    const data = await response.json();
    if (response.ok) { setUserEditing(null); setUserItems(current => current.map(item => item.id === data.rehearsal.id ? data.rehearsal : item)); setMessage("Репетиция пользователя обновлена"); }
    else setMessage(data.error ?? "Не удалось сохранить репетицию");
    setSaving(false);
  };
  const removeUserRehearsal = async (item: Rehearsal) => {
    if (!confirm(`Удалить репетицию «${item.subject}», созданную пользователем ${item.creatorName ?? "группы"}?`)) return;
    const response = await fetch(`/api/admin/rehearsals?id=${encodeURIComponent(item.id)}&userCreated=true`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setUserItems(current => current.filter(entry => entry.id !== item.id));
    else setMessage(data.error ?? "Не удалось удалить репетицию");
  };

  if (loading || peopleLoading) return <LoadingState compact label="Загружаем репетиции" detail="Получаем события и участников группы."/>;

  return <>
    <AdminHeading
      title="Репетиции"
      description="Общие репетиции видит вся группа. Приглашённые получают уведомления; для графика можно назначать людей по отдельным блокам."
      actions={<a className="admin-primary admin-rehearsal-schedule-link" href={`/admin/rehearsals/new?date=${encodeURIComponent(date)}`}>＋ Репетиция с графиком</a>}
    />
    <div className="admin-modebar" aria-label="Тип репетиций"><button className={mode === "global" ? "is-active" : ""} onClick={() => setMode("global")}>Общие репетиции</button><button className={mode === "users" ? "is-active" : ""} onClick={() => setMode("users")}>Пользовательские <span>{userItems.length}</span></button></div>
    {mode === "global" ? <>
    <section className="admin-card admin-rehearsal-form">
      <p className="admin-eyebrow">{editingId?"Редактирование общей репетиции":"Обычная общая репетиция"}</p>
      <div className="admin-form-grid admin-form-grid-main">
        <label>Дата<input className="admin-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label>Название<input className="admin-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Например, общая репетиция показа"/></label>
        <label>Ответственный<input className="admin-input" value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="ФИО"/></label>
      </div>
      <div className="admin-editor-row">
        <label>Начало<input className="admin-input" type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>Конец<input className="admin-input" type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      </div>
      <label className="admin-rehearsal-notes">Заметки<textarea className="admin-input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Общие заметки к репетиции"/></label>
      <div className="admin-rehearsal-participants">
        <span className="admin-field-title">Приглашённые <em>{participants.length}/{people.length}</em></span>
        <div className="rehearsal-people-picker">{people.map(person=><button type="button" key={person.id} className={participants.includes(person.name)?"is-active":""} onClick={()=>toggleParticipant(person.name)}>{person.name}</button>)}</div>
      </div>
      <div className="admin-actions admin-rehearsal-actions">{editingId&&<button className="admin-secondary" onClick={resetForm}>Отмена</button>}<button className="admin-primary" disabled={saving} onClick={()=>void create()}>{saving?"Сохраняю…":editingId?"Сохранить изменения":"＋ Создать общую репетицию"}</button></div>
      {message&&<p className={message.includes("создана")?"admin-success":"admin-error"}>{message}</p>}
    </section>

    <section className="admin-rehearsal-list">
      {globalItems.map(item=><article className="admin-card admin-rehearsal-item" key={item.id}>
        <strong className="admin-rehearsal-time">{item.timeStart}–{item.timeEnd}</strong>
        <div className="admin-rehearsal-copy">
          <strong>{item.subject}</strong>
          <div className="admin-muted">Ответственный: {item.responsible} · {item.blocks?.length?`${item.blocks.length} блоков · `:""}{item.participantMode==="blocks"?"участники по блокам":`приглашено ${item.participants.length}`}</div>
          {item.notes&&<small className="admin-muted">{item.notes}</small>}
        </div>
        {item.blocks?.length?<a className="admin-secondary admin-rehearsal-edit-link" href={`/admin/rehearsals/new?edit=${encodeURIComponent(item.id)}`}>Изменить график</a>:<button className="admin-secondary admin-rehearsal-edit-link" onClick={()=>beginEdit(item)}>Изменить</button>}
        <button className="admin-danger" onClick={()=>void remove(item.id)}>Удалить</button>
      </article>)}
      {globalItems.length===0&&<div className="admin-card admin-empty">На эту дату общих репетиций нет.</div>}
    </section>
    </> : <section className="admin-user-rehearsals">
      <AdminHeading title="Пользовательские репетиции" description="Репетиции, созданные участниками группы. Здесь администратор может исправить данные или удалить событие." />
      {userEditing && <section className="admin-card admin-rehearsal-form">
        <p className="admin-eyebrow">Редактирование репетиции пользователя</p>
        <div className="admin-form-grid admin-form-grid-main">
          <label>Название<input className="admin-input" value={userEditing.subject} onChange={e=>setUserEditing(v=>v?{...v,subject:e.target.value}:v)}/></label>
          <label>Автор<input className="admin-input" value={userEditing.creatorName ?? userEditing.creatorId} disabled /></label>
          <label>Ответственный<input className="admin-input" value={userEditing.responsible} onChange={e=>setUserEditing(v=>v?{...v,responsible:e.target.value}:v)}/></label>
          <label>Дата<input className="admin-input" type="date" value={userEditing.date} onChange={e=>setUserEditing(v=>v?{...v,date:e.target.value}:v)}/></label>
        </div>
        <div className="admin-editor-row"><label>Начало<input className="admin-input" type="time" value={userEditing.timeStart} onChange={e=>setUserEditing(v=>v?{...v,timeStart:e.target.value}:v)}/></label><label>Конец<input className="admin-input" type="time" value={userEditing.timeEnd} onChange={e=>setUserEditing(v=>v?{...v,timeEnd:e.target.value}:v)}/></label></div>
        <label className="admin-rehearsal-notes">Заметки<textarea className="admin-input" value={userEditing.notes ?? ""} onChange={e=>setUserEditing(v=>v?{...v,notes:e.target.value}:v)}/></label>
        <div className="admin-actions admin-rehearsal-actions"><button className="admin-secondary" onClick={()=>setUserEditing(null)}>Отмена</button><button className="admin-primary" disabled={saving} onClick={()=>void saveUserEdit()}>{saving?"Сохраняю…":"Сохранить изменения"}</button></div>
      </section>}
      {message && mode === "users" && <p className={message.includes("обновлена") ? "admin-success" : "admin-error"}>{message}</p>}
      {userLoading ? <LoadingState compact label="Загружаем пользовательские репетиции" detail="Получаем список событий группы."/> : <section className="admin-rehearsal-list">
        {userItems.map(item=><article className="admin-card admin-rehearsal-item" key={item.id}>
          <strong className="admin-rehearsal-time">{item.timeStart}–{item.timeEnd}</strong><div className="admin-rehearsal-copy"><strong>{item.subject}</strong><div className="admin-muted">Автор: {item.creatorName ?? item.creatorId} · {item.date} · {item.participants?.length ?? 0} участников</div>{item.notes&&<small className="admin-muted">{item.notes}</small>}</div>
          <button className="admin-secondary admin-rehearsal-edit-link" onClick={()=>setUserEditing(item)}>Изменить</button><button className="admin-danger" onClick={()=>void removeUserRehearsal(item)}>Удалить</button>
        </article>)}
        {userItems.length===0&&<div className="admin-card admin-empty">Пользовательских репетиций пока нет.</div>}
      </section>}
    </section>}
  </>;
}
