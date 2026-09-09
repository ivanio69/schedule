"use client";

import { useEffect, useMemo, useState } from "react";

type Lesson = { class: string; professor: string; auditorium: string; timeStart: string; timeEnd: string; group: number[]; weeks: number[]; [key: string]: unknown };
type Day = { table: Lesson[]; [key: string]: unknown };
type Schedule = { semesterStart: number[]; days: Day[]; [key: string]: unknown };

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"] as const;
const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"] as const;
const TIME_PRESETS = [
  ["08:30", "10:00"], ["10:10", "11:40"], ["12:00", "13:30"],
  ["13:40", "15:10"], ["15:20", "16:50"], ["17:00", "18:30"],
] as const;
const WEEKS = Array.from({ length: 20 }, (_, i) => i + 1);

const emptyLesson = (): Lesson => ({
  class: "",
  professor: "",
  auditorium: "",
  timeStart: "09:00",
  timeEnd: "10:30",
  group: [1, 2],
  weeks: [],
});

function sortTable(table: Lesson[]) {
  return [...table].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
}

function normalize(value: unknown): Schedule | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Schedule>;
  if (!Array.isArray(data.semesterStart) || data.semesterStart.length !== 3 || !data.semesterStart.every((v) => Number.isInteger(v))) return null;
  if (!Array.isArray(data.days)) return null;
  if (!data.days.every((d) => d && typeof d === "object" && Array.isArray(d.table))) return null;
  return { ...data, days: data.days.map((day) => ({ ...day, table: sortTable(day.table) })) } as Schedule;
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
  const [activeDay, setActiveDay] = useState(0);
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);

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

  const addLesson = (dayIndex: number) => {
    setSchedule((current) => {
      if (!current) return current;
      const lesson = emptyLesson();
      const days = [...current.days]; days[dayIndex] = { ...days[dayIndex], table: sortTable([...days[dayIndex].table, lesson]) };
      setActiveDay(dayIndex); setExpandedLesson(days[dayIndex].table.findIndex((item) => item === lesson));
      return { ...current, days };
    });
  };

  const duplicateLesson = (dayIndex: number, lessonIndex: number) => {
    setSchedule((current) => {
      if (!current) return current;
      const source = current.days[dayIndex].table[lessonIndex];
      const copy = { ...source, group: [...source.group], weeks: [...source.weeks] };
      const days = [...current.days]; const table = sortTable([...days[dayIndex].table, copy]);
      days[dayIndex] = { ...days[dayIndex], table }; setExpandedLesson(table.findIndex((item) => item === copy));
      return { ...current, days };
    });
  };

  const removeLesson = (dayIndex: number, lessonIndex: number) => {
    setSchedule((current) => {
      if (!current) return current;
      const days = [...current.days]; days[dayIndex] = { ...days[dayIndex], table: days[dayIndex].table.filter((_, i) => i !== lessonIndex) };
      return { ...current, days };
    });
    setExpandedLesson(null);
  };

  const toggleGroup = (dayIndex: number, lessonIndex: number, group: number) => {
    const lesson = schedule?.days[dayIndex].table[lessonIndex]; if (!lesson) return;
    const next = lesson.group.includes(group) ? lesson.group.filter((g) => g !== group) : [...lesson.group, group].sort();
    updateLesson(dayIndex, lessonIndex, { group: next });
  };

  const toggleWeek = (dayIndex: number, lessonIndex: number, week: number) => {
    const lesson = schedule?.days[dayIndex].table[lessonIndex]; if (!lesson) return;
    const next = lesson.weeks.includes(week) ? lesson.weeks.filter((w) => w !== week) : [...lesson.weeks, week].sort((a, b) => a - b);
    updateLesson(dayIndex, lessonIndex, { weeks: next });
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
    } else {
      payload = { ...schedule, days: schedule.days.map((day) => ({ ...day, table: sortTable(day.table) })) };
      setSchedule(payload);
    }
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule: payload }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Ошибка сохранения"); setSaving(false); return; }
    setRaw(JSON.stringify(payload, null, 2)); setMessage("Сохранено в MongoDB"); setSaving(false);
  };

  const lessonCount = useMemo(() => schedule?.days.reduce((sum, day) => sum + day.table.length, 0) ?? 0, [schedule]);
  const activeLessons = schedule?.days[activeDay]?.table ?? [];
  const activeDayCount = activeLessons.length;

  if (loading) return <main className="admin-shell admin-loading"><div className="admin-spinner" /><p className="admin-muted">Загрузка расписания…</p></main>;
  if (!loggedIn) return <main className="admin-shell admin-auth"><div className="admin-card admin-auth-card"><div className="admin-logo">214Р</div><p className="admin-eyebrow">Schedule Admin</p><h1>Панель управления</h1><p className="admin-muted">Редактирование расписания группы.</p><input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} placeholder="Пароль" autoFocus /><button className="admin-primary admin-wide" onClick={() => void login()}>Войти</button>{message && <p className="admin-error">{message}</p>}</div></main>;

  return <main className="admin-shell">
    <header className="admin-header admin-header-new">
      <div><p className="admin-eyebrow">Schedule Admin · MongoDB</p><h1>Редактор расписания</h1><p className="admin-muted">{lessonCount} занятий · редактируй день и сохраняй одним нажатием</p></div>
      <div className="admin-actions"><button className="admin-secondary" onClick={() => void load()}>↻ Обновить</button><button className="admin-primary" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></div>
    </header>

    <section className="admin-overview">
      <div className="admin-stat"><span>Занятий</span><strong>{lessonCount}</strong></div>
      <div className="admin-stat"><span>Дней</span><strong>{schedule?.days.filter((day) => day.table.length > 0).length ?? 0}<small>/6</small></strong></div>
      <div className="admin-stat admin-stat-date"><span>Семестр с</span><strong>{schedule ? semesterStartToDate(schedule.semesterStart).split("-").reverse().join(".") : "—"}</strong></div>
    </section>

    <section className="admin-card admin-settings-strip">
      <div><p className="admin-eyebrow">Параметры</p><strong>Начало семестра</strong><span>Используется для расчёта номеров недель</span></div>
      <input className="admin-input admin-date-input" type="date" value={schedule ? semesterStartToDate(schedule.semesterStart) : ""} onChange={(e) => updateSemesterStart(e.target.value)} />
    </section>

    <div className="admin-modebar"><button className={!rawMode ? "is-active" : ""} onClick={() => { setRawMode(false); setRaw(JSON.stringify(schedule, null, 2)); }}>Визуальный редактор</button><button className={rawMode ? "is-active" : ""} onClick={() => { setRaw(JSON.stringify(schedule, null, 2)); setRawMode(true); }}>JSON</button></div>

    {rawMode ? <section className="admin-card"><textarea className="admin-json" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} /></section> : <>
      <nav className="admin-day-picker" aria-label="Дни недели">
        {DAY_NAMES.map((day, index) => <button key={day} className={activeDay === index ? "is-active" : ""} onClick={() => { setActiveDay(index); setExpandedLesson(null); }}><span>{DAY_SHORT[index]}</span><strong>{day}</strong><small>{schedule?.days[index]?.table.length ?? 0}</small></button>)}
      </nav>

      <section className="admin-card admin-day-editor">
        <div className="admin-day-heading"><div><p className="admin-eyebrow">{DAY_SHORT[activeDay]} · {activeDayCount} {activeDayCount === 1 ? "занятие" : activeDayCount < 5 ? "занятия" : "занятий"}</p><h2>{DAY_NAMES[activeDay]}</h2></div><button className="admin-primary" onClick={() => addLesson(activeDay)}>＋ Добавить пару</button></div>
        <div className="admin-quick-tip"><span>⚡</span><span><strong>Быстрый ввод:</strong> выбери время, недели и подгруппу — остальные поля заполняются обычным текстом.</span></div>
        <div className="admin-lessons-new">
          {activeLessons.map((lesson, lessonIndex) => <article className={`admin-lesson-new ${expandedLesson === lessonIndex ? "is-expanded" : ""}`} key={lessonIndex}>
            <button className="admin-lesson-summary" onClick={() => setExpandedLesson(expandedLesson === lessonIndex ? null : lessonIndex)}>
              <span className="admin-lesson-number">{String(lessonIndex + 1).padStart(2, "0")}</span>
              <span className="admin-lesson-time"><strong>{lesson.timeStart}</strong><small>{lesson.timeEnd}</small></span>
              <span className="admin-lesson-info"><strong>{lesson.class || "Новая пара"}</strong><small>{lesson.professor || "Преподаватель не указан"}{lesson.auditorium ? ` · ${lesson.auditorium}` : ""}</small></span>
              <span className="admin-lesson-tags">{lesson.weeks.length ? `${lesson.weeks.length} нед.` : "все недели"} · {lesson.group.length === 2 ? "обе" : lesson.group.length ? `гр. ${lesson.group.join(", ")}` : "без группы"}</span>
              <span className="admin-chevron">{expandedLesson === lessonIndex ? "⌃" : "⌄"}</span>
            </button>
            {expandedLesson === lessonIndex && <div className="admin-lesson-editor">
              <div className="admin-form-grid admin-form-grid-main">
                <label>Предмет<input className="admin-input" autoFocus value={lesson.class} onChange={(e) => updateLesson(activeDay, lessonIndex, { class: e.target.value })} placeholder="Название предмета" /></label>
                <label>Преподаватель<input className="admin-input" value={lesson.professor} onChange={(e) => updateLesson(activeDay, lessonIndex, { professor: e.target.value })} placeholder="ФИО преподавателя" /></label>
                <label>Аудитория<input className="admin-input" value={lesson.auditorium} onChange={(e) => updateLesson(activeDay, lessonIndex, { auditorium: e.target.value })} placeholder="Например, 304" /></label>
              </div>
              <div className="admin-editor-row">
                <div><span className="admin-field-title">Время</span><div className="admin-time-fields"><input className="admin-input" type="time" value={lesson.timeStart} onChange={(e) => updateLesson(activeDay, lessonIndex, { timeStart: e.target.value })} /><span>—</span><input className="admin-input" type="time" value={lesson.timeEnd} onChange={(e) => updateLesson(activeDay, lessonIndex, { timeEnd: e.target.value })} /></div><div className="admin-presets">{TIME_PRESETS.map(([start, end]) => <button key={start} className={lesson.timeStart === start && lesson.timeEnd === end ? "is-active" : ""} onClick={() => updateLesson(activeDay, lessonIndex, { timeStart: start, timeEnd: end })}>{start}</button>)}</div></div>
                <div><span className="admin-field-title">Подгруппа</span><div className="admin-chip-row"><button className={lesson.group.includes(1) ? "is-active" : ""} onClick={() => toggleGroup(activeDay, lessonIndex, 1)}>1 группа</button><button className={lesson.group.includes(2) ? "is-active" : ""} onClick={() => toggleGroup(activeDay, lessonIndex, 2)}>2 группа</button></div></div>
              </div>
              <div><span className="admin-field-title">Недели <em>{lesson.weeks.length ? `выбрано ${lesson.weeks.length}` : "все недели"}</em></span><div className="admin-week-grid"><button className={!lesson.weeks.length ? "is-active" : ""} onClick={() => updateLesson(activeDay, lessonIndex, { weeks: [] })}>Все</button>{WEEKS.map((week) => <button key={week} className={lesson.weeks.includes(week) ? "is-active" : ""} onClick={() => toggleWeek(activeDay, lessonIndex, week)}>{week}</button>)}</div></div>
              <div className="admin-lesson-actions"><button className="admin-secondary" onClick={() => duplicateLesson(activeDay, lessonIndex)}>⧉ Дублировать</button><button className="admin-danger" onClick={() => removeLesson(activeDay, lessonIndex)}>Удалить пару</button></div>
            </div>}
          </article>)}
          {!activeLessons.length && <div className="admin-empty-new"><div>＋</div><strong>В этот день пока нет пар</strong><span>Добавь первую пару — откроется удобная форма быстрого ввода.</span><button className="admin-primary" onClick={() => addLesson(activeDay)}>Добавить пару</button></div>}
        </div>
      </section>
    </>}
    {message && <p className={message === "Сохранено в MongoDB" ? "admin-success" : "admin-error"}>{message}</p>}
  </main>;
}
