import type { ReactNode } from "react";

export default function AdminHeading({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return <header className="admin-page-heading">
    <div className="admin-page-heading__copy">
      <h1>{title}</h1>
      {description && <p className="admin-page-heading__description">{description}</p>}
    </div>
    {actions && <div className="admin-page-heading__actions">{actions}</div>}
  </header>;
}
