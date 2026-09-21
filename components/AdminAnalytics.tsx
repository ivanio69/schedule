"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";

type RouteKey = "dashboard" | "schedule" | "seminars" | "individuals" | "settings" | "rehearsal-editor" | "other";
type Period = 7 | 14 | 30 | 90;
type AnalyticsResponse = {
  periodDays:number;
  summary:{trackedUsers:number;totalUsers:number;activeUsers:number;totalSessions:number;totalActiveSeconds:number;averageSessionSeconds:number;totalPageViews:number;returningUsers:number;pushUsers:number;pushDevices:number};
  users:{personId:string;name:string;active:boolean;role:"user"|"headman"|"admin";sessions:number;totalActiveSeconds:number;averageSessionSeconds:number;pageViews:number;activeDays:number;firstSeenAt:string|null;lastSeenAt:string|null;lastSeenOverallAt:string|null;favoriteRoute:RouteKey|null;deviceCounts:Partial<Record<"mobile"|"tablet"|"desktop",number>>;modeCounts:Partial<Record<"pwa"|"browser",number>>;pushDevices:number}[];
  daily:{date:string;sessions:number;activeSeconds:number;activeUsers:number}[];
  topRoutes:{route:RouteKey;views:number}[];
  pushDevicesByPerson:{personId:string;name:string;active:boolean;devices:number}[];
};

const ROUTE_LABELS:Record<RouteKey,string>={dashboard:"Дашборд",schedule:"Расписание",seminars:"Семинары",individuals:"Индивидуальные",settings:"Настройки","rehearsal-editor":"Редактор репетиций",other:"Другое"};
const PERIODS:Period[]=[7,14,30,90];

function duration(seconds:number){
  if(seconds<60)return seconds+" сек";
  const minutes=Math.round(seconds/60);
  if(minutes<60)return minutes+" мин";
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?hours+" ч "+rest+" мин":hours+" ч";
}
function dateTime(value:string|null){
  if(!value)return "—";
  return new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}

