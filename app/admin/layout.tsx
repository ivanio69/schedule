import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="admin-rehearsals-nav">
        <Link href="/admin">Панель администратора</Link>
        <span aria-hidden="true">/</span>
        <Link href="/admin/rehearsals">Репетиции</Link>
      </div>
      {children}
      <style>{`
        .admin-rehearsals-nav{width:min(100% - 32px,1100px);margin:18px auto -22px;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px;font-weight:700}
        .admin-rehearsals-nav a{padding:7px 10px;border:1px solid var(--border);border-radius:10px;color:var(--muted);background:var(--surface);text-decoration:none;transition:.16s ease}
        .admin-rehearsals-nav a:hover{color:var(--text);background:var(--surface-hover)}
        .admin-rehearsals-nav span{opacity:.45}
        @media(max-width:600px){.admin-rehearsals-nav{width:calc(100% - 20px);margin-top:10px;margin-bottom:-14px}.admin-rehearsals-nav a{padding:6px 8px;font-size:10px}}
      `}</style>
    </>
  );
}
