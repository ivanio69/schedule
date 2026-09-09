"use client";

import { useEffect, useMemo, useState } from "react";

type Lesson = {
  class: string;
  professor: string;
  auditorium: string;
  timeStart: string;
  timeEnd: string;
  group: number[];
  weeks: number[];
  [key: string]: unknown;
};

type Day = { table: Lesson[]; [key: string]: unknown };
type Schedule = { semesterStart: number[]; days: Day[]; [key: string]: unknown };

const emptyLesson = (): Lesson => ({ class: "", professor: "", auditorium: "", timeStart: "09:00", timeEnd: "10:30", group: [1, 2], weeks: [] });

function normalize(value: unknown): Schedule | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Schedule>;
  if (!Array.isArray(data.semesterStart) || !Array.isArray(data.days)) return null;
  if (!data.days.every((d) => d && typeof d === "object" && Array.isArray(d.table))) return null;
  return data as Schedule;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [sha, setSha] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/schedule", { cache: "no-store" });
    if (response.status === 401) { setLoggedIn(false); setLoading(false); return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Не удалось загрузить расписание"); setLoading(false); return; }
    const normalized = normalize(data.schedule);
    if (!normalized) {
      setMessage("GitHub вернул расписание в неожиданном формате.");
      setLoading(false);
      return;
    }
    setSchedule(normalized);
    setSha(data.sha);
    setRaw(JSON.stringify(normalized, null, 2));
    setLoggedIn(true);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const login = async () => {
    setMessage("");
    const response = await fetch("/api/admin/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Неверный пароль"); return; }
    setPassword("");
    await load();
  };

  const updateLesson = (dayIndex: number, lessonIndex: number, patch: Partial<Lesson>) => {
    setSchedule((current) => {
      if (!current) return current;
      const days = [...current.days];
      const table = [...days[dayIndex].table];
      table[lessonIndex] = { ...table[lessonIndex], ...patch };
      days[dayIndex] = { ...days[dayIndex], table };
      return { ...current, days };
    });
  };

  const addLesson = (dayIndex: number) => {
    setSchedule((current) => {
      if (!current) return current;
      const days = [...current.days];
      days[dayIndex] = { ...days[dayIndex], table: [...days[dayIndex].table, emptyLesson()] };
      return { ...current, days };
    });
  };

  const removeLesson = (dayIndex: number, lessonIndex: number) => {
    setSchedule((current) => {
      if (!current) return current;
      const days = [...current.days];
      days[dayIndex] = { ...days[dayIndex], table: days[dayIndex].table.filter((_, i) => i !== lessonIndex) };
      return { ...current, days };
    });
  };

  const toggleGroup = (dayIndex: number, lessonIndex: number, group: number) => {
    const lesson = schedule?.days[dayIndex].table[lessonIndex];
    if (!lesson) return;
    const has = lesson.group.includes(group);
    const next = has ? lesson.group.filter((g) => g !== group) : [...lesson.group, group].sort();
    updateLesson(dayIndex, lessonIndex, { group: next });
  };

  const save = async () => {
    if (!schedule) return;
    let payload = schedule;
    if (rawMode) {
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalize(parsed);
        if (!normalized) throw new Error();
        payload = normalized;
        setSchedule(normalized);
      } catch { setMessage("JSON невалиден: проверьте структуру и синтаксис."); return; }
    }
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule: payload, sha }) });
    const data = await response.json();
    if (response.status === 409) { setMessage(data.error); setSaving(false); return; }
    if (!response.ok) { setMessage(data.error ?? "Ошибка сохранения"); setSaving(false); return; }
    setSha(data.sha ?? sha);
    setRaw(JSON.stringify(payload, null, 2));
    setMessage("Сохранено в GitHub");
    setSaving(false);
  };

  const lessonCount = useMemo(() => schedule?.days.reduce((sum, day) => sum + day.table.length, 0) ?? 0, [schedule]);

  if (loading) return <main className="admin-shell"><p className="admin-muted">Загрузка…</p></main>;

  if (!loggedIn) return (
    <main className="admin-shell admin-auth">
      <div className="admin-card admin-auth-card">
        <p className="admin-eyebrow">Schedule Admin</p><h1>Панель управления</h1>
        <p className="admin-muted">Доступ к редактированию расписания.</p>
        <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} placeholder="Пароль" autoFocus />
        <button className="admin-primary" onClick={() => void login()}>Войти</button>
        {message && <p className="admin-error">{message}</p>}
      </div>
    </main>
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="admin-eyebrow">Schedule Admin</p><h1>Расписание</h1><p className="admin-muted">{lessonCount} занятий · изменения сразу коммитятся в GitHub</p></div>
        <div className="admin-actions"><button className="admin-secondary" onClick={() => void load()}>Обновить</button><button className="admin-primary" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></div>
      </header>

      <div className="admin-modebar"><button className={!rawMode ? "is-active" : ""} onClick={() => { setRawMode(false); setRaw(JSON.stringify(schedule, null, 2)); }}>Редактор</button><button className={rawMode ? "is-active" : ""} onClick={() => { setRaw(JSON.stringify(schedule, null, 2)); setRawMode(true); }}>JSON</button></div>

      {rawMode ? <section className="admin-card"><textarea className="admin-json" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} /></section> : (
        <div className="admin-days">
          {schedule?.days.map((day, dayIndex) => (
            <section className="admin-card" key={`${dayIndex}`}>
              <div className="admin-section-header"><div><p className="admin-eyebrow">День {dayIndex + 1}</p><h2>День {dayIndex + 1}</h2></div><button className="admin-secondary" onClick={() => addLesson(dayIndex)}>+ Занятие</button></div>
              <div className="admin-lessons">
                {day.table.map((lesson, lessonIndex) => (
                  <article className="admin-lesson" key={lessonIndex}>
                    <div className="admin-lesson-top"><strong>Занятие {lessonIndex + 1}</strong><button className="admin-danger" onClick={() => removeLesson(dayIndex, lessonIndex)}>Удалить</button></div>
                    <div className="admin-grid">
                      <label>Предмет<input className="admin-input" value={lesson.class} onChange={(e) => updateLesson(dayIndex, lessonIndex, { class: e.target.value })} /></label>
                      <label>Преподаватель<input className="admin-input" value={lesson.professor} onChange={(e) => updateLesson(dayIndex, lessonIndex, { professor: e.target.value })} /></label>
                      <label>Аудитория<input className="admin-input" value={lesson.auditorium} onChange={(e) => updateLesson(dayIndex, lessonIndex, { auditorium: e.target.value })} /></label>
                      <label>Начало<input className="admin-input" type="time" value={lesson.timeStart} onChange={(e) => updateLesson(dayIndex, lessonIndex, { timeStart: e.target.value })} /></label>
                      <label>Конец<input className="admin-input" type="time" value={lesson.timeEnd} onChange={(e) => updateLesson(dayIndex, lessonIndex, { timeEnd: e.target.value })} /></label>
                      <label>Недели<input className="admin-input" value={lesson.weeks.join(", ")} onChange={(e) => updateLesson(dayIndex, lessonIndex, { weeks: e.target.value.split(",").map((v) => Number(v.trim())).filter(Number.isInteger) })} placeholder="1, 2, 3" /></label>
                    </div>
                    <div className="admin-groups"><span>Подгруппа</span><button className={lesson.group.includes(1) ? "is-active" : ""} onClick={() => toggleGroup(dayIndex, lessonIndex, 1)}>1</button><button className={lesson.group.includes(2) ? "is-active" : ""} onClick={() => toggleGroup(dayIndex, lessonIndex, 2)}>2</button></div>
                  </article>
                ))}
                {!day.table.length && <p className="admin-muted admin-empty">Занятий нет.</p>}
              </div>
            </section>
          ))}
        </div>
      )}
      {message && <p className={message === "Сохранено в GitHub" ? "admin-success" : "admin-error"}>{message}</p>}
    </main>
  );
}
