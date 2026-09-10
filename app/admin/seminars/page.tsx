"use client";
import { useEffect, useMemo, useState } from "react";
import type { SeminarTopic } from "@/lib/seminars";

type Topic = SeminarTopic & { studentNames?: string[] };
type Form = { subject: string; title: string; capacity: number };
const emptyForm = (): Form => ({ subject: "", title: "", capacity: 1 });

export default function AdminSeminarsPage() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subject, setSubject] = useState("all");
  const [form, setForm] = useState<Form | null>(null);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/seminars${subject !== "all" ? `?subject=${encodeURIComponent(subject)}` : ""}`, { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/admin"; return; }
    const data = await response.json();
    setSubjects(data.subjects ?? []); setTopics(data.topics ?? []); setLoading(false);
  };
  useEffect(() => { void load(); }, [subject]);

  const visible = useMemo(() => subject === "all" ? topics : topics.filter((topic) => topic.subject === subject), [topics, subject]);
  const save = async () => {
    if (!form || !form.subject || !form.title.trim() || !Number.isInteger(form.capacity) || form.capacity < 1 || form.capacity > 100) { setMessage("Выбери предмет, укажи тему и количество мест"); return; }
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/seminars", { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, title: form.title.trim(), ...(editId ? { id: editId } : {}) }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "Ошибка сохранения"); return; }
    setForm(null); setEditId(""); setMessage(editId ? "Тема обновлена" : "Тема добавлена"); await load();
  };
  const remove = async (id: string) => { if (!confirm("Удалить тему семинара?")) return; await fetch(`/api/admin/seminars?id=${encodeURIComponent(id)}`, { method: "DELETE" }); await load(); };

  if (loading) return <main className="seminars-admin"><div className="seminar-spinner" /></main>;
  return <main className="seminars-admin">
    <header className="seminars-admin-head"><div><a href="/admin">← Админка</a><p>СЕМИНАРЫ</p><h1>Темы</h1><span>Предмет → темы → количество мест.</span></div><button onClick={() => { setEditId(""); setForm(emptyForm()); }}>＋ Добавить тему</button></header>
    <div className="seminars-admin-filter"><button className={subject === "all" ? "active" : ""} onClick={() => setSubject("all")}>Все предметы</button>{subjects.map((item) => <button key={item} className={subject === item ? "active" : ""} onClick={() => setSubject(item)}>{item}</button>)}</div>
    {message && <p className="seminars-admin-message">{message}</p>}
    <section className="seminars-admin-list">{visible.length ? visible.map((topic) => <article className="seminars-admin-card" key={topic.id}><div><span className="seminars-admin-subject">{topic.subject}</span><h2>{topic.title}</h2><p>{topic.studentIds.length}/{topic.capacity} мест занято</p>{topic.studentNames?.length ? <small>Записаны: {topic.studentNames.join(", ")}</small> : <small>Пока никто не записан</small>}</div><div className="seminars-admin-actions"><button onClick={() => { setEditId(topic.id); setForm({ subject: topic.subject, title: topic.title, capacity: topic.capacity }); }}>Изменить</button><button onClick={() => void remove(topic.id)}>Удалить</button></div></article>) : <div className="seminars-admin-empty">Тем пока нет.</div>}</section>
    {form && <div className="seminars-admin-overlay" onMouseDown={() => setForm(null)}><section className="seminars-admin-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{editId ? "ТЕМА" : "НОВАЯ ТЕМА"}</p><h2>{editId ? "Изменить тему" : "Добавить тему"}</h2></div><button onClick={() => setForm(null)}>×</button></header><div className="seminars-admin-form"><label>Предмет<select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}><option value="">Выбери предмет</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Тема семинара<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Например, Анализ произведения" /></label><label>Количество мест<input type="number" min="1" max="100" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label></div><footer><button onClick={() => setForm(null)}>Отмена</button><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></footer></section></div>}
  </main>;
}
