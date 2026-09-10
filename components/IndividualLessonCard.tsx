import type { IndividualLesson } from "@/lib/people";

export type ScheduleIndividualLesson = IndividualLesson & { personName: string };

export function IndividualLessonCard({ lesson, onClick }: { lesson: ScheduleIndividualLesson; onClick?: () => void }) {
  return (
    <article
      className="schedule-card individual-lesson-card"
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
        <span>{lesson.timeStart}</span><span>{lesson.timeEnd}</span>
      </div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <h2>{lesson.subject}</h2>
          <span className="group-badge individual-lesson-card__badge">Индивидуально</span>
        </div>
        <div className="schedule-card__meta">
          <span>{lesson.personName}</span><span aria-hidden="true">·</span><span>{lesson.professor}</span><span aria-hidden="true">·</span><span>ауд. {lesson.auditorium}</span>
        </div>
        {lesson.note && <p className="individual-lesson-card__note">{lesson.note}</p>}
      </div>
      <style jsx global>{`
        .individual-lesson-card { border-left: 2px solid #f0f0f0; }
        .individual-lesson-card__badge { background: rgba(255,255,255,.09); }
        .individual-lesson-card__note { margin: 10px 0 0; color: #8f8f98; font-size: 11px; line-height: 1.45; }
      `}</style>
    </article>
  );
}
