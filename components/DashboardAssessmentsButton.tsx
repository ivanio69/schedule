import Link from "next/link";
import styles from "./Assessments.module.css";

export default function DashboardAssessmentsButton() {
  return <Link href="/assessments" className={styles.entry}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5"/></svg>
    <span><strong>Зачёты и экзамены</strong><small>Расписание сессии и комментарии</small></span>
  </Link>;
}
