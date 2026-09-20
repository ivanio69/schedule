"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";
import type { Person } from "@/lib/people";
import type { DashboardAnnouncement } from "@/lib/announcements";

export default function AdminAnnouncements() {
  const [items, setItems] = useState<DashboardAnnouncement[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all"|"selected">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/admin/announcements", { cache: "no-store" }),
        fetch("/api/admin/people", { cache: "no-store" })
      ]);
      if (responses[0].ok) setItems((await responses[0].json()).announcements ?? []);
      if (responses[1].ok) setPeople((await responses[1].json()).people ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ru");
    return value ? people.filter(person => person.name.toLocaleLowerCase("ru").includes(value)) : people;
  }, [people, query]);
  const togglePerson = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const create = async () => {
    if (busy || !title.trim() || !body.trim() || (audience === "selected" && !selected.length)) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, recipientIds: selected, endsAt: endsAt ? new Date(endsAt).toISOString() : null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось создать объявление");
      setTitle(""); setBody(""); setSelected([]); setEndsAt(""); setStatus("Объявление опубликовано");
      await load();
    } catch (value) { setStatus(value instanceof Error ? value.message : "Не удалось создать объявление"); }
    finally { setBusy(false); }
  };
  const setActive = async (item: DashboardAnnouncement, active: boolean) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, active }) });
      if (response.ok) setItems(current => current.map(value => value.id === item.id ? { ...value, active } : value));
    } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm("Удалить объявление?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announcements?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (response.ok) setItems(current => current.filter(item => item.id !== id));
    } finally { setBusy(false); }
  };

  return <>
    <AdminHeading title="Объявления" description="Показывай сообщения на дашборде всем или выбранным людям." actions={<button className="admin-secondary" disabled={loading} onClick={() => void load()}>↻ Обновить</button>}/>
    <section className="admin-card admin-form-panel admin-announcement-create">
      <p className="admin-eyebrow">Новое объявление</p><h2>Сообщение на дашборде</h2>
      <label>Заголовок<input className="admin-input" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, Сбор группы"/></label>
      <label>Текст<textarea className="admin-input" rows={4} maxLength={1200} value={body} onChange={event => setBody(event.target.value)} placeholder="Что нужно сообщить…"/></label>
      <label>Кому<div className="admin-chip-row"><button type="button" className={audience==="all"?"is-active":""} onClick={()=>setAudience("all")}>Всем</button><button type="button" className={audience==="selected"?"is-active":""} onClick={()=>setAudience("selected")}>Выбранным{selected.length ? " · " + selected.length : ""}</button></div></label>
      {audience==="selected"&&<div><input className="admin-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Найти человека…"/><div className="admin-announcement-people">{filtered.map(person=><button type="button" key={person.id} className={selected.includes(person.id)?"is-active":""} onClick={()=>togglePerson(person.id)}>{person.name}</button>)}</div></div>}
      <label>Показывать до <small>необязательно</small><input className="admin-input" type="datetime-local" value={endsAt} onChange={event=>setEndsAt(event.target.value)}/></label>
      <div className="admin-form-actions"><button className="admin-primary" disabled={busy||!title.trim()||!body.trim()||(audience==="selected"&&!selected.length)} onClick={()=>void create()}>{busy?"Сохраняю…":"Опубликовать"}</button></div>
      {status&&<p className="admin-success">{status}</p>}
    </section>
    {loading ? <LoadingState compact label="Загружаем объявления" detail="Получаем активные и архивные сообщения."/> :
      <section className="admin-card admin-announcements-list"><header><strong>Объявления</strong><span>{items.length}</span></header>{items.length?items.map(item=><article key={item.id} className={item.active?"is-active":""}><div><span>{(item.active?"АКТИВНО":"ВЫКЛЮЧЕНО") + " · " + (item.audience==="all"?"ВСЕМ":item.recipientIds.length+" ЧЕЛ.")}</span><strong>{item.title}</strong><p>{item.body}</p><small>{item.endsAt ? "до " + new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(item.endsAt)) : "без срока"}</small></div><div><button className="admin-secondary" disabled={busy} onClick={()=>void setActive(item,!item.active)}>{item.active?"Скрыть":"Включить"}</button><button className="admin-danger" disabled={busy} onClick={()=>void remove(item.id)}>Удалить</button></div></article>):<p className="admin-empty">Объявлений пока нет.</p>}</section>}
  </>;
}
