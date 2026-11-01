"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import styles from "./Tasks.module.css";

export default function TaskDialog({ title, caption, children, busy, closing, onClose, compact = false }: {
  title: string; caption: string; children: ReactNode; busy: boolean; closing: boolean; onClose: () => void; compact?: boolean;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [exiting, setExiting] = useState(false);
  const reducedMotion = useReducedMotion();
  const requestClose = useCallback(() => { if (!busy) setExiting(true); }, [busy]);
  const leaving = closing || exiting;
  useLayoutEffect(() => {
    const dialog = element.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const paddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    // Preserve the page width while the browser scrollbar is hidden.
    if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    return () => {
      // The panel and shade have finished fading before this cleanup runs.
      dialog?.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const transition = { duration: reducedMotion ? 0 : leaving ? .16 : .22, ease: [.22, 1, .36, 1] as const };
  return createPortal(<dialog ref={element} className={styles.dialog} aria-labelledby={titleId} aria-busy={busy} onKeyDownCapture={e => { if (leaving) { e.preventDefault(); e.stopPropagation(); } }} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
    <motion.div className={styles.dialogShade} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={transition}/>
    <motion.section className={`${styles.dialogPanel}${compact ? ` ${styles.dialogPanelCompact}` : ""}`} initial={reducedMotion ? false : { opacity: 0, y: 14, scale: .985 }} animate={leaving ? { opacity: 0, y: reducedMotion ? 0 : 8, scale: reducedMotion ? 1 : .99 } : { opacity: 1, y: 0, scale: 1 }} transition={transition} onAnimationComplete={() => { if (leaving) onClose(); }} data-closing={leaving}>
      <header className={styles.dialogHeading}><div><p>{caption}</p><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" disabled={busy || leaving} onClick={requestClose} aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div>{children}</div>
    </motion.section>
  </dialog>, document.body);
}
