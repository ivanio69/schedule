"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";

type RouteKey = "dashboard" | "schedule" | "seminars" | "individuals" | "settings" | "rehearsal-editor" | "other";
type AnalyticsResponse = {
  summary:{trackedUsers:number;totalUsers:number;activeUsers7d:number;totalSessions:number;totalActiveSeconds:number;averageSessionSeconds:number;totalPageViews:number;returningUsers:number};
  users:{personId:string;name:string;active:boolean;sessions:number;totalActiveSeconds:number;averageSessionSeconds:number;pageViews:number;activeDays:number;firstSeenAt:string|null;lastSeenAt:string|null;favoriteRoute:RouteKey|null;deviceCounts:Partial<Record<"mobile"|"tablet"|"desktop",number>>;modeCounts:Partial<Record<"pwa"|"browser",number>>;sessions7d:number;activeSeconds7d:number}[];
  daily:{date:string;sessions:number;activeSeconds:number;activeUsers:number}[];
  topRoutes:{route:RouteKey;views:number}[];
};

const ROUTE_LABELS:Record<RouteKey,string>={dashboard:"Дашборд",schedule:"Расписание",seminars:"Семинары",individuals:"Индивидуальные",settings:"Настройки","rehearsal-editor":"Редактор репетиций",other:"Другое"};

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
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/analytics",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Не удалось загрузить аналитику");
      setData(body.analytics);
    }catch(error){setError(error instanceof Error?error.message:"Не удалось загрузить аналитику")}
    finally{setLoading(false)}
  };

  useEffect(()=>{void load()},[]);
  const users=useMemo(()=>{
    if(!data)return[];
    const q=query.trim().toLowerCase();
    return q?data.users.filter(user=>user.name.toLowerCase().includes(q)):data.users;
  },[data,query]);
  const maxDaily=Math.max(1,...(data?.daily.map(day=>day.sessions)??[1]));

  return <>
    <AdminHeading title="Аналитика" description="Заходы, активное время и использование основных разделов приложения." actions={<button className="admin-secondary" onClick={()=>void load()}>↻ Обновить</button>}/>
    {loading?<LoadingState compact label="Загружаем аналитику" detail="Собираем агрегированные показатели использования."/>:error?<p className="admin-analytics-error">{error}</p>:data&&<>
      <section className="admin-analytics-summary">
        <article className="admin-analytics-card"><span>Пользователи</span><strong>{data.summary.trackedUsers}/{data.summary.totalUsers}</strong><small>{data.summary.activeUsers7d} активны за последние 7 дней</small></article>
        <article className="admin-analytics-card"><span>Заходы</span><strong>{data.summary.totalSessions}</strong><small>{data.summary.returningUsers} пользователей возвращались больше одного раза</small></article>
        <article className="admin-analytics-card"><span>Активное время</span><strong>{duration(data.summary.totalActiveSeconds)}</strong><small>В среднем {duration(data.summary.averageSessionSeconds)} за сессию</small></article>
        <article className="admin-analytics-card"><span>Просмотры</span><strong>{data.summary.totalPageViews}</strong><small>Переходов между основными разделами приложения</small></article>
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-analytics-panel"><header><h2>Последние 14 дней</h2><span>сессии по дням</span></header><div className="admin-analytics-chart">{data.daily.map(day=><div className="admin-analytics-day" key={day.date} title={day.date+": "+day.sessions+" сессий · "+day.activeUsers+" пользователей · "+duration(day.activeSeconds)}><div className="admin-analytics-bar" style={{height:Math.max(3,day.sessions/maxDaily*100)+"%"}}/><small>{day.date.slice(8)}</small></div>)}</div></article>
        <article className="admin-analytics-panel"><header><h2>Популярные разделы</h2><span>просмотры</span></header><div className="admin-analytics-routes">{data.topRoutes.length?data.topRoutes.slice(0,7).map(item=><div className="admin-analytics-route" key={item.route}><div><span>{ROUTE_LABELS[item.route]}</span><i style={{"--route-width":Math.max(4,item.views/(data.topRoutes[0]?.views||1)*100)+"%"} as CSSProperties}/></div><b>{item.views}</b></div>):<div className="admin-analytics-empty">Пока нет данных</div>}</div></article>
      </section>

      <section className="admin-analytics-people">
        <header><strong>По пользователям · {users.length}</strong><input className="admin-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по имени…"/></header>
        {users.length?users.map(user=><article className="admin-analytics-person" key={user.personId}>
          <div className="admin-analytics-person-main"><strong>{user.name}</strong><small>{user.lastSeenAt?"Последний визит "+dateTime(user.lastSeenAt):"Ещё не заходил"}</small><div className="admin-analytics-device">{(user.deviceCounts.mobile??0)>0&&<span>mobile {user.deviceCounts.mobile}</span>}{(user.deviceCounts.tablet??0)>0&&<span>tablet {user.deviceCounts.tablet}</span>}{(user.deviceCounts.desktop??0)>0&&<span>desktop {user.deviceCounts.desktop}</span>}{(user.modeCounts.pwa??0)>0&&<span>PWA {user.modeCounts.pwa}</span>}</div></div>
          <div className="admin-analytics-metric"><b>{user.sessions}</b><span>заходов</span></div>
          <div className="admin-analytics-metric"><b>{duration(user.totalActiveSeconds)}</b><span>активного времени</span></div>
          <div className="admin-analytics-metric"><b>{duration(user.averageSessionSeconds)}</b><span>средняя сессия</span></div>
          <div className="admin-analytics-metric"><b>{user.sessions7d}</b><span>за 7 дней</span></div>
          <div className="admin-analytics-metric"><b>{user.favoriteRoute?ROUTE_LABELS[user.favoriteRoute]:"—"}</b><span>{user.pageViews} просмотров · {user.activeDays} дней</span></div>
        </article>):<div className="admin-analytics-empty">Пользователи не найдены</div>}
      </section>
    </>}
  </>;
}
