"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSwipeable } from "react-swipeable";
import table from "@/app/table.json";
import {
  DAY_NAMES,
  formatWeekRange,
  getAvailableGroups,
  getCurrentWeek,
  getLessonsForWeek,
  getTotalWeeks,
} from "@/lib/schedule";
import { ScheduleCard } from "@/components/ScheduleCard";

const schedule = table;
const GROUPS_STORAGE_KEY = "schedule-groups";

type View = "schedule" | "settings";

function readSavedGroups(availableGroups: number[]) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(GROUPS_STORAGE_KEY) ?? "null");
    if (!Array.isArray(saved)) return availableGroups;

    return saved.filter(
      (group): group is number => typeof group === "number" && availableGroups.includes(group),
    );
  } catch {
    return availableGroups;
  }
}

export default function ScheduleApp() {
  const totalWeeks = useMemo(() => getTotalWeeks(schedule), []);
  const currentWeek = useMemo(() => getCurrentWeek(schedule), []);
  const availableGroups = useMemo(() => getAvailableGroups(schedule), []);
  const [view, setView] = useState<View>("schedule");
  const [groups, setGroups] = useState<number[]>(availableGroups);
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(currentWeek);

  useEffect(() => {
    setGroups(readSavedGroups(availableGroups));
  }, [availableGroups]);

  useEffect(() => {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  const lessons = useMemo(
    () => getLessonsForWeek(schedule, day, week, groups),
    [day, week, groups],
  );

  const moveDay = (direction: 1 | -1) => {
    if (direction === 1) {
      if (day < DAY_NAMES.length - 1) {
        setDay((value) => value + 1);
      } else {
        setDay(0);
        setWeek((value) => Math.min(value + 1, totalWeeks));
      }
      return;
    }

    if (day > 0) {
      setDay((value) => value - 1);
    } else {
      setDay(DAY_NAMES.length - 1);
      setWeek((value) => Math.max(value - 1, 1));
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => moveDay(1),
    onSwipedRight: () => moveDay(-1),
    preventScrollOnSwipe: false,
    trackMouse: false,
  });

  const toggleGroup = (group: number) => {
    setGroups((current) =>
      current.includes(group)
        ? current.filter((value) => value !== group)
        : [...current, group].sort((a, b) => a - b),
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="schedule-shell">
        <header className="schedule-header">
          <div>
            <p className="eyebrow">214Р · расписание</p>
            <h1>{view === "schedule" ? "Учебная неделя" : "Настройки"}</h1>
            {view === "schedule" && <p className="week-caption">{formatWeekRange(schedule, week)}</p>}
          </div>
        </header>

        {view === "schedule" ? (
          <>
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
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setWeek((value) => Math.max(1, value - 1))}
                  disabled={week === 1}
                  aria-label="Предыдущая неделя"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="week-number"
                  onClick={() => setWeek(currentWeek)}
                  aria-label="Перейти к текущей неделе"
                >
                  <span>Неделя</span>
                  <strong>{week}</strong>
                  {week === currentWeek && <em>сейчас</em>}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setWeek((value) => Math.min(totalWeeks, value + 1))}
                  disabled={week === totalWeeks}
                  aria-label="Следующая неделя"
                >
                  →
                </button>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${week}-${day}-${groups.join(",")}`}
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
                      <p>В этот день у выбранных подгрупп ничего не запланировано.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>

            <footer className="schedule-footer">
              <span>{DAY_NAMES[day]}</span>
              <span>Свайп влево/вправо для смены дня</span>
            </footer>
          </>
        ) : (
          <section className="settings-panel" aria-label="Настройки расписания">
            <div className="settings-section">
              <div>
                <p className="settings-section__eyebrow">Фильтр расписания</p>
                <h2>Подгруппы</h2>
                <p>Выберите, какие подгруппы показывать в расписании. Занятия для обеих подгрупп отображаются всегда.</p>
              </div>

              <div className="settings-list">
                {availableGroups.map((group) => {
                  const checked = groups.includes(group);
                  return (
                    <label className="setting-row" key={group}>
                      <span>
                        <strong>{group} подгруппа</strong>
                        <small>{checked ? "Показывается" : "Скрыта"}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroup(group)}
                        aria-label={`Показывать ${group} подгруппу`}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <nav className="bottom-nav" aria-label="Разделы">
          <button
            type="button"
            className={view === "schedule" ? "is-active" : ""}
            aria-current={view === "schedule" ? "page" : undefined}
            onClick={() => setView("schedule")}
          >
            <span aria-hidden="true">▦</span>
            Расписание
          </button>
          <button
            type="button"
            className={view === "settings" ? "is-active" : ""}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => setView("settings")}
          >
            <span aria-hidden="true">⚙</span>
            Настройки
          </button>
        </nav>
      </main>
    </MotionConfig>
  );
}
