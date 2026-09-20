"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type AsyncContentTransitionProps = {
  loading: boolean;
  loadingNode: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function AsyncContentTransition({
  loading,
  loadingNode,
  children,
  className = "",
}: AsyncContentTransitionProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.22;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        <motion.div
          key="loading"
          className="async-content-transition async-content-transition--loading"
          initial={false}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: "blur(1px)" }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        >
          {loadingNode}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          className={`async-content-transition async-content-transition--content ${className}`.trim()}
          initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(1.5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: "blur(1px)" }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
