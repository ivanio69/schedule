"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ASSESSMENT_LABELS, formatAssessmentDate, type Assessment } from "@/lib/assessments";
import EventDialog from "./EventDialog";
import styles from "./Assessments.module.css";

export default function AssessmentDetails({ assessment, onClose }: { assessment: Assessment; onClose: () => void; onChange?: (item: Assessment) => void }) {
  const [item, setItem] = useState(assessment), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/assessments?id=${encodeURIComponent(assessment.id)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
    }).then(data => { if (!controller.signal.aborted) setItem(data.assessment); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось обновить запись"); });
    return () => controller.abort();
  }, [assessment.id]);
  return <EventDialog title={item.subject} eyebrow={ASSESSMENT_LABELS[item.kind]} onClose={onClose}>
    <div className={styles.details}>
      <div className={styles.detailTime}><strong>{item.timeStart}–{item.timeEnd}</strong><span>{formatAssessmentDate(item.date)}</span></div>
      <dl className={styles.facts}>{item.professor && <div><dt>Преподаватель</dt><dd>{item.professor}</dd></div>}<div><dt>Место</dt><dd>{item.auditorium || "Уточняется"}</dd></div></dl>
      {item.notes && <section className={styles.description}><h3>Описание</h3><p>{item.notes}</p></section>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Link href={`/schedule?date=${item.date}`} className={`admin-secondary ${styles.dayLink}`} onClick={onClose}>Открыть день в расписании</Link>
    </div>
  </EventDialog>;
}