export default function AdminAnalytics(){
  const [data,setData]=useState<AnalyticsResponse|null>(null);
  const [period,setPeriod]=useState<Period>(14);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");

  const load=async(nextPeriod=period)=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/analytics?days="+nextPeriod,{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Не удалось загрузить аналитику");
      setData(body.analytics);
    }catch(error){setError(error instanceof Error?error.message:"Не удалось загрузить аналитику")}
    finally{setLoading(false)}
  };

  useEffect(()=>{void load(period)},[period]);
  const users=useMemo(()=>{
    if(!data)return[];
    const q=query.trim().toLowerCase();
    return q?data.users.filter(user=>user.name.toLowerCase().includes(q)):data.users;
  },[data,query]);
  const maxDaily=Math.max(1,...(data?.daily.map(day=>day.sessions)??[1]));

  return <>
    <AdminHeading title="Аналитика" description="Использование приложения и состояние Push-подписок по выбранному периоду." actions={<button className="admin-secondary" disabled={loading} onClick={()=>void load()}>↻ Обновить</button>}/>
    <nav className="admin-chip-row admin-analytics-period" aria-label="Период аналитики">
      {PERIODS.map(days=><button key={days} type="button" className={period===days?"is-active":""} aria-pressed={period===days} onClick={()=>setPeriod(days)}>{days} дней</button>)}
    </nav>

    {loading&&!data?<LoadingState compact label="Загружаем аналитику" detail="Собираем показатели за выбранный период."/>:error?<p className="admin-analytics-error">{error}</p>:data&&<>
      <section className="admin-analytics-summary">
        <article className="admin-analytics-card"><span>Активные</span><strong>{data.summary.activeUsers}/{data.summary.totalUsers}</strong><small>пользователей за {data.periodDays} дней</small></article>
        <article className="admin-analytics-card"><span>Заходы</span><strong>{data.summary.totalSessions}</strong><small>{data.summary.returningUsers} пользователей заходили больше одного раза</small></article>
        <article className="admin-analytics-card"><span>Активное время</span><strong>{duration(data.summary.totalActiveSeconds)}</strong><small>В среднем {duration(data.summary.averageSessionSeconds)} за сессию</small></article>
        <article className="admin-analytics-card"><span>Просмотры</span><strong>{data.summary.totalPageViews}</strong><small>переходов между основными разделами</small></article>
        <article className="admin-analytics-card"><span>Push</span><strong>{data.summary.pushUsers}/{data.summary.totalUsers}</strong><small>{data.summary.pushDevices} устройств подписано</small></article>
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-analytics-panel"><header><h2>Последние {data.periodDays} дней</h2><span>сессии по дням</span></header><div className="admin-analytics-chart" style={{"--analytics-days":data.daily.length} as CSSProperties}>{data.daily.map(day=><div className="admin-analytics-day" key={day.date} title={day.date+": "+day.sessions+" сессий · "+day.activeUsers+" пользователей · "+duration(day.activeSeconds)}><div className="admin-analytics-bar" style={{height:Math.max(3,day.sessions/maxDaily*100)+"%"}}/><small>{day.date.slice(8)}</small></div>)}</div></article>
        <article className="admin-analytics-panel"><header><h2>Популярные разделы</h2><span>за выбранный период</span></header><div className="admin-analytics-routes">{data.topRoutes.length?data.topRoutes.slice(0,7).map(item=><div className="admin-analytics-route" key={item.route}><div><span>{ROUTE_LABELS[item.route]}</span><i style={{"--route-width":Math.max(4,item.views/(data.topRoutes[0]?.views||1)*100)+"%"} as CSSProperties}/></div><b>{item.views}</b></div>):<div className="admin-analytics-empty">Данных по разделам пока нет</div>}</div></article>
      </section>

      <section className="admin-analytics-push">
        <header><div><p className="admin-eyebrow">Push-уведомления</p><h2>Устройства по пользователям</h2></div><span>{data.summary.pushDevices} устройств · {data.summary.pushUsers} пользователей</span></header>
        <div>{data.pushDevicesByPerson.map(person=><article key={person.personId}><div className="admin-avatar">{person.name.trim().charAt(0).toUpperCase()}</div><div><strong>{person.name}</strong><small>{person.active?"Доступен для входа":"Скрыт"}</small></div><b className={person.devices?"has-devices":""}>{person.devices}</b></article>)}</div>
      </section>

      <section className="admin-analytics-people">
        <header><strong>По пользователям · {users.length}</strong><input className="admin-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по имени…"/></header>
        {users.length?users.map(user=><article className="admin-analytics-person" key={user.personId}>
          <div className="admin-analytics-person-main"><strong>{user.name}</strong><small>{user.lastSeenAt?"В периоде: "+dateTime(user.lastSeenAt):user.lastSeenOverallAt?"Последний визит "+dateTime(user.lastSeenOverallAt):"Ещё не заходил"}</small><div className="admin-analytics-device">{(user.deviceCounts.mobile??0)>0&&<span>mobile {user.deviceCounts.mobile}</span>}{(user.deviceCounts.tablet??0)>0&&<span>tablet {user.deviceCounts.tablet}</span>}{(user.deviceCounts.desktop??0)>0&&<span>desktop {user.deviceCounts.desktop}</span>}{(user.modeCounts.pwa??0)>0&&<span>PWA {user.modeCounts.pwa}</span>}{user.pushDevices>0&&<span>Push {user.pushDevices}</span>}</div></div>
          <div className="admin-analytics-metric"><b>{user.sessions}</b><span>заходов</span></div>
          <div className="admin-analytics-metric"><b>{duration(user.totalActiveSeconds)}</b><span>активного времени</span></div>
          <div className="admin-analytics-metric"><b>{duration(user.averageSessionSeconds)}</b><span>средняя сессия</span></div>
          <div className="admin-analytics-metric"><b>{user.pageViews}</b><span>просмотров</span></div>
          <div className="admin-analytics-metric"><b>{user.favoriteRoute?ROUTE_LABELS[user.favoriteRoute]:"—"}</b><span>{user.activeDays} активных дней</span></div>
        </article>):<div className="admin-analytics-empty">Пользователи не найдены</div>}
      </section>
    </>}
  </>;
}
