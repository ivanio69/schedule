"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSwipeable } from "react-swipeable";
import table from "@/app/table.json";
import { DAY_NAMES, formatWeekRange, getCurrentWeek, getLessonsForWeek, getSubgroupSubjects, getTotalWeeks, type GroupPreference } from "@/lib/schedule";
import { ScheduleCard } from "@/components/ScheduleCard";

const schedule = table;
const SETTINGS_STORAGE_KEY = "schedule-subgroup-preferences";
type View = "schedule" | "settings";
type Preferences = Record<string, GroupPreference>;

function readPreferences(subjects: { name: string }[]): Preferences {
  const defaults = Object.fromEntries(subjects.map(({ name }) => [name, "both" as GroupPreference])) as Preferences;
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return defaults;
    return Object.fromEntries(subjects.map(({ name }) => [name, saved[name] === "1" || saved[name] === "2" || saved[name] === "both" ? saved[name] as GroupPreference : "both" as GroupPreference])) as Preferences;
  } catch { return defaults; }
}

export default function ScheduleApp() {
  const totalWeeks = useMemo(() => getTotalWeeks(schedule), []);
  const currentWeek = useMemo(() => getCurrentWeek(schedule), []);
  const subgroupSubjects = useMemo(() => getSubgroupSubjects(schedule), []);
  const [view, setView] = useState<View>("schedule");
  const [preferences, setPreferences] = useState<Preferences>({});
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(currentWeek);
  useEffect(() => setPreferences(readPreferences(subgroupSubjects)), [subgroupSubjects]);
  useEffect(() => { if (Object.keys(preferences).length > 0) window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences)); }, [preferences]);
  const lessons = useMemo(() => getLessonsForWeek(schedule, day, week, preferences), [day, week, preferences]);
  const moveDay = (direction: 1 | -1) => { if (direction === 1) { if (day < DAY_NAMES.length - 1) setDay(v => v + 1); else { setDay(0); setWeek(v => Math.min(v + 1, totalWeeks)); } return; } if (day > 0) setDay(v => v - 1); else { setDay(DAY_NAMES.length - 1); setWeek(v => Math.max(v - 1, 1)); } };
  const handlers = useSwipeable({ onSwipedLeft: () => moveDay(1), onSwipedRight: () => moveDay(-1), preventScrollOnSwipe: false, trackMouse: false });
  const setPreference = (subject: string, preference: GroupPreference) => setPreferences(current => ({ ...current, [subject]: preference }));
  return <MotionConfig reducedMotion="user"><main className="schedule-shell"><header className="schedule-header"><div><p className="eyebrow">214Р · расписание</p><h1>{view === "schedule" ? "Учебная неделя" : "Настройки"}</h1>{view === "schedule" && <p className="week-caption">{formatWeekRange(schedule, week)}</p>}</div></header>{view === "schedule" ? <><nav className="day-tabs" aria-label="Дни недели">{DAY_NAMES.map((name,index)=><button type="button" key={name} className={day===index?"is-active":""} aria-current={day===index?"page":undefined} onClick={()=>setDay(index)}><span>{name}</span><small>{index+1}</small></button>)}</nav><section className="schedule-panel" {...handlers} aria-live="polite"><div className="week-toolbar"><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.max(1,v-1))} disabled={week===1} aria-label="Предыдущая неделя">←</button><button type="button" className="week-number" onClick={()=>setWeek(currentWeek)} aria-label="Перейти к текущей неделе"><span>Неделя</span><strong>{week}</strong>{week===currentWeek&&<em>сейчас</em>}</button><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.min(totalWeeks,v+1))} disabled={week===totalWeeks} aria-label="Следующая неделя">→</button></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${week}-${day}-${JSON.stringify(preferences)}`} className="lesson-list" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.18}}>{lessons.length>0?lessons.map(lesson=><ScheduleCard key={`${lesson.timeStart}-${lesson.class}-${lesson.auditorium}-${lesson.group.join(",")}`} lesson={lesson}/>):<div className="empty-state"><span className="empty-state__icon">—</span><h2>Занятий нет</h2><p>В этот день ничего не запланировано.</p></div>}</motion.div></AnimatePresence></section><footer className="schedule-footer"><span>{DAY_NAMES[day]}</span><span>Свайп влево/вправо для смены дня</span></footer></>:<section className="settings-panel" aria-label="Настройки расписания"><div className="settings-section"><div><p className="settings-section__eyebrow">Подгруппы</p><h2>Настройки предметов</h2><p>Для каждого предмета с подгруппами выберите, какую группу показывать.</p></div><div className="settings-list">{subgroupSubjects.map(({name,groups})=>{const value=preferences[name]??"both";return <div className="setting-row setting-row--subject" key={name}><span><strong>{name}</strong><small>Подгруппы: {groups.join(" и ")}</small></span><div className="preference-switch" role="group" aria-label={`Подгруппа для предмета ${name}`}>{(["1","2","both"] as GroupPreference[]).map(option=><button type="button" key={option} className={value===option?"is-active":""} aria-pressed={value===option} onClick={()=>setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}</div></div>})}</div></div></section>}<nav className="bottom-nav" aria-label="Разделы"><button type="button" className={view==="schedule"?"is-active":""} aria-current={view==="schedule"?"page":undefined} onClick={()=>setView("schedule")}><span aria-hidden="true">▦</span>Расписание</button><button type="button" className={view==="settings"?"is-active":""} aria-current={view==="settings"?"page":undefined} onClick={()=>setView("settings")}><span aria-hidden="true">⚙</span>Настройки</button></nav></main></MotionConfig>;
}
