"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./PersonalEvents.module.css";

export default function EventDialog({ title, eyebrow, children, onClose, busy = false, compact = false }: {
  title: string; eyebrow: string; children: ReactNode; onClose: () => void; busy?: boolean; compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  return createPortal(<dialog ref={dialog} className={`${styles.dialog}${compact ? ` ${styles.compact}` : ""}`} aria-labelledby="event-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.target === e.currentTarget && !busy && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) onClose();
  }}>
    <header className={styles.header}><div><p>{eyebrow}</p><h2 id="event-dialog-title">{title}</h2></div><button type="button" className={styles.close} disabled={busy} onClick={onClose} aria-label="Закрыть">×</button></header>
    {children}
  </dialog>, document.body);
}
