"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSubgroupSubjects, type GroupPreference, type ScheduleData } from "@/lib/schedule";

const PERSON_KEY = "schedule_person_id";

export default function SettingsPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [preferences, setPreferences] = useState<Record<string, GroupPreference>>({});
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [status, setStatus] = useState("Загрузка…");
  const [notificationPreferences,setNotificationPreferences]=useState<Record<string,boolean>>({seminars:true,seminarParticipants:true,individuals:true});

  useEffect(() => {
    const id = localStorage.getItem(PERSON_KEY) ?? "";
    setPersonId(id);
    void Promise.all([
      fetch("/api/schedule", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/people", { cache: "no-store" }).then(r => r.json()),
      id ? fetch(`/api/profile/settings?personId=${encodeURIComponent(id)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
    ]).then(([data, peopleData, cloud]) => {
      const nextSchedule = data.schedule as ScheduleData;
      const subjects = getSubgroupSubjects(nextSchedule);
      const defaults = Object.fromEntries(subjects.map(s => [s.name, "both" as GroupPreference]));
      if (cloud?.preferences) Object.assign(defaults, cloud.preferences);
      if(cloud?.notificationPreferences)setNotificationPreferences(p=>({...p,...cloud.notificationPreferences}));
      setSchedule(nextSchedule);
      setPreferences(defaults);
      const currentPerson = (peopleData.people ?? []).find((p: { id: string; name: string; adminLink?: boolean }) => p.id === id);
      setPersonName(currentPerson?.name ?? "");
      setShowAdminLink(currentPerson?.adminLink === true);
      setStatus(id ? "Сохраняется автоматически" : "");
    }).catch(() => setStatus("Не удалось загрузить настройки"));
  }, []);

  const setPreference = async (subject: string, value: GroupPreference) => {
    if (!personId) return;
    const next = { ...preferences, [subject]: value };
    setPreferences(next);
    setStatus("Сохраняю…");
    try {
      const current = await fetch(`/api/profile/settings?personId=${encodeURIComponent(personId)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : { notes: {} });
      const response = await fetch("/api/profile/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId, preferences: next, notes: current.notes ?? {} }) });
      if (!response.ok) throw new Error();
      setStatus("Сохранено в облаке");
    } catch { setStatus("Не удалось сохранить в облако"); }
  };

  const setNotification=async(key:string,value:boolean)=>{if(!personId)return;const next={...notificationPreferences,[key]:value};setNotificationPreferences(next);setStatus("Сохраняю…");const r=await fetch("/api/profile/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,notificationPreferences:next})});setStatus(r.ok?"Сохранено в облаке":"Не удалось сохранить в облако")};

  const logout = () => {
    localStorage.removeItem(PERSON_KEY);
    window.dispatchEvent(new Event("schedule-auth-change"));
    window.location.href = "/";
  };

  const subjects = schedule ? getSubgroupSubjects(schedule) : [];
  return <main className="settings-page"><style jsx global>{`.settings-page{width:min(calc(100% - 28px),900px);margin:0 auto;padding:34px 0 110px;color:#f5f5f5}.settings-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.settings-page h1{margin:0;font-size:clamp(30px,6vw,52px);line-height:1;letter-spacing:-.045em}.settings-page .muted{margin:9px 0 0;color:#94949d;font-size:14px}.settings-page-status{color:#777780;font-size:11px}.settings-page-list{display:grid;gap:9px;margin-top:28px}.settings-page-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;border:1px solid #27272c;border-radius:16px;background:#111114}.settings-page-row strong{display:block}.settings-page-row small{display:block;margin-top:4px;color:#777780}.settings-page-switch{display:flex;gap:3px;padding:3px;border:1px solid #27272c;border-radius:10px}.settings-page-switch button{border:0;background:transparent;color:#94949d;border-radius:7px;padding:8px 10px;font-size:11px;font-weight:750;cursor:pointer}.settings-page-switch button.is-active{background:#f2f2f2;color:#111114}.settings-admin-link{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:28px;padding:16px 17px;border:1px solid #303036;border-radius:16px;color:#f5f5f5;background:#111114;text-decoration:none;transition:background .18s ease,transform .18s ease}.settings-admin-link:hover{background:#18181c;transform:translateY(-1px)}.settings-admin-link div{display:grid;gap:4px}.settings-admin-link strong{font-size:13px}.settings-admin-link span{color:#777780;font-size:10px}.settings-admin-link b{color:#94949d}.settings-logout{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:28px;padding:16px 17px;border:1px solid rgba(255,75,75,.25);border-radius:16px;background:rgba(255,55,55,.045)}.settings-logout div{display:grid;gap:4px}.settings-logout strong{font-size:13px}.settings-logout span{color:#777780;font-size:10px}.settings-logout button{border:1px solid rgba(255,75,75,.35);border-radius:10px;padding:9px 13px;color:#ff6b6b;background:rgba(255,55,55,.08);cursor:pointer;font-size:11px;font-weight:800;transition:background .18s ease,color .18s ease,transform .18s ease}.settings-logout button:hover{color:#fff;background:#d83b3b;transform:translateY(-1px)}@media(max-width:600px){.settings-page{width:calc(100% - 20px);padding-top:24px}.settings-page-head{align-items:flex-start;flex-direction:column}.settings-page-row{align-items:flex-start;flex-direction:column}.settings-page-switch{width:100%}.settings-page-switch button{flex:1}.settings-logout{align-items:flex-start;flex-direction:column}.settings-logout button{width:100%}}`}</style>
    <header className="settings-page-head"><h1>Настройки</h1><span role="status" className="settings-page-status">{status}</span></header>
    {!personId && <p className="muted"><Link href="/">Выбери своё имя</Link>, чтобы изменить настройки.</p>}
    <section className="settings-group" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading">Уведомления</h2>
      <div className="settings-page-list">{[["seminars","Новые семинары"],["seminarParticipants","Участники моей темы"],["individuals","Индивидуальные занятия"]].map(([key,label])=>
        <div className="settings-page-row" key={key}><strong>{label}</strong><div className="settings-page-switch">
          <button type="button" role="switch" aria-checked={!!notificationPreferences[key]} aria-label={label} disabled={!personId} className={notificationPreferences[key]?"is-active":""} onClick={()=>void setNotification(key,!notificationPreferences[key])}>{notificationPreferences[key]?"Вкл":"Выкл"}</button>
        </div></div>)}</div>
    </section>
    <section className="settings-group" aria-labelledby="groups-heading">
      <h2 id="groups-heading">Подгруппы</h2><p className="settings-group-description">Какие занятия показывать в расписании.</p>
      <div className="settings-page-list">{subjects.map(({name})=>
        <div className="settings-page-row" key={name}><strong>{name}</strong>
          <div className="settings-page-switch" role="group" aria-label={name}>{(["1","2","both"] as GroupPreference[]).map(option=>
            <button type="button" key={option} disabled={!personId} aria-pressed={preferences[name]===option} className={preferences[name]===option?"is-active":""} onClick={()=>void setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}
          </div>
        </div>)}</div>
      {schedule && !subjects.length && <p className="muted">Предметов с подгруппами пока нет.</p>}
    </section>
    {personId && <section className="settings-group" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Профиль</h2>
      <div className="settings-logout"><div><strong>{personName || "Текущий пользователь"}</strong><span>Выход только на этом устройстве.</span></div><button type="button" onClick={logout}>Выйти</button></div>
      {showAdminLink && <Link className="settings-admin-link" href="/admin"><strong>Панель управления</strong><b aria-hidden="true">→</b></Link>}
    </section>}
  </main>;
}
