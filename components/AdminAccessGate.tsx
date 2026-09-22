"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";

type State = "checking" | "allowed" | "denied";

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let stopped = false;

    const sync = () => {
      const personId = localStorage.getItem("schedule_person_id");
      if (!personId) {
        setState("denied");
        void fetch("/api/profile-session", { method: "DELETE", keepalive: true }).catch(() => {});
        return;
      }

      setState(current => current === "allowed" ? current : "checking");
      void fetch("/api/profile-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
        cache: "no-store",
      }).then(async response => {
        const data = await response.json().catch(() => null);
        if (!stopped) setState(response.ok && data?.admin === true ? "allowed" : "denied");
      }).catch(() => {
        if (!stopped) setState("denied");
      });
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("schedule-auth-change", sync);
    return () => {
      stopped = true;
      window.removeEventListener("storage", sync);
      window.removeEventListener("schedule-auth-change", sync);
    };
  }, []);

  if (state === "checking") return <LoadingState screen label="Проверяем доступ" detail="Сверяем роль выбранного профиля."/>;
  if (state === "denied") return <main className="admin-shell admin-auth"><div className="admin-card admin-auth-card"><div className="admin-logo">214Р</div><p className="admin-eyebrow">Schedule Admin</p><h1>Нет доступа</h1><p className="admin-muted">Админ-панель доступна только профилям с ролью «Админ».</p><Link className="admin-primary admin-wide" href="/">Вернуться в приложение</Link></div></main>;
  return children;
}
