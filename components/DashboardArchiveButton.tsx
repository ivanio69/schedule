"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import ArchiveIcon from "./ArchiveIcon";
import styles from "./Archive.module.css";

export default function DashboardArchiveButton() {
  const reduced = useReducedMotion();
  return <motion.div className={styles.dashboardEntry} initial={reduced ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .4 }}>
    <Link href="/archive" className={styles.entry}>
      <span className={styles.entryIcon}><ArchiveIcon/></span>
      <span className={styles.entryCopy}><strong>Архив</strong><span>Показы, полезные файлы и ссылки</span></span>
      <span className={styles.entryArrow} aria-hidden="true">↗</span>
    </Link>
  </motion.div>;
}
