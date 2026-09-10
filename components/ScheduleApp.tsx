"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSwipeable } from "react-swipeable";
import { DAY_NAMES, formatWeekRange, getCurrentWeek, getLessonsForWeek, getSubgroupSubjects, getTotalWeeks, type GroupPreference, type Lesson, type Rehearsal, type ScheduleData } from "@/lib/schedule";
import { RehearsalCard } from "@/components/RehearsalCard";
import { ScheduleCard } from "@/components/ScheduleCard";
import { IndividualLessonCard, type ScheduleIndividualLesson } from "@/components/IndividualLessonCard";

type View = "schedule" | "settings";
type Preferences = Record<string, GroupPreference>;
type Details = { type: "lesson"; item: Lesson } | { type: "individual"; item: ScheduleIndividualLesson } | { type: "rehearsal"; item: Rehearsal };
const SETTINGS_STORAGE_KEY = "schedule-subgroup-preferences";
const PERSON_KEY = "schedule_person_id";

function readPreferences(subjects: { name: string }[]): Preferences {
  const defaults = Object.fromEntries(subjects.map(({ name }) => [name, "both" as GroupPreference])) as Preferences;
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return defaults;
    return Object.fromEntries(subjects.map(({ name }) => [name, saved[name] === "1" || saved[name] === "2" || saved[name] === "both" ? saved[name] : "both"])) as Preferences;
  } catch { return defaults; }
}

function getCreatorId() { return window.localStorage.getItem(PERSON_KEY) ?? ""; }

function getDateForSelection(schedule: ScheduleData, week: number, day: number) {
  const [year, month, startDay] = schedule.semesterStart;
  const date = new Date(year, month, startDay + (week - 1) * 7 + day);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(date: string) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)); }

