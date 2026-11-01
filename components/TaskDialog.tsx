"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import styles from "./Tasks.module.css";

export default function TaskDialog({ title, caption, children, busy, closing, onClose }: {
  title: string; caption: string; children: ReactNode; busy: boolean; closing: boolean; onClose: () => void;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [exiting, setExiting] = useState(false);
  const reducedMotion = useReducedMotion();
  const requestClose = useCallback(() => { if (!busy) setExiting(true); }, [busy]);
  const leaving = closing || exiting;
  useEffect(() => {
    const dialog = element.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<motion.dialog layout={reducedMotion ? false : "size"} layoutRoot ref={element} className={styles.dialog} aria-labelledby={titleId} aria-busy={busy} data-closing={leaving} initial={reducedMotion ? false : { opacity: 0, y: 18, scale: .98 }} animate={leaving ? { opacity: 0, y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : .985 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: reducedMotion ? 0 : leaving ? .16 : .24, ease: [.22, 1, .36, 1], layout: { duration: reducedMotion ? 0 : .22, ease: [.22, 1, .36, 1] } }} onAnimationComplete={() => { if (leaving) onClose(); }} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.target === e.currentTarget && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) requestClose();
  }}>
    <header className={styles.dialogHeading}><div><p>{caption}</p><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" disabled={busy || leaving} onClick={requestClose} aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
    <div inert={leaving}>{children}</div>
  </motion.dialog>, document.body);
}
