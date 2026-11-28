import { ASSESSMENT_LABELS, type Assessment } from "@/lib/assessments";
import styles from "./Assessments.module.css";

export default function AssessmentCard({ assessment, past = false, onClick }: { assessment: Assessment; past?: boolean; onClick: () => void }) {
  return <article role="button" tabIndex={0} className={`schedule-card ${styles.card}${past ? ` ${styles.past}` : ""}`} onClick={onClick} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } }}>
    <div className="schedule-card__time"><span>{assessment.timeStart}</span><span>{assessment.timeEnd}</span></div>
    <div className="schedule-card__body"><span className={`card-kind-badge ${styles.badge}`}>{ASSESSMENT_LABELS[assessment.kind]}</span><h2 className={styles.title}>{assessment.subject}</h2>
      <span className={`schedule-card__meta ${styles.meta}`}>{[assessment.professor, assessment.auditorium].filter(Boolean).join(" · ") || "Место уточняется"}</span>

    </div>
  </article>;
}
