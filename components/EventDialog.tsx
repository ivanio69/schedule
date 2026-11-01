"use client";

import type { ReactNode } from "react";
import TaskDialog from "./TaskDialog";

export default function EventDialog({ title, eyebrow, children, onClose, busy = false, compact = false, closing = false }: {
  title: string; eyebrow: string; children: ReactNode; onClose: () => void; busy?: boolean; compact?: boolean; closing?: boolean;
}) {
  return <TaskDialog title={title} caption={eyebrow} busy={busy} closing={closing} compact={compact} onClose={onClose}>
    {children}
  </TaskDialog>;
}
