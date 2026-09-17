import type { ReactNode } from "react";

export default function AdminEmptyState({ children }: { children: ReactNode }) {
  return <div className="admin-card admin-empty">{children}</div>;
}
