"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";

type State = "checking" | "allowed" | "denied";

export default function HeadmanAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  useEffect(() => {
    let stopped = false;
    const sync = () => {
      const personId = localStorage.getItem("schedule_person_id");
      if (!personId) { setState("denied"); return; }
      void fetch("/api/profile-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }), cache: "no-store",
      }).then(async response => {
        const data = await response.json().catch(() => null);
        const allowed = response.ok && (data?.role === "headman" || data?.role === "admin");
        if (!stopped) setState(allowed ? "allowed" : "denied");
      }).catch(() => { if (!stopped) setState("denied"); });
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("schedule-auth-change", sync);
    return () => { stopped = true; window.removeEventListener("storage", sync); window.removeEventListener("schedule-auth-change", sync); };
  }, []);
  if (state === "checking") return <LoadingState screen label="Проверяем роль" detail="Открываем панель старосты."/>;
  if (state === "denied") return <main style={{width:"min(calc(100% - 28px),760px)",margin:"0 auto",padding:"70px 0"}}><p className="eyebrow">214Р · СТАРОСТА</p><h1>Нет доступа</h1><p style={{color:"var(--muted)"}}>Эта панель доступна старосте и администратору.</p><Link href="/" style={{color:"var(--text)"}}>Вернуться на дашборд →</Link></main>;
  return children;
}
