import type { Lesson } from "@/lib/schedule";

export function ScheduleCard({ lesson, onClick }: { lesson: Lesson; onClick?: () => void }) {
  const shared = lesson.group.length === 2;

  return (
    <article
      className="schedule-card"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="schedule-card__time" aria-label={`Время: ${lesson.timeStart} — ${lesson.timeEnd}`}>
        <span>{lesson.timeStart}</span>
        <span>{lesson.timeEnd}</span>
      </div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <h2>{lesson.class}</h2>
          <span className={`group-badge ${shared ? "group-badge--shared" : ""}`}>
            {shared ? "Обе группы" : `${lesson.group[0]} подгруппа`}
          </span>
        </div>
        <div className="schedule-card__meta">
          <span>{lesson.professor}</span>
          <span aria-hidden="true">·</span>
          <span>ауд. {lesson.auditorium}</span>
        </div>
      </div>
    </article>
  );
}
