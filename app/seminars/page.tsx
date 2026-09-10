"use client";
import { useEffect, useMemo, useState } from "react";
import type { SeminarTopic } from "@/lib/seminars";
import "./seminars.css";

type Topic = SeminarTopic & { studentNames?: string[] };

export default function SeminarsPage() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [personId, setPersonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { setPersonId(localStorage.getItem("schedule_person_id") ?? ""); }, []);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
      const response = await fetch(`/api/seminars${query}`, { cache: "no-store" });
      const data = await response.json();
      setSubjects(data.subjects ?? []);
      setTopics(data.topics ?? []);
      setLoading(false);
    };
    void load();
  }, [subject]);

  const myTopics = useMemo(() => topics.filter((topic) => personId && topic.studentIds.includes(personId)), [topics, personId]);
  const toggle = async (topic: Topic) => {
    if (!personId) { setMessage("Сначала выбери свой профиль"); return; }
    const mine = topic.studentIds.includes(personId);
    setBusy(topic.id); setMessage("");
    const response = await fetch("/api/seminars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mine ? "release" : "claim", topicId: topic.id, studentId: personId }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Не удалось изменить запись"); setBusy(""); return; }
    setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, ...(data.topic ?? {}), studentIds: data.topic?.studentIds ?? item.studentIds } : item));
    setBusy("");
  };

  return <main className="seminars-page">
    <header className="seminars-header"><p>СЕМИНАРЫ</p><h1>Темы семинаров</h1><span>Выбери предмет, посмотри доступные темы и займи место.</span></header>
    <div className="seminar-subjects" aria-label="Предметы">
      {subjects.map((item) => <button key={item} className={subject === item ? "active" : ""} onClick={() => setSubject(item)}>{item}</button>)}
    </div>
    {message && <p className="seminar-message">{message}</p>}
    {loading ? <div className="seminar-loading"><div className="seminar-spinner"/></div> : <>
      {myTopics.length > 0 && <section className="seminar-my"><p>МОИ ЗАПИСИ</p>{myTopics.map((topic) => <article key={topic.id}><div><strong>{topic.title}</strong><span>{topic.subject} · {topic.studentIds.length}/{topic.capacity}</span></div><button onClick={() => void toggle(topic)} disabled={busy === topic.id}>Отменить</button></article>)}</section>}
      {subject ? <section className="seminar-topics"><div className="seminar-section-title"><p>{subject}</p><span>{topics.length} {topics.length === 1 ? "тема" : "тем"}</span></div>{topics.length ? topics.map((topic) => { const used = topic.studentIds.length; const mine = topic.studentIds.includes(personId); const full = used >= topic.capacity; return <article className={`seminar-topic ${mine ? "mine" : ""}`} key={topic.id}><div className="seminar-topic-main"><span className="seminar-topic-index">{String(topics.indexOf(topic)+1).padStart(2,"0")}</span><div><h2>{topic.title}</h2><span>{used} из {topic.capacity} мест занято</span></div></div><button className={mine ? "cancel" : ""} disabled={busy === topic.id || (!mine && full)} onClick={() => void toggle(topic)}>{busy === topic.id ? "…" : mine ? "Отменить" : full ? "Мест нет" : "Записаться"}</button></article>; }) : <div className="seminar-empty">Для этого предмета пока нет тем.</div>}</section> : <div className="seminar-placeholder">Выбери предмет, чтобы увидеть темы семинаров.</div>}
    </>}
  </main>;
}
