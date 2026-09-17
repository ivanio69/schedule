import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminPageFrame({ eyebrow, title, description, actions, children }: Props) {
  return (
    <main className="admin-shell admin-unified">
      <header className="admin-header admin-header-new">
        <div>
          <p className="admin-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className="admin-muted">{description}</p> : null}
        </div>
        {actions ? <div className="admin-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
