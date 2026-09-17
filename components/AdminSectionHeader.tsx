import type { ReactNode } from "react";

export default function AdminSectionHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="admin-section-intro"><div>{eyebrow?<p className="admin-eyebrow">{eyebrow}</p>:null}<h2>{title}</h2>{description?<p className="admin-muted">{description}</p>:null}</div>{actions?<div className="admin-actions">{actions}</div>:null}</header>;
}
