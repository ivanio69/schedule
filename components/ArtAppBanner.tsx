"use client";

import Image from "next/image";
import { ART_APP_URL } from "@/lib/art-app";
import styles from "./ArtAppBanner.module.css";

export default function ArtAppBanner({ onDismiss }: { onDismiss?: () => void }) {
  return <aside className={styles.banner} aria-label="Приложение для изучения картин">
    <div className={styles.content}>
      <span className={styles.eyebrow}>ИЗОБРАЗИТЕЛЬНОЕ ИСКУССТВО · ТРЕНАЖЁР</span>
      <h2 className={styles.title}>артблять<span>.</span></h2>
      <p className={styles.description}>Запомни картины, их названия и авторов. Учись, проходи квиз и проверяй себя на экзамене.</p>
      <a className={styles.link} href={ART_APP_URL} target="_blank" rel="noopener noreferrer">Начать изучать <span aria-hidden="true">↗</span></a>
    </div>
    <div className={styles.gallery} aria-hidden="true">
      <span className={styles.orbit} />
      <div className={styles.frame}><Image src="/art-banner/painting.jpg" alt="" width={180} height={150} className={styles.painting} /></div>
    </div>
    {onDismiss && <button className={styles.close} type="button" aria-label="Скрыть баннер приложения для картин" onClick={onDismiss}><span aria-hidden="true">×</span></button>}
  </aside>;
}
