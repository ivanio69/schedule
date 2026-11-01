"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";
import AsyncContentTransition from "@/components/AsyncContentTransition";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SeminarList, SeminarTopic, SeminarDateMode } from "@/lib/seminars";

type Person = { id: string; name: string };
type Editor = { listId: string; topicId: string; revision: number; ids: string[] };
export default function Seminars({ admin = false }: { admin?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "mine">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<SeminarList[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [listEditor, setListEditor] = useState<SeminarList | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [topics, setTopics] = useState("");
  const [newDateMode, setNewDateMode] = useState<SeminarDateMode>("none");
  const [newSeminarDate, setNewSeminarDate] = useState("");
  const [newTopicDates, setNewTopicDates] = useState<string[]>([]);
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
        if (response.status === 409) { setEditor(null); setListEditor(null); }
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      await load(); setNotice(success); return true;
    } catch (e) { setNotice(e instanceof Error ? e.message : "Не удалось сохранить. Проверь подключение к сети"); return false; }
    finally { setBusy(false); }
  }
  const dateText = (value?: string) => value ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "";
  const draftTopicTitles = topics.split("\n").map(value => value.trim()).filter(Boolean);
  const search = query.trim().toLocaleLowerCase("ru");
  const matches = (list: SeminarList, topic: SeminarTopic) => admin || (
    (!search || `${list.subject} ${list.title} ${topic.title} ${(topic.studentNames ?? []).join(" ")}`.toLocaleLowerCase("ru").includes(search)) &&
    (filter === "all" || (filter === "free" ? topic.studentIds.length < list.capacity : !!personId && topic.studentIds.includes(personId)))
  );
  const visibleLists = lists.filter(list => list.topics.some(topic => matches(list, topic)));
  const filtering = !admin && (!!search || filter !== "all");
  const isOpen = (id: string) => admin || filtering || expanded.has(id);
  const groups = [...new Set(visibleLists.map(list => list.subject))].sort((a,b) => a.localeCompare(b,"ru"));
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
      setListEditor(current => current?.id === list.id ? null : current);
      setLists(current => current.filter(item => item.id !== list.id));
      setNotice("Семинар удалён");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Не удалось удалить семинар. Проверь подключение к сети");
    } finally { setBusy(false); }
  }
  async function uploadFiles(list: SeminarList, selected: FileList | null) {
    if (!selected?.length || busy) return;
    setBusy(true); setNotice("");
    let uploaded = 0;
    try {
      for (const file of Array.from(selected)) {
        const form = new FormData();
        form.set("listId", list.id);
        form.set("file", file);
        const response = await fetch("/api/admin/seminars/files", { method: "POST", body: form });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Не удалось прикрепить файл");
        uploaded++;
      }
      setNotice(uploaded === 1 ? "Файл прикреплён" : `Прикреплено файлов: ${uploaded}`);
    } catch (error) {
      setNotice((error instanceof Error ? error.message : "Не удалось прикрепить файлы") + (uploaded ? ` · добавлено: ${uploaded}` : ""));
    } finally { await load(); setBusy(false); }
  }
  async function removeAttachment(list: SeminarList, fileId: string) {
    if (busy || !confirm("Удалить этот файл из семинара?")) return;
    setBusy(true); setNotice("");
    try {
      const query = new URLSearchParams({ listId: list.id, fileId });
      const response = await fetch(`/api/admin/seminars/files?${query}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось удалить файл");
      setNotice("Файл удалён");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось удалить файл"); }
    finally { await load(); setBusy(false); }
  }
  return <section className={`seminars ${admin ? "seminars-admin" : "seminars-client"}`}>
    {admin ? <AdminHeading title="Семинары" description="Создавай темы и управляй участниками." actions={<button className="admin-secondary" disabled={busy} onClick={() => void load()}>Обновить</button>}/> : <header className="seminars-heading"><div><h1>Семинары</h1><span>Выбирай темы по предметам. Все видят, кто записан.</span></div></header>}
    {error && <p role="alert" className="seminar-message">{error}</p>}
    <AnimatePresence mode="wait">{notice && <motion.p key={notice} role="status" className="seminar-message" initial={{ opacity: 0, y: reducedMotion ? 0 : -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>{notice}</motion.p>}</AnimatePresence>
    {admin && <form className="seminar-create admin-card admin-form-panel" onSubmit={async e => {
      e.preventDefault();
      if (await mutate("POST", { subject, title, capacity, topics: draftTopicTitles, dateMode: newDateMode, date: newDateMode === "all" ? newSeminarDate : undefined, topicDates: newDateMode === "topics" ? draftTopicTitles.map((_, index) => newTopicDates[index] ?? "") : [] }, "Список создан")) { setTitle(""); setTopics(""); setNewTopicDates([]); setNewSeminarDate(""); }
    }}>
      <p className="admin-eyebrow">Новый список</p><h2>Добавить семинар</h2>
      <div className="seminar-fields"><label>Предмет<input required maxLength={200} list="seminar-subjects" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Выбери или введи предмет" /></label>
      <datalist id="seminar-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>
      <label>Название списка<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, Семинар 3 · Культура речи" /></label>
      <label>Участников на одну тему<select value={capacity} onChange={e => setCapacity(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 || n === 5 ? "человек" : "человека"}</option>)}</select></label></div>
      <label>Темы — каждая с новой строки<textarea required rows={5} value={topics} onChange={e => setTopics(e.target.value)} placeholder={"Первая тема\nВторая тема\nТретья тема"} /></label>
      <div className="seminar-date-settings"><label>Даты проведения<select value={newDateMode} onChange={e => setNewDateMode(e.target.value as SeminarDateMode)}><option value="none">Пока без дат</option><option value="all">Одна дата для всех тем</option><option value="topics">Своя дата для каждой темы</option></select></label>
        {newDateMode === "all" && <label>Дата семинара<input type="date" required value={newSeminarDate} onChange={e => setNewSeminarDate(e.target.value)}/></label>}
        {newDateMode === "topics" && <div className="seminar-topic-dates">{draftTopicTitles.map((topic, index) => <label key={index}><span>{index + 1}. {topic}</span><input type="date" value={newTopicDates[index] ?? ""} onChange={e => setNewTopicDates(values => { const next = [...values]; next[index] = e.target.value; return next; })}/></label>)}</div>}
      </div>
      <div className="seminar-create-footer"><small>До 200 тем. Лимит действует на каждую тему списка.</small><button disabled={busy} className="seminar-primary" type="submit">{busy ? "Сохранение…" : "Создать список"}</button></div>
    </form>}
    <AsyncContentTransition loading={loading} loadingNode={<LoadingState screen={!admin} compact={admin} label="Загружаем семинары" detail={admin ? "Получаем темы и участников." : "Получаем актуальные темы и записи."}/>} className="seminars-loaded-content">
    {!lists.length && !error ? <div className="seminar-empty"><h2>Тем пока нет</h2><p>{admin ? "Добавь первый список семинаров выше." : "Здесь появятся списки, которые добавит администратор."}</p></div> : null}
    {!admin && !personId && <p className="seminar-message"><Link href="/">Выбери своё имя</Link>, чтобы забить тему.</p>}
    {!admin && lists.length > 0 && <div className="seminar-tools">
      <label className="seminar-search"><span>Найти тему</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Предмет, тема или участник" /></label>
      <div className="seminar-filters" role="group" aria-label="Показать темы">{([['all', 'Все'], ['free', 'Свободные'], ['mine', 'Мои']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <p role="status">Найдено тем: {visibleLists.reduce((total, list) => total + list.topics.filter(topic => matches(list, topic)).length, 0)}</p>
    </div>}
    {!admin && lists.length > 0 && !visibleLists.length && <div className="seminar-empty"><h2>{filter === "mine" && !search ? "Пока нет твоих тем" : "Ничего не найдено"}</h2><p>Попробуй другой запрос или посмотри все темы.</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Показать все темы</button></div>}
    {groups.map(group => <section key={group} className="seminar-subject"><h2>{group}</h2>{visibleLists.filter(l => l.subject === group).map(list => { const listIsMine = !admin && list.topics.some(topic => topic.studentIds.includes(personId ?? "")); return <article key={list.id} className={`seminar-list${listIsMine ? " seminar-list-mine" : ""}`}>
      <header className="seminar-list-header"><h3>{admin ? <span className="seminar-summary"><span className="seminar-summary-text"><strong>{list.title}</strong><small>Тем: {list.topics.length} · до {list.capacity} чел. на тему{list.dateMode === "all" && list.date ? ` · ${dateText(list.date)}` : ""}</small></span><button type="button" disabled={busy || listEditor !== null} onClick={() => { setEditor(null); setListEditor({ ...list, dateMode: list.dateMode ?? "none", topics: list.topics.map(topic => ({ ...topic })) }); }} aria-label={`Редактировать семинар ${list.title}`}>Изменить</button><button type="button" className="seminar-delete admin-danger" disabled={busy} onClick={() => void remove(list)} aria-label={`Удалить семинар ${list.title}`}>Удалить</button></span> : <button className="seminar-summary" disabled={filtering} aria-expanded={isOpen(list.id)} aria-controls={`seminar-topics-${list.id}`} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(list.id)) next.delete(list.id); else next.add(list.id); return next; })}><span className="seminar-summary-text"><strong>{list.title}</strong><small>Тем: {list.topics.length} · до {list.capacity} чел. на тему{list.dateMode === "all" && list.date ? ` · ${dateText(list.date)}` : ""}</small></span>{listIsMine && <span className="seminar-mine-badge">Мой семинар</span>}<span className="seminar-summary-count">{list.topics.filter(t => t.studentIds.length < list.capacity).length} свободно</span><svg className={isOpen(list.id) ? "is-open" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>}</h3></header>
      {((list.files?.length ?? 0) > 0 || admin) && <section className="seminar-attachments" aria-label="Материалы семинара">
        <div className="seminar-attachments__heading"><strong>Материалы</strong><span>{list.files?.length ?? 0} файлов</span></div>
        {list.files?.length ? <ul>{list.files.map(file => <li key={file.id}>
          <a href={`/api/seminars/files/${encodeURIComponent(file.id)}`} download title={file.name}><span aria-hidden="true">↧</span><span className="seminar-attachments__name">{file.name}</span><small>{file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ` : `${Math.ceil(file.size / 1024)} КБ`}</small></a>
          {admin && <button type="button" disabled={busy || listEditor !== null} onClick={() => void removeAttachment(list, file.id)} aria-label={`Удалить файл ${file.name}`}>×</button>}
        </li>)}</ul> : <p>Файлов пока нет.</p>}
        {admin && <label className="seminar-attachments__upload">＋ Прикрепить файлы<input type="file" multiple disabled={busy || listEditor !== null} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.odp,.ods,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.m4a,.mp4,.mov,.zip" onChange={event => { const files = event.target.files; void uploadFiles(list, files); event.target.value = ""; }}/></label>}
        {admin && <small>До 20 файлов по 4 МБ. Файлы доступны всем участникам.</small>}
      </section>}
      {admin && listEditor?.id === list.id && <form className="seminar-list-edit" onSubmit={async e => {
        e.preventDefault();
        if (await mutate("PATCH", { listId: listEditor.id, revision: listEditor.revision, subject: listEditor.subject, title: listEditor.title, capacity: listEditor.capacity, topics: listEditor.topics.map(topic => ({ ...(list.topics.some(existing => existing.id === topic.id) ? { id: topic.id } : {}), title: topic.title, date: listEditor.dateMode === "topics" ? topic.date ?? "" : "" })), dateMode: listEditor.dateMode ?? "none", date: listEditor.dateMode === "all" ? listEditor.date : undefined }, "Семинар обновлён")) setListEditor(null);
      }}>
        <fieldset disabled={busy}>
          <legend>Редактирование семинара</legend>
          <div className="seminar-fields">
            <label>Предмет<input required maxLength={200} list="seminar-subjects" value={listEditor.subject} onChange={e => setListEditor({ ...listEditor, subject: e.target.value })} /></label>
            <label>Название списка<input required maxLength={200} value={listEditor.title} onChange={e => setListEditor({ ...listEditor, title: e.target.value })} /></label>
            <label>Участников на одну тему<select value={listEditor.capacity} onChange={e => setListEditor({ ...listEditor, capacity: Number(e.target.value) as SeminarList["capacity"] })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          </div>
          <div className="seminar-date-settings"><label>Даты проведения<select value={listEditor.dateMode ?? "none"} onChange={e => setListEditor({ ...listEditor, dateMode: e.target.value as SeminarDateMode })}><option value="none">Пока без дат</option><option value="all">Одна дата для всех тем</option><option value="topics">Своя дата для каждой темы</option></select></label>
            {listEditor.dateMode === "all" && <label>Дата семинара<input type="date" required value={listEditor.date ?? ""} onChange={e => setListEditor({ ...listEditor, date: e.target.value })}/></label>}
          </div>
          <p>Записи сохранятся при переименовании. Для удаления занятой темы сначала освободи места через «Участники».</p>
          <div className="seminar-edit-topics">{listEditor.topics.map((topic, index) => <div className="seminar-edit-topic" key={topic.id}>
            <label>Тема {index + 1}<textarea required maxLength={1000} rows={2} value={topic.title} onChange={e => setListEditor({ ...listEditor, topics: listEditor.topics.map(item => item.id === topic.id ? { ...item, title: e.target.value } : item) })} /><small>{topic.studentIds.length} записавшихся</small></label>{listEditor.dateMode === "topics" && <label className="seminar-edit-topic-date">Дата темы<input type="date" value={topic.date ?? ""} onChange={e => setListEditor({ ...listEditor, topics: listEditor.topics.map(item => item.id === topic.id ? { ...item, date: e.target.value } : item) })}/></label>}
            <button type="button" disabled={topic.studentIds.length > 0 || listEditor.topics.length === 1} aria-label={`Удалить тему ${index + 1}`} onClick={() => setListEditor({ ...listEditor, topics: listEditor.topics.filter(item => item.id !== topic.id) })}>Удалить тему</button>
          </div>)}</div>
          <button type="button" disabled={listEditor.topics.length >= 200} onClick={() => setListEditor({ ...listEditor, topics: [...listEditor.topics, { id: crypto.randomUUID(), title: "", studentIds: [] }] })}>＋ Добавить тему</button>
          <div className="seminar-editor-actions"><button type="button" onClick={() => setListEditor(null)}>Отмена</button><button type="submit" className="seminar-primary">{busy ? "Сохранение…" : "Сохранить изменения"}</button></div>
        </fieldset>
      </form>}
      <motion.div id={`seminar-topics-${list.id}`} initial={false} animate={{ height: admin || isOpen(list.id) ? "auto" : 0, opacity: admin || isOpen(list.id) ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : .26, ease: [.22, 1, .36, 1] }} inert={!admin && !isOpen(list.id)} aria-hidden={!admin && !isOpen(list.id)} className="seminar-collapse"><ol>{list.topics.map((topic, index) => {
        if (!matches(list, topic)) return null;
        const mine = !admin && topic.studentIds.includes(personId ?? "");
        const full = topic.studentIds.length >= list.capacity;
        const editing = editor?.listId === list.id && editor.topicId === topic.id;
        return <li key={topic.id} className={mine ? "seminar-mine" : ""}>
          <div className="seminar-topic"><span className="seminar-number">{String(index + 1).padStart(2,"0")}</span><div className="seminar-topic-info"><h4>{topic.title}</h4>{(topic.date || (list.dateMode === "all" && list.date)) && <div className="seminar-topic-date">{dateText(topic.date || list.date)}</div>}<p>{topic.studentNames?.length ? topic.studentNames.join(" · ") : "Пока никто не записан"}</p>{mine && <small>Твоя тема</small>}</div><span className="seminar-capacity">{topic.studentIds.length}/{list.capacity}</span>
          {admin ? <button disabled={busy || listEditor !== null} onClick={() => edit(list, topic)}>Участники</button> : mine ? <button disabled={busy} onClick={() => void mutate("POST", { action: "release", listId: list.id, topicId: topic.id, studentId: personId }, "Запись отменена")}>Отменить запись</button> : <button className={!full ? "seminar-primary" : ""} disabled={busy || full || !personId} onClick={() => void mutate("POST", { action: "claim", listId: list.id, topicId: topic.id, studentId: personId }, "Сохранено")}>{full ? "Занято" : "Забить тему"}</button>}</div>
          {editing && <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} className="seminar-editor"><p>Лимит — {list.capacity} чел. Можно освободить все места.</p>
            {Array.from({ length: list.capacity }, (_, slot) => <label key={slot}>Участник {slot + 1}<select value={editor.ids[slot] ?? ""} onChange={e => { const ids = [...editor.ids]; ids[slot] = e.target.value; setEditor({ ...editor, ids }); }}><option value="">Свободное место</option>{editor.ids[slot] && !people.some(p => p.id === editor.ids[slot]) && <option value={editor.ids[slot]}>Недоступный пользователь — замени или убери</option>}{people.map(p => <option key={p.id} value={p.id} disabled={editor.ids.some((id, i) => i !== slot && id === p.id)}>{p.name}</option>)}</select></label>)}
            <div className="seminar-editor-actions"><button disabled={busy} onClick={() => setEditor(null)}>Отмена</button><button className="seminar-primary" disabled={busy} onClick={async () => { if (await mutate("PUT", { listId: list.id, topicId: topic.id, revision: editor.revision, studentIds: editor.ids.filter(Boolean) }, "Участники обновлены")) setEditor(null); }}>Сохранить участников</button></div>
          </motion.div>}
        </li>;
      })}</ol></motion.div>
    </article>})}</section>)}
    </AsyncContentTransition>
  </section>;
}
