"use client";

import { useEffect, useState, type CSSProperties } from "react";
import NotificationPermission from "@/components/NotificationPermission";
import Link from "next/link";
import { getSubgroupSubjects, type GroupPreference, type ScheduleData } from "@/lib/schedule";
import { APP_VERSION } from "@/lib/app-version";
import LoadingState from "@/components/LoadingState";
import AsyncContentTransition from "@/components/AsyncContentTransition";
import { ACCENT_OPTIONS, DEFAULT_APPEARANCE, normalizeAppearance, type AccentPreset, type AppearanceSettings } from "@/lib/appearance";
import { persistAppearance, readStoredAppearance, resetLocalAppearance } from "@/lib/appearance-client";

const PERSON_KEY = "schedule_person_id";

type EnvironmentInfo = {
  current: "stable" | "dev";
  currentPr: number | null;
  currentVersion: string | null;
  stable: { url: string };
  dev: { pr: number; branch: string; url: string; version: string } | null;
};

export default function SettingsPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [preferences, setPreferences] = useState<Record<string, GroupPreference>>({});
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [chinaMode, setChinaMode] = useState(false);
  const [savingNotification,setSavingNotification]=useState(false);
  const [notificationsReady,setNotificationsReady]=useState(false);
  const [status, setStatus] = useState("Загрузка…");
  const [initialLoading, setInitialLoading] = useState(true);
  const [notificationPreferences,setNotificationPreferences]=useState<Record<string,boolean>>({seminars:true,seminarParticipants:true,individuals:true,scheduleChanges:true});
  const [appearance,setAppearance]=useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [environmentInfo,setEnvironmentInfo]=useState<EnvironmentInfo | null>(null);
  const [environmentSwitching,setEnvironmentSwitching]=useState(false);
  const [calendarUrl,setCalendarUrl]=useState("");
  const [calendarBusy,setCalendarBusy]=useState(false);
  const [calendarNotice,setCalendarNotice]=useState("");

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
      setChinaMode(cloud?.chinaMode === true);
      const nextAppearance = normalizeAppearance(cloud?.appearance ?? readStoredAppearance());
      setAppearance(nextAppearance);
      persistAppearance(nextAppearance);
      setNotificationsReady(Boolean(id && cloud));
      setSchedule(nextSchedule);
      setPreferences(defaults);
      const currentPerson = (peopleData.people ?? []).find((p: { id: string; name: string; adminLink?: boolean }) => p.id === id);
      setPersonName(currentPerson?.name ?? "");
      setShowAdminLink(currentPerson?.adminLink === true);
      setStatus(id ? "Настройки сохраняются в облаке" : "Выберите пользователя");
    }).catch(() => setStatus("Не удалось загрузить настройки")).finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    let stopped = false;

    void (async () => {
      try {
        const stamp = Date.now();
        const [environmentResponse, buildResponse] = await Promise.all([
          fetch(`/api/environment?ts=${stamp}`, { cache: "no-store" }),
          fetch(`/api/build-version?ts=${stamp}`, { cache: "no-store" }),
        ]);
        if (!environmentResponse.ok) return;

        const data = await environmentResponse.json() as EnvironmentInfo;
        const build = buildResponse.ok
          ? await buildResponse.json() as { version?: string; channel?: "preview" | "production" }
          : null;

        if (data.current === "dev" && build?.channel === "preview" && build.version) {
          data.currentVersion = build.version;
        }

        if (!stopped) setEnvironmentInfo(data);
      } catch {}
    })();

    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!personId) { setCalendarUrl(""); return; }
    let stopped = false;
    void fetch(`/api/calendar/apple?personId=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!stopped) setCalendarUrl(typeof data?.url === "string" ? data.url : ""); })
      .catch(() => {});
    return () => { stopped = true; };
  }, [personId]);

  const createCalendarLink=async(rotate=false)=>{
    if(!personId||calendarBusy)return;
    setCalendarBusy(true);setCalendarNotice("");
    try{
      const response=await fetch("/api/calendar/apple",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,rotate})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось создать ссылку");
      setCalendarUrl(data.url??"");
      setCalendarNotice(rotate?"Ссылка обновлена. Старую подписку нужно добавить заново.":"Ссылка календаря готова");
    }catch(error){setCalendarNotice(error instanceof Error?error.message:"Не удалось создать ссылку календаря");}
    finally{setCalendarBusy(false);}
  };
  const copyCalendarLink=async()=>{if(!calendarUrl)return;try{await navigator.clipboard.writeText(calendarUrl);setCalendarNotice("Ссылка скопирована");}catch{setCalendarNotice("Не удалось скопировать ссылку");}};
  const openAppleCalendar=()=>{if(!calendarUrl)return;window.location.href=calendarUrl.replace(/^https?:/,"webcal:");};
  const revokeCalendar=async()=>{
    if(!personId||calendarBusy)return;
    setCalendarBusy(true);setCalendarNotice("");
    try{
      const response=await fetch("/api/calendar/apple",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId})});
      if(!response.ok)throw new Error();
      setCalendarUrl("");setCalendarNotice("Подписка отключена");
    }catch{setCalendarNotice("Не удалось отключить подписку");}
    finally{setCalendarBusy(false);}
  };

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

  const setChinaModePreference=async(value:boolean)=>{if(!personId)return;const previous=chinaMode;setChinaMode(value);setStatus("Сохраняю…");try{const response=await fetch("/api/profile/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,chinaMode:value})});if(!response.ok)throw new Error();setStatus("Сохранено в облаке")}catch{setChinaMode(previous);setStatus("Не удалось сохранить в облако")}};

  const setAppearancePreference=async(next:AppearanceSettings)=>{
    const previous=appearance;
    setAppearance(next);
    persistAppearance(next);
    if(!personId){setStatus("Сохранено на этом устройстве");return;}
    setStatus("Сохраняю…");
    try{
      const response=await fetch("/api/profile/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,appearance:next})});
      if(!response.ok)throw new Error();
      setStatus("Цвета сохранены в облаке");
    }catch{
      setAppearance(previous);
      persistAppearance(previous);
      setStatus("Не удалось сохранить оформление");
    }
  };
  const setAccent=(key:"appAccent"|"rehearsalAccent"|"individualAccent"|"seminarAccent",value:AccentPreset)=>void setAppearancePreference({...appearance,[key]:value});

  const setNotification=async(key:string,value:boolean)=>{
    if(!personId||savingNotification||!notificationsReady)return;
    const previous=notificationPreferences;
    const next={...previous,[key]:value};
    setSavingNotification(true);setNotificationPreferences(next);setStatus("Сохраняю…");
    try {
      const response=await fetch("/api/profile/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,notificationPreferences:next})});
      if(!response.ok)throw new Error();
      setStatus("Сохранено в облаке");
    } catch {setNotificationPreferences(previous);setStatus("Не удалось сохранить. Попробуйте ещё раз.");}
    finally {setSavingNotification(false);}
  };

  const switchEnvironment = (target: "stable" | "dev") => {
    if (!environmentInfo || environmentSwitching || environmentInfo.current === target) return;
    setEnvironmentSwitching(true);

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const clearCookie = (name: string) => {
      document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0${secure}`;
    };

    if (target === "stable") {
      clearCookie("schedule_environment");
      clearCookie("schedule_dev_host");
      clearCookie("schedule_dev_pr");
      clearCookie("schedule_dev_version");
      window.location.reload();
      return;
    }

    const destination = environmentInfo.dev?.url;
    if (!destination) {
      setEnvironmentSwitching(false);
      return;
    }

    const preview = new URL(destination);
    if (!preview.hostname.startsWith("schedule-git-") || !preview.hostname.endsWith("-ivanio.vercel.app")) {
      setEnvironmentSwitching(false);
      setStatus("Не удалось определить DEV-сборку");
      return;
    }

    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `schedule_environment=dev; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
    document.cookie = `schedule_dev_host=${preview.hostname}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
    document.cookie = `schedule_dev_pr=${environmentInfo.dev.pr}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
    window.location.reload();
  };

  const logout = () => {
    localStorage.removeItem(PERSON_KEY);
    resetLocalAppearance({ animate: true });
    window.dispatchEvent(new Event("schedule-auth-change"));
    window.location.href = "/";
  };

  const subjects = schedule ? getSubgroupSubjects(schedule) : [];
  const colorSettings = [
    {key:"appAccent" as const,label:"Акцент приложения",description:"Фон, UI, кнопки и активные состояния",defaultClass:""},
    {key:"rehearsalAccent" as const,label:"Репетиции",description:"По умолчанию — оранжевый",defaultClass:" is-default-rehearsal"},
    {key:"individualAccent" as const,label:"Индивидуальные",description:"По умолчанию — красный",defaultClass:" is-default-individual"},
    {key:"seminarAccent" as const,label:"Семинары",description:"По умолчанию — фиолетовый",defaultClass:" is-default-seminar"},
  ];
  return <AsyncContentTransition loading={initialLoading} loadingNode={<LoadingState screen label="Загружаем настройки" detail="Получаем профиль, уведомления и параметры расписания."/>}><main className="settings-page"><style jsx global>{`.settings-page{width:min(calc(100% - 28px),900px);margin:0 auto;padding:34px 0 110px;color:var(--text)}.settings-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.settings-page h1{margin:0;font-size:clamp(30px,6vw,52px);line-height:1;letter-spacing:-.045em}.settings-page .muted{margin:9px 0 0;color:var(--muted);font-size:14px}.settings-page-status{color:var(--muted);font-size:11px}.settings-page-list{display:grid;gap:9px;margin-top:28px}.settings-page-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.settings-page-row strong{display:block}.settings-page-row small{display:block;margin-top:4px;color:var(--muted)}.settings-page-switch{display:flex;gap:3px;padding:3px;border:1px solid var(--border);border-radius:10px}.settings-page-switch button{border:0;background:transparent;color:var(--muted);border-radius:7px;padding:8px 10px;font-size:11px;font-weight:750;cursor:pointer}.settings-page-switch button.is-active{background:var(--accent);color:var(--accent-text)}.settings-page-switch button:disabled{opacity:.42;cursor:not-allowed}.settings-admin-link{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:28px;padding:16px 17px;border:1px solid var(--border);border-radius:16px;color:var(--text);background:var(--surface);text-decoration:none;transition:background .18s ease,transform .18s ease}.settings-admin-link:hover{background:var(--surface-hover);transform:translateY(-1px)}.settings-admin-link div{display:grid;gap:4px}.settings-admin-link strong{font-size:13px}.settings-admin-link span{color:var(--muted);font-size:10px}.settings-admin-link b{color:var(--muted)}.settings-logout{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:28px;padding:16px 17px;border:1px solid rgba(255,75,75,.25);border-radius:16px;background:rgba(255,55,55,.045)}.settings-logout div{display:grid;gap:4px}.settings-logout strong{font-size:13px}.settings-logout span{color:var(--muted);font-size:10px}.settings-logout button{border:1px solid rgba(255,75,75,.35);border-radius:10px;padding:9px 13px;color:#ff6b6b;background:rgba(255,55,55,.08);cursor:pointer;font-size:11px;font-weight:800;transition:background .18s ease,color .18s ease,transform .18s ease}.settings-logout button:hover{color:#fff;background:#d83b3b;transform:translateY(-1px)}.settings-version-value{flex:0 0 auto;border:1px solid var(--border);border-radius:999px;padding:7px 10px;color:var(--muted-strong);background:var(--surface-raised);font-size:11px;letter-spacing:.04em}.settings-calendar-row{align-items:flex-start}.settings-calendar-main{display:grid;gap:5px;min-width:0}.settings-calendar-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.settings-calendar-actions button{border:1px solid var(--border);border-radius:9px;padding:8px 10px;color:var(--text);background:var(--surface-raised);cursor:pointer;font-size:10px;font-weight:750}.settings-calendar-actions button:first-child{color:var(--accent-text);background:var(--accent);border-color:var(--accent)}.settings-calendar-actions button:disabled{opacity:.45}.settings-calendar-url{max-width:460px;overflow:hidden;color:var(--muted);font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.settings-calendar-notice{color:var(--muted);font-size:10px}@media(max-width:600px){.settings-page{width:calc(100% - 20px);padding-top:24px}.settings-page-head{align-items:flex-start;flex-direction:column}.settings-page-row{align-items:flex-start;flex-direction:column}.settings-page-switch{width:100%}.settings-page-switch button{flex:1}.settings-logout{align-items:flex-start;flex-direction:column}.settings-logout button{width:100%}}`}</style><div className="settings-page-head"><div><p className="eyebrow">214Р · НАСТРОЙКИ</p><h1>Настройки</h1><p className="muted">{personName ? `Профиль: ${personName}` : "Выберите пользователя"}</p></div><span className="settings-page-status" role="status">{status}</span></div><h2 style={{marginTop:28}}>Уведомления</h2><NotificationPermission personId={personId}/><div className="settings-page-list">{[["scheduleChanges","Отмены и переносы пар"],["seminars","Новые списки семинаров"],["seminarParticipants","Новые участники моей темы"],["individuals","Новые индивидуальные занятия"]].map(([key,label])=><div className="settings-page-row" key={key}><div><strong>{label}</strong><small>Push-уведомления</small></div><div className="settings-page-switch"><button type="button" role="switch" aria-checked={!!notificationPreferences[key]} aria-label={label} disabled={!notificationsReady||savingNotification} className={notificationPreferences[key]?"is-active":""} onClick={()=>void setNotification(key,!notificationPreferences[key])}>{notificationPreferences[key]?"Вкл":"Выкл"}</button></div></div>)}</div><h2 style={{marginTop:28}}>Расписание</h2><div className="settings-page-list"><div className="settings-page-row"><div><strong>Китайский режим</strong><small>Показывать только пары из подгруппы «Китай»</small></div><div className="settings-page-switch"><button type="button" role="switch" aria-checked={chinaMode} className={chinaMode?"is-active":""} onClick={()=>void setChinaModePreference(!chinaMode)}>{chinaMode?"Вкл":"Выкл"}</button></div></div><div className="settings-page-row settings-calendar-row"><div className="settings-calendar-main"><strong>Apple Calendar</strong><small>Подписка только для чтения: пары, репетиции и твои индивидуальные занятия будут обновляться из приложения.</small>{calendarUrl&&<code className="settings-calendar-url">{calendarUrl}</code>}{calendarNotice&&<span className="settings-calendar-notice" role="status">{calendarNotice}</span>}</div><div className="settings-calendar-actions">{!calendarUrl?<button type="button" disabled={!personId||calendarBusy} onClick={()=>void createCalendarLink(false)}>{calendarBusy?"Создаю…":"Создать подписку"}</button>:<><button type="button" disabled={calendarBusy} onClick={openAppleCalendar}>Открыть в Calendar</button><button type="button" disabled={calendarBusy} onClick={()=>void copyCalendarLink()}>Скопировать ссылку</button><button type="button" disabled={calendarBusy} onClick={()=>void createCalendarLink(true)}>Обновить ссылку</button><button type="button" disabled={calendarBusy} onClick={()=>void revokeCalendar()}>Отключить</button></>}</div></div></div><div className="settings-page-list">{subjects.map(({name,groups})=><div className="settings-page-row" key={name}><div><strong>{name}</strong><small>Подгруппы: {groups.join(" и ")}</small></div><div className="settings-page-switch">{(["1","2","both"] as GroupPreference[]).map(option=><button key={option} className={preferences[name]===option?"is-active":""} onClick={()=>void setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}</div></div>)}</div><h2 style={{marginTop:28}}>Оформление</h2><div className="settings-page-list"><div className="settings-page-row"><div><strong>Тема</strong><small>Чёрный или белый интерфейс</small></div><div className="settings-page-switch"><button type="button" className={appearance.theme==="dark"?"is-active":""} aria-pressed={appearance.theme==="dark"} onClick={()=>void setAppearancePreference({...appearance,theme:"dark"})}>Чёрная</button><button type="button" className={appearance.theme==="light"?"is-active":""} aria-pressed={appearance.theme==="light"} onClick={()=>void setAppearancePreference({...appearance,theme:"light"})}>Белая</button></div></div>{colorSettings.map(item=><div className="settings-page-row settings-page-row--colors" key={item.key}><div><strong>{item.label}</strong><small>{item.description}</small></div><div className="settings-color-presets" role="group" aria-label={item.label}>{ACCENT_OPTIONS.map(option=><button type="button" key={option.value} className={`settings-color-preset${appearance[item.key]===option.value?" is-active":""}${option.value==="default"?` is-default-preset${item.defaultClass}`:""}`} aria-pressed={appearance[item.key]===option.value} aria-label={`${item.label}: ${option.label}`} title={option.label} style={option.color?({"--swatch":option.color} as CSSProperties):undefined} onClick={()=>setAccent(item.key,option.value)}><span aria-hidden="true"/></button>)}</div></div>)}</div><h2 style={{marginTop:28}}>Приложение</h2><div className="settings-page-list"><div className="settings-page-row"><div><strong>Среда приложения</strong><small>{environmentInfo?.dev?"STABLE или последний готовый preview открытого PR":"Сейчас доступна только стабильная версия"}</small></div><div className="settings-page-switch"><button type="button" className={environmentInfo?.current==="stable"?"is-active":""} aria-pressed={environmentInfo?.current==="stable"} disabled={!environmentInfo||environmentSwitching} onClick={()=>switchEnvironment("stable")}>STABLE</button><button type="button" className={environmentInfo?.current==="dev"?"is-active":""} aria-pressed={environmentInfo?.current==="dev"} disabled={!environmentInfo?.dev||environmentSwitching} onClick={()=>switchEnvironment("dev")}>{environmentInfo?.current==="dev"&&environmentInfo.currentVersion?`DEV ${environmentInfo.currentVersion}`:environmentInfo?.dev?`DEV ${environmentInfo.dev.version}`:"DEV"}</button></div></div><div className="settings-page-row"><div><strong>Аналитика использования</strong><small>Администратор видит количество сессий, активное время и используемые разделы этого профиля. IP, содержимое заметок и тексты не записываются.</small></div><span className="settings-version-value">Активна</span></div><div className="settings-page-row"><div><strong>Версия приложения</strong><small>{APP_VERSION.includes(".dev")?"Предрелизная сборка":"Стабильная версия"}</small></div><b className="settings-version-value">v{APP_VERSION}</b></div></div>{personId&&showAdminLink&&<Link className="settings-admin-link" href="/admin"><div><strong>Админ-панель</strong><span>Управление расписанием и участниками.</span></div><b>→</b></Link>}{personId&&<section className="settings-logout"><div><strong>Выйти из аккаунта</strong><span>Профиль будет удалён с этого устройства.</span></div><button type="button" onClick={logout}>Выйти</button></section>}</main></AsyncContentTransition>;
}
