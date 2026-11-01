"use client";

import { useReducedMotion } from "motion/react";

const ease = [.22, 1, .36, 1] as const;
const panel = {
  "data-app-modal-panel": "",
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: .32, ease } },
  exit: { opacity: 0, y: 10, transition: { duration: .24, ease } },
};
const shade = {
  "data-app-modal-shade": "",
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: .28, ease } },
  exit: { opacity: 0, transition: { duration: .24, ease } },
};
const reducedPanel = {
  "data-app-modal-panel": "",
  initial: false as const,
  animate: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 0, y: 0, transition: { duration: 0 } },
};
const reducedShade = {
  "data-app-modal-shade": "",
  initial: false as const,
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

// No scaling, animated filters, or springs: full-screen mobile panels stay sharp
// and animate entirely through opacity and a short vertical translation.
export function useDialogMotion() {
  const reducedMotion = useReducedMotion();
  return { panel: reducedMotion ? reducedPanel : panel, shade: reducedMotion ? reducedShade : shade };
}
