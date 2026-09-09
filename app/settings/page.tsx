"use client";

import { useEffect, useState } from "react";
import { getSubgroupSubjects, type GroupPreference, type ScheduleData } from "@/lib/schedule";

const KEY = "schedule-subgroup-preferences";
const PERSON_KEY = "schedule_person_id";

export default function SettingsPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [preferences, setPreferences] = useState<Record<string, GroupPreference>>({});
  const [personId, setPersonId] = useState("");
  const [status, setStatus] = useState("Загрузка…");

  useEffect(() => {
    const id = localStorage.getItem(PERSON_KEY) ?? "";
    setPersonId(id);
    fetch("/api/schedule", { cache: "no-store" }).then(r => r.json()).then(async data => {
      const nextSchedule = data.schedule as ScheduleData;
      const subjects = getSubgroupSubjects(nextSchedule);
      const defaults = Object.fromEntries(subjects.map(s => [s.name, "both" as GroupPreference]));
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
        if (saved && typeof saved === "object") Object.assign(defaults, saved);
      } catch {}
      if (id) {
        try {
          const cloud = await fetch(`/api/profile/settings?personId=${encodeURIComponent(id)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
          if (cloud?.preferences) Object.assign(defaults, cloud.preferences);
        } catch {}
      }
      setSchedule(nextSchedule);
      setPreferences(defaults);
      setStatus(id ? "Настройки сохраняются в облаке" : "Выберите пользователя на дашборде");
    }).catch(() => setStatus("Не удалось загрузить настройки"));
  }, []);

  const setPreference = (subject: string, value: GroupPreference) => {
    setPreferences(current => {
      const next = { ...current, [subject]: value };
      localStorage.setItem(KEY, JSON.stringify(next));
      if (personId) {
        setStatus("Сохраняю…");
        fetch("/api/profile/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId, preferences: next, notes: {} }) })
          .then(r => { if (!r.ok) throw new Error(); setStatus("Сохранено в облаке"); })
          .catch(() => setStatus("Не удалось сохранить в облако"));
      }
      return next;
    });
  };

  const subjects = schedule ? getSubgroupSubjects(schedule) : [];
  return <main className="settings-page"><style jsx global>{`.settings-page{width:min(calc(100% - 28px),980px);margin:0 auto;padding:44px 0 70px;color:#f5f5f5}.settings-page h1{font-size:clamp(30px,6vw,48px);margin:6px 0}.settings-page .muted{color:#94949d}.settings-page-status{margin-top:8px;color:#777780;font-size:12px}.settings-page-list{display:grid;gap:9px;margin-top:28px}.settings-page-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;border:1px solid #27272c;border-radius:16px;background:#111114}.settings-page-row strong{display:block}.settings-page-row small{display:block;margin-top:4px;color:#777780}.settings-page-switch{display:flex;gap:3px;padding:3px;border:1px solid #27272c;border-radius:10px}.settings-page-switch button{border:0;background:transparent;color:#94949d;border-radius:7px;padding:8px 10px;font-size:11px;font-weight:750;cursor:pointer}.settings-page-switch button.is-active{background:#f2f2f2;color:#111114}@media(max-width:600px){.settings-page{width:calc(100% - 20px);padding-top:30px}.settings-page-row{align-items:flex-start;flex-direction:column}.settings-page-switch{width:100%}.settings-page-switch button{flex:1}}`}</style><p className="eyebrow">214Р · НАСТРОЙКИ</p><h1>Настройки</h1><p className="muted">Выберите, какие подгруппы показывать в расписании.</p><p className="settings-page-status">{status}</p><div className="settings-page-list">{subjects.map(({name,groups})=><div className="settings-page-row" key={name}><div><strong>{name}</strong><small>Подгруппы: {groups.join(" и ")}</small></div><div className="settings-page-switch">{(["1","2","both"] as GroupPreference[]).map(option=><button key={option} className={preferences[name]===option?"is-active":""} onClick={()=>setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}</div></div>)}</div></main>;
}
