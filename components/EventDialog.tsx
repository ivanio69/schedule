"use client";

import type { ReactNode } from "react";
import TaskDialog from "./TaskDialog";

export default function EventDialog({ title, eyebrow, children, onClose, busy = false, compact = false, closing = false, wide = false }: {
  title: string; eyebrow: string; children: ReactNode; onClose: () => void; busy?: boolean; compact?: boolean; closing?: boolean; wide?: boolean;
}) {
  return <TaskDialog title={title} caption={eyebrow} busy={busy} closing={closing} compact={compact} wide={wide} onClose={onClose}>
    {children}
  </TaskDialog>;
}
