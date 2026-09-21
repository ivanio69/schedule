"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";
import type { Person } from "@/lib/people";
import {
  ANNOUNCEMENT_COLOR_PRESETS,
  DEFAULT_ANNOUNCEMENT_ACCENT,
  DEFAULT_ANNOUNCEMENT_BACKGROUND,
  announcementColors,
  announcementTextColor,
  type DashboardAnnouncement,
} from "@/lib/announcements";

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState<DashboardAnnouncement[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all"|"selected">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [accentColor, setAccentColor] = useState(DEFAULT_ANNOUNCEMENT_ACCENT);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_ANNOUNCEMENT_BACKGROUND);
  const [sendPush, setSendPush] = useState(false);
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLElement | null>(null);

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

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setAudience("all");
    setSelected([]);
    setQuery("");
    setEndsAt("");
    setAccentColor(DEFAULT_ANNOUNCEMENT_ACCENT);
    setBackgroundColor(DEFAULT_ANNOUNCEMENT_BACKGROUND);
    setSendPush(false);
  };

  const edit = (item: DashboardAnnouncement) => {
    const colors = announcementColors(item);
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setAudience(item.audience);
    setSelected(item.recipientIds);
    setQuery("");
    setEndsAt(localDateTimeValue(item.endsAt));
    setAccentColor(colors.accentColor);
    setBackgroundColor(colors.backgroundColor);
    setSendPush(false);
    setStatus("");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const save = async () => {
    if (busy || !title.trim() || !body.trim() || (audience === "selected" && !selected.length)) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title,
          body,
          audience,
          recipientIds: selected,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          accentColor,
          backgroundColor,
          sendPush,
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить объявление");
      const pushText = sendPush
        ? data.push?.error
          ? " · объявление сохранено, но Push отправить не удалось"
          : ` · Push: ${data.push?.sent ?? 0} на ${data.push?.subscriptions ?? 0} устройств`
        : "";
      setStatus((editingId ? "Объявление обновлено" : "Объявление опубликовано") + pushText);
      resetForm();
      await load();
    } catch (value) {
      setStatus(value instanceof Error ? value.message : "Не удалось сохранить объявление");
    } finally { setBusy(false); }
  };

  const setActive = async (item: DashboardAnnouncement, active: boolean) => {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось изменить объявление");
      setItems(current => current.map(value => value.id === item.id ? data.announcement : value));
    } catch (value) {
      setStatus(value instanceof Error ? value.message : "Не удалось изменить объявление");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить объявление?")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/announcements?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить объявление");
      setItems(current => current.filter(item => item.id !== id));
      if (editingId === id) resetForm();
    } catch (value) {
      setStatus(value instanceof Error ? value.message : "Не удалось удалить объявление");
    } finally { setBusy(false); }
  };

  const previewStyle = {
    "--announcement-accent": accentColor,
    "--announcement-bg": backgroundColor,
    "--announcement-text": announcementTextColor(backgroundColor),
  } as CSSProperties;

  return <>
    <AdminHeading
      title="Объявления"
      description="Показывай сообщения на дашборде всем или выбранным людям, настраивай цвет и при необходимости дублируй публикацию Push-уведомлением."
      actions={<button className="admin-secondary" disabled={loading} onClick={() => void load()}>↻ Обновить</button>}
    />

    <section ref={formRef} className="admin-card admin-form-panel admin-announcement-create">
      <div className="admin-announcement-form-head">
        <div><p className="admin-eyebrow">{editingId ? "Редактирование" : "Новое объявление"}</p><h2>{editingId ? "Изменить объявление" : "Сообщение на дашборде"}</h2></div>
        {editingId && <button type="button" className="admin-secondary" onClick={resetForm}>Отмена</button>}
      </div>

      <label>Заголовок<input className="admin-input" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, Сбор группы"/></label>
      <label>Текст<textarea className="admin-input" rows={4} maxLength={1200} value={body} onChange={event => setBody(event.target.value)} placeholder="Что нужно сообщить…"/></label>

      <label>Кому<div className="admin-chip-row"><button type="button" className={audience==="all"?"is-active":""} onClick={()=>setAudience("all")}>Всем</button><button type="button" className={audience==="selected"?"is-active":""} onClick={()=>setAudience("selected")}>Выбранным{selected.length ? " · " + selected.length : ""}</button></div></label>
      {audience==="selected"&&<div className="admin-announcement-recipient-picker"><input className="admin-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Найти человека…"/><div className="admin-announcement-people">{filtered.map(person=><button type="button" key={person.id} className={selected.includes(person.id)?"is-active":""} onClick={()=>togglePerson(person.id)}>{person.name}</button>)}</div></div>}

      <div className="admin-announcement-colors">
        <div>
          <label>Цвет объявления</label>
          <div className="admin-announcement-palette">
            {ANNOUNCEMENT_COLOR_PRESETS.map(preset =>
              <button
                type="button"
                key={preset.id}
                className={accentColor===preset.accent&&backgroundColor===preset.background?"is-active":""}
                onClick={()=>{setAccentColor(preset.accent);setBackgroundColor(preset.background)}}
                title={preset.label}
                aria-label={preset.label}
                style={{"--swatch-accent":preset.accent,"--swatch-bg":preset.background} as CSSProperties}
              />
            )}
          </div>
        </div>
        <label>Акцент<input type="color" value={accentColor} onChange={event=>setAccentColor(event.target.value)}/></label>
        <label>Фон<input type="color" value={backgroundColor} onChange={event=>setBackgroundColor(event.target.value)}/></label>
      </div>

      <div className="admin-announcement-preview" style={previewStyle}>
        <span>ПРЕДПРОСМОТР</span>
        <strong>{title.trim() || "Заголовок объявления"}</strong>
        <p>{body.trim() || "Здесь будет текст объявления."}</p>
      </div>

      <label>Показывать до <small>необязательно</small><input className="admin-input" type="datetime-local" value={endsAt} onChange={event=>setEndsAt(event.target.value)}/></label>

      <label className="admin-announcement-push-toggle">
        <input type="checkbox" checked={sendPush} onChange={event=>setSendPush(event.target.checked)}/>
        <span><strong>{editingId ? "Отправить Push после сохранения" : "Отправить Push вместе с публикацией"}</strong><small>Получат те же пользователи, которым показывается объявление. Текст Push будет сокращён при необходимости.</small></span>
      </label>

      <div className="admin-form-actions">
        <button className="admin-primary" disabled={busy||!title.trim()||!body.trim()||(audience==="selected"&&!selected.length)} onClick={()=>void save()}>
          {busy ? "Сохраняю…" : editingId ? "Сохранить изменения" : sendPush ? "Опубликовать и отправить Push" : "Опубликовать"}
        </button>
      </div>
      {status&&<p className="admin-success">{status}</p>}
    </section>

    {loading ? <LoadingState compact label="Загружаем объявления" detail="Получаем активные и архивные сообщения."/> :
      <section className="admin-card admin-announcements-list">
        <header><strong>Объявления</strong><span>{items.length}</span></header>
        {items.length ? items.map(item => {
          const colors = announcementColors(item);
          const style = {
            "--announcement-accent": colors.accentColor,
            "--announcement-bg": colors.backgroundColor,
            "--announcement-text": announcementTextColor(colors.backgroundColor),
          } as CSSProperties;
          return <article key={item.id} className={item.active?"is-active":""} style={style}>
            <div>
              <span>{(item.active?"АКТИВНО":"ВЫКЛЮЧЕНО") + " · " + (item.audience==="all"?"ВСЕМ":item.recipientIds.length+" ЧЕЛ.")}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>{item.endsAt ? "до " + new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(item.endsAt)) : "без срока"}</small>
            </div>
            <div>
              <button className="admin-secondary" disabled={busy} onClick={()=>edit(item)}>Редактировать</button>
              <button className="admin-secondary" disabled={busy} onClick={()=>void setActive(item,!item.active)}>{item.active?"Скрыть":"Включить"}</button>
              <button className="admin-danger" disabled={busy} onClick={()=>void remove(item.id)}>Удалить</button>
            </div>
          </article>;
        }) : <p className="admin-empty">Объявлений пока нет.</p>}
      </section>}
  </>;
}
