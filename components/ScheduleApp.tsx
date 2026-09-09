"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSwipeable } from "react-swipeable";
import table from "@/app/table.json";
import { DAY_NAMES, formatWeekRange, getCurrentWeek, getLessonsForWeek, getTotalWeeks, type Group } from "@/lib/schedule";
import { ScheduleCard } from "@/components/ScheduleCard";

const schedule = table;
const STORAGE_KEY = "schedule-group";

export default function ScheduleApp() {
  const totalWeeks = useMemo(() => getTotalWeeks(schedule), []);
  const currentWeek = useMemo(() => getCurrentWeek(schedule), []);
  const [group, setGroup] = useState<Group>(1);
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(currentWeek);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "1" || saved === "2") setGroup(Number(saved) as Group);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(group));
  }, [group]);

  const lessons = useMemo(() => getLessonsForWeek(schedule, day, week, group), [day, week, group]);
  const handlers = useSwipeable({
    onSwipedLeft: () => setWeek((value) => Math.min(value + 1, totalWeeks)),
    onSwipedRight: () => setWeek((value) => Math.max(value - 1, 1)),
    preventScrollOnSwipe: false,
    trackMouse: false,
  });

  return (
    <MotionConfig reducedMotion="user">
      <main className="schedule-shell">
        <header className="schedule-header">
          <div>
            <p className="eyebrow">214Р · расписание</p>
            <h1>Учебная неделя</h1>
            <p className="week-caption">{formatWeekRange(schedule, week)}</p>
          </div>

          <div className="group-switch" role="group" aria-label="Выбор подгруппы">
            {[1, 2].map((value) => (
              <button
                type="button"
                key={value}
                className={group === value ? "is-active" : ""}
                aria-pressed={group === value}
                onClick={() => setGroup(value as Group)}
              >
                {value} подгруппа
              </button>
            ))}
          </div>
        </header>

        <nav className="day-tabs" aria-label="Дни недели">
          {DAY_NAMES.map((name, index) => (
            <button
              type="button"
              key={name}
              className={day === index ? "is-active" : ""}
              aria-current={day === index ? "page" : undefined}
              onClick={() => setDay(index)}
            >
              <span>{name}</span>
              <small>{index + 1}</small>
            </button>
          ))}
        </nav>

        <section className="schedule-panel" {...handlers} aria-live="polite">
          <div className="week-toolbar">
            <button type="button" className="icon-button" onClick={() => setWeek((value) => Math.max(1, value - 1))} disabled={week === 1} aria-label="Предыдущая неделя">
              ←
            </button>
            <button type="button" className="week-number" onClick={() => setWeek(currentWeek)} aria-label="Перейти к текущей неделе">
              <span>Неделя</span>
              <strong>{week}</strong>
              {week === currentWeek && <em>сейчас</em>}
            </button>
            <button type="button" className="icon-button" onClick={() => setWeek((value) => Math.min(totalWeeks, value + 1))} disabled={week === totalWeeks} aria-label="Следующая неделя">
              →
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${week}-${day}-${group}`}
              className="lesson-list"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {lessons.length > 0 ? lessons.map((lesson) => (
                <ScheduleCard key={`${lesson.timeStart}-${lesson.class}-${lesson.auditorium}`} lesson={lesson} />
              )) : (
                <div className="empty-state">
                  <span className="empty-state__icon">—</span>
                  <h2>Занятий нет</h2>
                  <p>В этот день у выбранной подгруппы ничего не запланировано.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <footer className="schedule-footer">
          <span>{day === 5 ? "Суббота" : "Учебный день"}</span>
          <span>Свайпните для смены недели</span>
        </footer>
      </main>
    </MotionConfig>
  );
}
