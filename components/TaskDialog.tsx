"use client";

import { useDialogMotion } from "@/lib/dialog-motion";

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import styles from "./Tasks.module.css";

export default function TaskDialog({ title, caption, children, busy, closing, onClose, compact = false }: {
  title: string; caption: string; children: ReactNode; busy: boolean; closing: boolean; onClose: () => void; compact?: boolean;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const focused = useRef(false);
  const [exiting, setExiting] = useState(false);
  const modalMotion = useDialogMotion();
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
    // Keep the mobile keyboard from resizing the viewport during entry.
    dialog?.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
    return () => {
      // The panel and shade have finished fading before this cleanup runs.
      dialog?.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={element} className={styles.dialog} aria-labelledby={titleId} aria-busy={busy} onKeyDownCapture={e => { if (leaving) { e.preventDefault(); e.stopPropagation(); } }} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
    <motion.div className={styles.dialogShade} aria-hidden="true" {...modalMotion.shade} animate={leaving ? modalMotion.shade.exit : modalMotion.shade.animate}/>
    <motion.section className={`${styles.dialogPanel}${compact ? ` ${styles.dialogPanelCompact}` : ""}`} {...modalMotion.panel} animate={leaving ? modalMotion.panel.exit : modalMotion.panel.animate} onAnimationComplete={() => {
      if (leaving) {
        onClose();
        // A confirmation may return to its editor instead of unmounting.
        setExiting(false);
        return;
      }
      if (!focused.current) {
        focused.current = true;
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          element.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus({ preventScroll: true });
        }
      }
    }} data-closing={leaving}>
      <header className={styles.dialogHeading}><div><p>{caption}</p><h2 id={titleId}>{title}</h2></div><button type="button" data-dialog-close autoFocus className="icon-button" disabled={busy || leaving} onClick={requestClose} aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div>{children}</div>
    </motion.section>
  </dialog>, document.body);
}
