"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SeminarList, SeminarTopic } from "@/lib/seminars";

type Person = { id: string; name: string };
type Editor = { listId: string; topicId: string; revision: number; ids: string[] };
export default function Seminars({ admin = false }: { admin?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<SeminarList[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [topics, setTopics] = useState("");
  const generation = useRef(0);
  const endpoint = admin ? "/api/admin/seminars" : "/api/seminars";
  const load = useCallback(async () => {
    const version = ++generation.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить темы");
      if (version !== generation.current) return;
      setLists(data.lists);
      if (admin) { setPeople(data.people); setSubjects(data.subjects); }
      setError("");
    } catch (e) {
      if (version === generation.current) setError(e instanceof Error ? e.message : "Нет подключения к сети. Попробуй обновить страницу");
    } finally { if (version === generation.current) setLoading(false); }
  }, [admin, endpoint]);
  useEffect(() => {
    const sync = () => setPersonId(localStorage.getItem("schedule_person_id"));
    const initial = window.setTimeout(() => { sync(); void load(); }, 0);
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", sync);
    window.addEventListener("schedule-auth-change", sync);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", sync);
      window.removeEventListener("schedule-auth-change", sync);
    };
  }, [load]);
  async function mutate(method: string, body: unknown, success: string) {
    if (busy) return false;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) {
        await load();
        if (response.status === 409) setEditor(null);
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      await load(); setNotice(success); return true;
    } catch (e) { setNotice(e instanceof Error ? e.message : "Не удалось сохранить. Проверь подключение к сети"); return false; }
    finally { setBusy(false); }
  }
  const groups = [...new Set(lists.map(list => list.subject))].sort((a,b) => a.localeCompare(b,"ru"));
  function edit(list: SeminarList, topic: SeminarTopic) {
    setEditor({ listId: list.id, topicId: topic.id, revision: list.revision, ids: [...topic.studentIds] });
  }
  async function remove(list: SeminarList) {
    if (!confirm(`Удалить семинар «${list.title}» со всеми темами и записями?`)) return;
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(list.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось удалить семинар");
      setEditor(current => current?.listId === list.id ? null : current);
      setLists(current => current.filter(item => item.id !== list.id));
      setNotice("Семинар удалён");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Не удалось удалить семинар. Проверь подключение к сети");
    } finally { setBusy(false); }
  }
  return <section className={`seminars ${admin ? "seminars-admin" : "seminars-client"}`}>
    <header className="seminars-heading"><div><p className={admin ? "admin-eyebrow" : "eyebrow"}>{admin ? "Schedule Admin · Панель" : "СЕМИНАРЫ"}</p><h1>{"Семинары"}</h1><span>{admin ? "Создавай списки и управляй участниками." : "Выбирай темы по предметам. Все видят, кто записан."}</span></div>{admin && <button className="admin-secondary" disabled={busy} onClick={() => void load()}>↻ Обновить</button>}</header>
    {error && <p role="alert" className="seminar-message">{error}</p>}
    <AnimatePresence mode="wait">{notice && <motion.p key={notice} role="status" className="seminar-message" initial={{ opacity: 0, y: reducedMotion ? 0 : -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>{notice}</motion.p>}</AnimatePresence>
    {admin && <form className="seminar-create admin-card admin-form-panel" onSubmit={async e => {
      e.preventDefault();
      if (await mutate("POST", { subject, title, capacity, topics: topics.split("\n").map(t => t.trim()).filter(Boolean) }, "Список создан")) { setTitle(""); setTopics(""); }
    }}>
      <p className="admin-eyebrow">Новый список</p><h2>Добавить семинар</h2>
      <div className="seminar-fields"><label>Предмет<input required maxLength={200} list="seminar-subjects" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Выбери или введи предмет" /></label>
      <datalist id="seminar-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>
      <label>Название списка<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, Семинар 3 · Культура речи" /></label>
      <label>Участников на одну тему<select value={capacity} onChange={e => setCapacity(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 || n === 5 ? "человек" : "человека"}</option>)}</select></label></div>
      <label>Темы — каждая с новой строки<textarea required rows={5} value={topics} onChange={e => setTopics(e.target.value)} placeholder={"Первая тема\nВторая тема\nТретья тема"} /></label>
      <div className="seminar-create-footer"><small>До 200 тем. Лимит действует на каждую тему списка.</small><button disabled={busy} className="seminar-primary" type="submit">{busy ? "Сохранение…" : "Создать список"}</button></div>
    </form>}
    {loading ? <p role="status">Загрузка тем…</p> : !lists.length && !error ? <div className="seminar-empty"><h2>Тем пока нет</h2><p>{admin ? "Добавь первый список семинаров выше." : "Здесь появятся списки, которые добавит администратор."}</p></div> : null}
    {!admin && !loading && !personId && <p className="seminar-message"><Link href="/">Выбери своё имя</Link>, чтобы забить тему.</p>}
    {groups.map(group => <section key={group} className="seminar-subject"><h2>{group}</h2>{lists.filter(l => l.subject === group).map(list => <article key={list.id} className="seminar-list">
      <header className="seminar-list-header"><h3>{admin ? <span className="seminar-summary"><span className="seminar-summary-text"><strong>{list.title}</strong><small>Тем: {list.topics.length} · до {list.capacity} чел. на тему</small></span><button type="button" className="seminar-delete admin-danger" disabled={busy} onClick={() => void remove(list)} aria-label={`Удалить семинар ${list.title}`}>Удалить</button></span> : <button className="seminar-summary" aria-expanded={expanded.has(list.id)} aria-controls={`seminar-topics-${list.id}`} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(list.id)) next.delete(list.id); else next.add(list.id); return next; })}><span className="seminar-summary-text"><strong>{list.title}</strong><small>Тем: {list.topics.length} · до {list.capacity} чел. на тему</small></span><span className="seminar-summary-count">{list.topics.filter(t => t.studentIds.length < list.capacity).length} свободно</span><svg className={expanded.has(list.id) ? "is-open" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>}</h3></header>
      <motion.div id={`seminar-topics-${list.id}`} initial={false} animate={{ height: admin || expanded.has(list.id) ? "auto" : 0, opacity: admin || expanded.has(list.id) ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : .26, ease: [.22, 1, .36, 1] }} inert={!admin && !expanded.has(list.id)} aria-hidden={!admin && !expanded.has(list.id)} className="seminar-collapse"><ol>{list.topics.map((topic, index) => {
        const mine = !admin && topic.studentIds.includes(personId ?? "");
        const full = topic.studentIds.length >= list.capacity;
        const editing = editor?.listId === list.id && editor.topicId === topic.id;
        return <li key={topic.id} className={mine ? "seminar-mine" : ""}>
          <div className="seminar-topic"><span className="seminar-number">{String(index + 1).padStart(2,"0")}</span><div className="seminar-topic-info"><h4>{topic.title}</h4><p>{topic.studentNames?.length ? topic.studentNames.join(" · ") : "Пока никто не записан"}</p>{mine && <small>Твоя тема</small>}</div><span className="seminar-capacity">{topic.studentIds.length}/{list.capacity}</span>
          {admin ? <button disabled={busy} onClick={() => edit(list, topic)}>Участники</button> : mine ? <button disabled={busy} onClick={() => void mutate("POST", { action: "release", listId: list.id, topicId: topic.id, studentId: personId }, "Запись отменена")}>Отменить запись</button> : <button className={!full ? "seminar-primary" : ""} disabled={busy || full || !personId} onClick={() => void mutate("POST", { action: "claim", listId: list.id, topicId: topic.id, studentId: personId }, "Сохранено")}>{full ? "Занято" : "Забить тему"}</button>}</div>
          {editing && <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} className="seminar-editor"><p>Лимит — {list.capacity} чел. Можно освободить все места.</p>
            {Array.from({ length: list.capacity }, (_, slot) => <label key={slot}>Участник {slot + 1}<select value={editor.ids[slot] ?? ""} onChange={e => { const ids = [...editor.ids]; ids[slot] = e.target.value; setEditor({ ...editor, ids }); }}><option value="">Свободное место</option>{editor.ids[slot] && !people.some(p => p.id === editor.ids[slot]) && <option value={editor.ids[slot]}>Недоступный пользователь — замени или убери</option>}{people.map(p => <option key={p.id} value={p.id} disabled={editor.ids.some((id, i) => i !== slot && id === p.id)}>{p.name}</option>)}</select></label>)}
            <div className="seminar-editor-actions"><button disabled={busy} onClick={() => setEditor(null)}>Отмена</button><button className="seminar-primary" disabled={busy} onClick={async () => { if (await mutate("PUT", { listId: list.id, topicId: topic.id, revision: editor.revision, studentIds: editor.ids.filter(Boolean) }, "Участники обновлены")) setEditor(null); }}>Сохранить участников</button></div>
          </motion.div>}
        </li>;
      })}</ol></motion.div>
    </article>)}</section>)}
  </section>;
}
