"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="app-page-transition"
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.995, filter: "blur(1.5px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.997, filter: "blur(1px)" }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