export default function ScheduleApp() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [individualLessons, setIndividualLessons] = useState<ScheduleIndividualLesson[]>([]);
  const [creatorId, setCreatorId] = useState("");
  const [view, setView] = useState<View>("schedule");
  const [preferences, setPreferences] = useState<Preferences>({});
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [rehearsalSubject, setRehearsalSubject] = useState("");
  const [rehearsalResponsible, setRehearsalResponsible] = useState("");
  const [rehearsalParticipants, setRehearsalParticipants] = useState("");
  const [rehearsalStart, setRehearsalStart] = useState("18:00");
  const [rehearsalEnd, setRehearsalEnd] = useState("20:00");
  const [rehearsalSaving, setRehearsalSaving] = useState(false);
  const [rehearsalError, setRehearsalError] = useState("");
  const didInitializeWeek = useRef(false);

  const totalWeeks = useMemo(() => schedule ? getTotalWeeks(schedule) : 1, [schedule]);
  const currentWeek = useMemo(() => schedule ? getCurrentWeek(schedule) : 1, [schedule]);
  const subgroupSubjects = useMemo(() => schedule ? getSubgroupSubjects(schedule) : [], [schedule]);
  const lessons = useMemo(() => schedule ? getLessonsForWeek(schedule, day, week, preferences) : [], [schedule, day, week, preferences]);
  const selectedDate = useMemo(() => schedule ? getDateForSelection(schedule, week, day) : "", [schedule, week, day]);

  useEffect(() => setCreatorId(getCreatorId()), []);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/schedule?date=${selectedDate}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json() as { schedule: ScheduleData; rehearsals: Rehearsal[] };
        setSchedule(data.schedule);
        setRehearsals(data.rehearsals ?? []);
        if (!didInitializeWeek.current) {
          didInitializeWeek.current = true;
          setWeek(getCurrentWeek(data.schedule));
        }
        setPreferences(readPreferences(getSubgroupSubjects(data.schedule)));
      } catch { setRehearsals([]); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Individual lessons are loaded separately so they are not dependent on the main schedule response.
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    void fetch(`/api/individual-lessons?date=${encodeURIComponent(selectedDate)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled) setIndividualLessons((data?.individualLessons ?? []) as ScheduleIndividualLesson[]);
      })
      .catch(() => {
        if (!cancelled) setIndividualLessons([]);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => { if (Object.keys(preferences).length) window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences)); }, [preferences]);
  useEffect(() => {
    if (!details) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDetails(null); };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [details]);

  const refreshRehearsals = async () => {
    const response = await fetch(`/api/rehearsals?date=${selectedDate}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { rehearsals: Rehearsal[] };
    setRehearsals(data.rehearsals ?? []);
  };

  const moveDay = (direction: 1 | -1) => {
    if (direction === 1) {
      if (day < DAY_NAMES.length - 1) setDay(v => v + 1);
      else { setDay(0); setWeek(v => Math.min(v + 1, totalWeeks)); }
    } else if (day > 0) setDay(v => v - 1);
    else { setDay(DAY_NAMES.length - 1); setWeek(v => Math.max(v - 1, 1)); }
  };
  const handlers = useSwipeable({ onSwipedLeft: () => moveDay(1), onSwipedRight: () => moveDay(-1), preventScrollOnSwipe: false, trackMouse: false });
  const setPreference = (subject: string, preference: GroupPreference) => setPreferences(current => ({ ...current, [subject]: preference }));

  const createRehearsal = async () => {
    setRehearsalError("");
    const participants = rehearsalParticipants.split(",").map(v => v.trim()).filter(Boolean);
    if (!creatorId) { setRehearsalError("Сначала выберите свой профиль на дашборде"); return; }
    if (!rehearsalSubject.trim() || !rehearsalResponsible.trim()) { setRehearsalError("Укажите предмет и ответственного"); return; }
    setRehearsalSaving(true);
    try {
      const response = await fetch("/api/rehearsals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId, subject: rehearsalSubject, date: selectedDate, timeStart: rehearsalStart, timeEnd: rehearsalEnd, responsible: rehearsalResponsible, participants }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось создать репетицию");
      setRehearsalSubject(""); setRehearsalResponsible(""); setRehearsalParticipants(""); setRehearsalOpen(false); await refreshRehearsals();
    } catch (error) { setRehearsalError(error instanceof Error ? error.message : "Не удалось создать репетицию"); }
    finally { setRehearsalSaving(false); }
  };

  const removeRehearsal = async (id: string) => {
    if (!creatorId) return;
    const response = await fetch(`/api/rehearsals?id=${encodeURIComponent(id)}&creatorId=${encodeURIComponent(creatorId)}`, { method: "DELETE" });
    if (response.ok) { setRehearsals(items => items.filter(item => item.id !== id)); setDetails(null); }
  };

  if (loading || !schedule) return <main className="schedule-shell"><div className="empty-state"><span className="empty-state__icon">…</span><h2>Загрузка расписания</h2><p>Подключаемся к базе данных.</p></div></main>;

  const entries = [
    ...lessons.map(item => ({ type: "lesson" as const, time: item.timeStart, item })),
    ...individualLessons.map(item => ({ type: "individual" as const, time: item.timeStart, item })),
    ...rehearsals.map(item => ({ type: "rehearsal" as const, time: item.timeStart, item })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return <MotionConfig reducedMotion="user"><main className="schedule-shell">
    <header className="schedule-header"><div><p className="eyebrow">214Р · расписание</p><h1>{view === "schedule" ? "Учебная неделя" : "Настройки"}</h1>{view === "schedule" && <p className="week-caption">{formatWeekRange(schedule, week)}</p>}</div></header>
    {view === "schedule" ? <>
      <nav className="day-tabs" aria-label="Дни недели">{DAY_NAMES.map((name,index)=><button type="button" key={name} className={day===index?"is-active":""} aria-current={day===index?"page":undefined} onClick={()=>setDay(index)}><span>{name}</span><small>{index+1}</small></button>)}</nav>
      <section className="schedule-panel" {...handlers} aria-live="polite">
        <div className="week-toolbar"><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.max(1,v-1))} disabled={week===1} aria-label="Предыдущая неделя">←</button><button type="button" className="week-number" onClick={()=>setWeek(currentWeek)} aria-label="Перейти к текущей неделе"><span>Неделя</span><strong>{week}</strong>{week===currentWeek&&<em>сейчас</em>}</button><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.min(totalWeeks,v+1))} disabled={week===totalWeeks} aria-label="Следующая неделя">→</button></div>
        {rehearsalOpen ? <section className="rehearsal-form"><div><p className="rehearsal-label">Новая репетиция</p><h2>{selectedDate}</h2></div><div className="rehearsal-grid"><label>Предмет<input className="admin-input" value={rehearsalSubject} onChange={e=>setRehearsalSubject(e.target.value)} placeholder="Например, сценическое движение" autoFocus /></label><label>Ответственный<input className="admin-input" value={rehearsalResponsible} onChange={e=>setRehearsalResponsible(e.target.value)} placeholder="ФИО" /></label><label>Начало<input className="admin-input" type="time" value={rehearsalStart} onChange={e=>setRehearsalStart(e.target.value)} /></label><label>Конец<input className="admin-input" type="time" value={rehearsalEnd} onChange={e=>setRehearsalEnd(e.target.value)} /></label><label className="rehearsal-participants">Участники<input className="admin-input" value={rehearsalParticipants} onChange={e=>setRehearsalParticipants(e.target.value)} /><small>Укажите через запятую</small></label></div>{rehearsalError&&<p className="admin-error">{rehearsalError}</p>}<div className="rehearsal-form__actions"><button type="button" className="admin-secondary" onClick={()=>setRehearsalOpen(false)}>Отмена</button><button type="button" className="admin-primary" disabled={rehearsalSaving} onClick={()=>void createRehearsal()}>{rehearsalSaving?"Создаю…":"Создать репетицию"}</button></div></section> : <button type="button" className="add-rehearsal-button" onClick={()=>{setRehearsalError("");setRehearsalOpen(true)}}>＋ Добавить репетицию</button>}
        <AnimatePresence mode="wait" initial={false}><motion.div key={`${week}-${day}-${JSON.stringify(preferences)}-${individualLessons.map(item=>item.id).join(",")}`} className="lesson-list" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.18}}>{entries.map(entry=>entry.type==="lesson"?<ScheduleCard key={`lesson-${entry.item.timeStart}-${entry.item.class}-${entry.item.auditorium}-${entry.item.group.join(",")}`} lesson={entry.item} onClick={()=>setDetails({type:"lesson",item:entry.item})}/>:entry.type==="individual"?<IndividualLessonCard key={`individual-${entry.item.id}`} lesson={entry.item} onClick={()=>setDetails({type:"individual",item:entry.item})}/>:<RehearsalCard key={entry.item.id} rehearsal={entry.item} own={entry.item.creatorId===creatorId} onDelete={entry.item.creatorId===creatorId?()=>void removeRehearsal(entry.item.id):undefined} onClick={()=>setDetails({type:"rehearsal",item:entry.item})}/>) }{entries.length===0&&<div className="empty-state"><span className="empty-state__icon">—</span><h2>Ничего нет</h2><p>В этот день ничего не запланировано.</p></div>}</motion.div></AnimatePresence>
      </section><footer className="schedule-footer"><span>{DAY_NAMES[day]}</span><span>Нажмите на занятие для подробностей</span></footer>
    </> : <section className="settings-panel" aria-label="Настройки расписания"><div className="settings-section"><div><p className="settings-section__eyebrow">Подгруппы</p><h2>Настройки предметов</h2><p>Для каждого предмета с подгруппами выберите, какую группу показывать.</p></div><div className="settings-list">{subgroupSubjects.map(({name,groups})=>{const value=preferences[name]??"both";return <div className="setting-row setting-row--subject" key={name}><span><strong>{name}</strong><small>Подгруппы: {groups.join(" и ")}</small></span><div className="preference-switch" role="group" aria-label={`Подгруппа для предмета ${name}`}>{(["1","2","both"] as GroupPreference[]).map(option=><button type="button" key={option} className={value===option?"is-active":""} aria-pressed={value===option} onClick={()=>setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}</div></div>})}</div></div></section>}
    <nav className="bottom-nav" aria-label="Разделы"><button type="button" className={view==="schedule"?"is-active":""} onClick={()=>setView("schedule")}>Расписание</button><button type="button" className={view==="settings"?"is-active":""} onClick={()=>setView("settings")}>Настройки</button></nav>
    <AnimatePresence>{details&&<motion.div className="details-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetails(null)}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" initial={{opacity:0,y:28,scale:.94}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:18,scale:.97}} transition={{type:"spring",stiffness:420,damping:28,mass:.65}}><div className="details-modal__header"><div><span className="details-modal__eyebrow">{details.type==="lesson"?"Занятие":details.type==="individual"?"Индивидуальное занятие":"Репетиция"}</span><h2 id="details-title">{details.type==="lesson"?details.item.class:details.item.subject}</h2></div><button type="button" className="details-modal__close" onClick={()=>setDetails(null)} aria-label="Закрыть">×</button></div><div className="details-modal__time"><strong>{details.item.timeStart}</strong><span>—</span><span>{details.item.timeEnd}</span></div><dl className="details-modal__list"><div><dt>Дата</dt><dd>{formatDate(details.type==="lesson"?selectedDate:details.item.date)}</dd></div>{details.type==="lesson"?<><div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div><div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div><div><dt>Подгруппа</dt><dd>{details.item.group.length===2?"Обе группы":`${details.item.group[0]} подгруппа`}</dd></div></>:details.type==="individual"?<><div><dt>Студент</dt><dd>{details.item.personName}</dd></div><div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div><div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div>{details.item.note&&<div><dt>Примечание</dt><dd>{details.item.note}</dd></div>}</>:<><div><dt>Автор</dt><dd>{details.item.creatorName??"Автор не указан"}</dd></div><div><dt>Ответственный</dt><dd>{details.item.responsible}</dd></div><div><dt>Участники</dt><dd className="details-modal__participants">{details.item.participants.length?details.item.participants.map(p=><span key={p}>{p}</span>):<span>Не указаны</span>}</dd></div></>}</dl>{details.type==="rehearsal"&&details.item.creatorId===creatorId&&<button type="button" className="details-modal__delete" onClick={()=>void removeRehearsal(details.item.id)}>Удалить репетицию</button>}</motion.section></motion.div>}</AnimatePresence>
  </main></MotionConfig>;
}
