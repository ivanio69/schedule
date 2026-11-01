"use client";

import type { ReactNode } from "react";
import TaskDialog from "./TaskDialog";

export default function EventDialog({ title, eyebrow, children, onClose, busy = false, compact = false }: {
  title: string; eyebrow: string; children: ReactNode; onClose: () => void; busy?: boolean; compact?: boolean;
}) {
  return <TaskDialog title={title} caption={eyebrow} busy={busy} closing={false} compact={compact} onClose={onClose}>
    {children}
  </TaskDialog>;
}
