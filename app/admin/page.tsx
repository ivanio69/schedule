"use client";

import { useEffect, useMemo, useState } from "react";

type Lesson = { class: string; professor: string; auditorium: string; timeStart: string; timeEnd: string; group: number[]; weeks: number[]; [key: string]: unknown };
type Day = { table: Lesson[]; [key: string]: unknown };
type Schedule = { semesterStart: number[]; days: Day[]; [key: string]: unknown };

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"] as const;
const emptyLesson = (): Lesson => ({ class: "", professor: "", auditorium: "09:00", timeStart: "09:00", timeEnd: "10:30", group: [1, 2], weeks: [] });

function normalize(value: unknown): Schedule | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Schedule>;
  if (!Array.isArray(data.semesterStart) || data.semesterStart.length !== 3 || !data.semesterStart.every((v) => Number.isInteger(v))) return null;
  if (!Array.isArray(data.days)) return null;
  if (!data.days.every((d) => d && typeof d === "object" && Array.isArray(d.table))) return null;
  return data as Schedule;
}

function dateToSemesterStart(value: string): number[] | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return [year, month - 1, day];
}

function semesterStartToDate(value: number[]) {
  if (value.length !== 3) return "";
  const [year, month, day] = value;
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");

  const load = async () => {
    setLoading(true); setMessage("");
    const response = await fetch("/api/admin/schedule", { cache: "no-store" });
    if (response.status === 401) { setLoggedIn(false); setLoading(false); return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Не удалось загрузить расписание"); setLoading(false); return; }
    const normalized = normalize(data.schedule);
    if (!normalized) { setMessage("MongoDB вернула расписание в неожиданном формате."); setLoading(false); return; }
    setSchedule(normalized); setRaw(JSON.stringify(normalized, null, 2)); setLoggedIn(true); setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const login = async () => {
    setMessage("");
    const response = await fetch("/api/admin/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Неверный пароль"); return; }
    setPassword(""); await load();
  };

  const updateLesson = (dayIndex: number, lessonIndex: number, patch: Partial<Lesson>) => {
    setSchedule((current) => {
      if (!current) return current;
      const days = [...current.days]; const table = [...days[dayIndex].table];
      table[lessonIndex] = { ...table[lessonIndex], ...patch }; days[dayIndex] = { ...days[dayIndex], table };
      return { ...current, days };
    });
  };

  const addLesson = (dayIndex: number) => setSchedule((current) => {
    if (!current) return current;
    const days = [...current.days]; days[dayIndex] = { ...days[dayIndex], table: [...days[dayIndex].table, emptyLesson()] };
    return { ...current, days };
  });

  const removeLesson = (dayIndex: number, lessonIndex: number) => setSchedule((current) => {
    if (!current) return current;
    const days = [...current.days]; days[dayIndex] = { ...days[dayIndex], table: days[dayIndex].table.filter((_, i) => i !== lessonIndex) };
    return { ...current, days };
  });

  const toggleGroup = (dayIndex: number, lessonIndex: number, group: number) => {
    const lesson = schedule?.days[dayIndex].table[lessonIndex]; if (!lesson) return;
    const next = lesson.group.includes(group) ? lesson.group.filter((g) => g !== group) : [...lesson.group, group].sort();
    updateLesson(dayIndex, lessonIndex, { group: next });
  };

  const updateSemesterStart = (value: string) => {
    const semesterStart = dateToSemesterStart(value);
    if (!semesterStart) return;
    setSchedule((current) => current ? { ...current, semesterStart } : current);
  };

  const save = async () => {
    if (!schedule) return;
    let payload = schedule;
    if (rawMode) {
      try { const parsed = JSON.parse(raw); const normalized = normalize(parsed); if (!normalized) throw new Error(); payload = normalized; setSchedule(normalized); }
      catch { setMessage("JSON невалиден: проверьте структуру и синтаксис."); return; }
    }
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule: payload }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Ошибка сохранения"); setSaving(false); return; }
    setRaw(JSON.stringify(payload, null, 2)); setMessage("Сохранено в MongoDB"); setSaving(false);
  };

  const lessonCount = useMemo(() => schedule?.days.reduce((sum, day) => sum + day.table.length, 0) ?? 0, [schedule]);

  if (loading) return <main className="admin-shell"><p className="admin-muted">Загрузка…</p></main>;
  if (!loggedIn) return <main className="admin-shell admin-auth"><div className="admin-card admin-auth-card"><p className="admin-eyebrow">Schedule Admin</p><h1>Панель управления</h1><p className="admin-muted">Доступ к редактированию расписания.</p><input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} placeholder="Пароль" autoFocus /><button className="admin-primary" onClick={() => void login()}>Войти</button>{message && <p className="admin-error">{message}</p>}</div></main>;

  return <main className="admin-shell">
    <header className="admin-header"><div><p className="admin-eyebrow">Schedule Admin · MongoDB</p><h1>Расписание</h1><p className="admin-muted">{lessonCount} занятий</p></div><div className="admin-actions"><button className="admin-secondary" onClick={() => void load()}>Обновить</button><button className="admin-primary" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></div></header>
    <section className="admin-card">
      <div className="admin-section-header"><div><p className="admin-eyebrow">Параметры расписания</p><h2>Начало семестра</h2><p className="admin-muted">Эта дата используется для расчёта номеров недель.</p></div></div>
      <label>Дата начала семестра<input className="admin-input" type="date" value={schedule ? semesterStartToDate(schedule.semesterStart) : ""} onChange={(e) => updateSemesterStart(e.target.value)} /></label>
    </section>
    <div className="admin-modebar"><button className={!rawMode ? "is-active" : ""} onClick={() => { setRawMode(false); setRaw(JSON.stringify(schedule, null, 2)); }}>Редактор</button><button className={rawMode ? "is-active" : ""} onClick={() => { setRaw(JSON.stringify(schedule, null, 2)); setRawMode(true); }}>JSON</button></div>
    {rawMode ? <section className="admin-card"><textarea className="admin-json" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} /></section> : <div className="admin-days">{schedule?.days.map((day, dayIndex) => <section className="admin-card" key={dayIndex}><div className="admin-section-header"><div><p className="admin-eyebrow">День недели</p><h2>{DAY_NAMES[dayIndex] ?? `День ${dayIndex + 1}`}</h2></div><button className="admin-secondary" onClick={() => addLesson(dayIndex)}>+ Занятие</button></div><div className="admin-lessons">{day.table.map((lesson, lessonIndex) => <article className="admin-lesson" key={lessonIndex}><div className="admin-lesson-top"><strong>{lessonIndex + 1}. {lesson.class || "Новое занятие"}</strong><button className="admin-danger" onClick={() => removeLesson(dayIndex, lessonIndex)}>Удалить</button></div><div className="admin-grid"><label>Предмет<input className="admin-input" value={lesson.class} onChange={(e) => updateLesson(dayIndex, lessonIndex, { class: e.target.value })} /></label><label>Преподаватель<input className="admin-input" value={lesson.professor} onChange={(e) => updateLesson(dayIndex, lessonIndex, { professor: e.target.value })} /></label><label>Аудитория<input className="admin-input" value={lesson.auditorium} onChange={(e) => updateLesson(dayIndex, lessonIndex, { auditorium: e.target.value })} /></label><label>Начало<input className="admin-input" type="time" value={lesson.timeStart} onChange={(e) => updateLesson(dayIndex, lessonIndex, { timeStart: e.target.value })} /></label><label>Конец<input className="admin-input" type="time" value={lesson.timeEnd} onChange={(e) => updateLesson(dayIndex, lessonIndex, { timeEnd: e.target.value })} /></label><label>Недели<input className="admin-input" value={lesson.weeks.join(", ")} onChange={(e) => updateLesson(dayIndex, lessonIndex, { weeks: e.target.value.split(",").map((v) => Number(v.trim())).filter(Number.isInteger) })} placeholder="1, 2, 3" /></label></div><div className="admin-groups"><span>Подгруппа</span><button className={lesson.group.includes(1) ? "is-active" : ""} onClick={() => toggleGroup(dayIndex, lessonIndex, 1)}>1</button><button className={lesson.group.includes(2) ? "is-active" : ""} onClick={() => toggleGroup(dayIndex, lessonIndex, 2)}>2</button></div></article>)}{!day.table.length && <p className="admin-muted admin-empty">Занятий нет.</p>}</div></section>)}</div>}
    {message && <p className={message === "Сохранено в MongoDB" ? "admin-success" : "admin-error"}>{message}</p>}
  </main>;
}
