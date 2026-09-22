"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";

type RouteKey = "dashboard" | "schedule" | "seminars" | "individuals" | "settings" | "rehearsal-editor" | "headman" | "other";
type DeviceKey = "mobile" | "tablet" | "desktop";
type ModeKey = "pwa" | "browser";
type Period = 7 | 14 | 30 | 90;
type ChartMetric = "sessions" | "activeUsers" | "pageViews" | "activeSeconds";
type UserSort = "lastSeen" | "sessions" | "time" | "views" | "days";
type ActivityFilter = "all" | "active" | "inactive";

type AnalyticsUser = {
  personId:string;name:string;active:boolean;role:"user"|"headman"|"admin";
  sessions:number;totalActiveSeconds:number;averageSessionSeconds:number;pageViews:number;activeDays:number;
  firstSeenAt:string|null;lastSeenAt:string|null;firstSeenOverallAt:string|null;lastSeenOverallAt:string|null;
  favoriteRoute:RouteKey|null;routeViews:Partial<Record<RouteKey,number>>;pagesPerSession:number;
  deviceCounts:Partial<Record<DeviceKey,number>>;modeCounts:Partial<Record<ModeKey,number>>;pushDevices:number;
};

type AnalyticsResponse = {
  periodDays:number;
  summary:{
    trackedUsers:number;totalUsers:number;activeUsers:number;inactiveUsers:number;neverSeenUsers:number;newUsers:number;
    engagementRate:number;totalSessions:number;totalActiveSeconds:number;averageSessionSeconds:number;averageActiveSecondsPerUser:number;
    totalPageViews:number;pagesPerSession:number;returningUsers:number;returningRate:number;averageActiveDays:number;
    pushUsers:number;pushDevices:number;pushCoverage:number;pwaSessions:number;browserSessions:number;pwaShare:number;
  };
  users:AnalyticsUser[];
  daily:{date:string;sessions:number;activeSeconds:number;activeUsers:number;pageViews:number}[];
  topRoutes:{route:RouteKey;views:number;share:number}[];
  devices:{device:DeviceKey;sessions:number;share:number}[];
  modes:{mode:ModeKey;sessions:number;share:number}[];
  sessionDurations:{bucket:"underMinute"|"oneToFive"|"fiveToFifteen"|"fifteenPlus";sessions:number;share:number}[];
  pushDevicesByPerson:{personId:string;name:string;active:boolean;devices:number}[];
};

const ROUTE_LABELS:Record<RouteKey,string>={dashboard:"Дашборд",schedule:"Расписание",seminars:"Семинары",individuals:"Индивидуальные",settings:"Настройки","rehearsal-editor":"Редактор репетиций",headman:"Панель старосты",other:"Другое"};
const DEVICE_LABELS:Record<DeviceKey,string>={mobile:"Телефоны",tablet:"Планшеты",desktop:"Компьютеры"};
const MODE_LABELS:Record<ModeKey,string>={pwa:"PWA",browser:"Браузер"};
const DURATION_LABELS={underMinute:"до 1 минуты",oneToFive:"1–5 минут",fiveToFifteen:"5–15 минут",fifteenPlus:"15+ минут"} as const;
const PERIODS:Period[]=[7,14,30,90];
const CHART_LABELS:Record<ChartMetric,string>={sessions:"Сессии",activeUsers:"Пользователи",pageViews:"Просмотры",activeSeconds:"Активное время"};

function duration(seconds:number){
  if(seconds<60)return seconds+" сек";
  const minutes=Math.round(seconds/60);
  if(minutes<60)return minutes+" мин";
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?hours+" ч "+rest+" мин":hours+" ч";
}
function dateTime(value:string|null){
  if(!value)return "—";
  return new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}
function roleLabel(role:AnalyticsUser["role"]){return role==="admin"?"Админ":role==="headman"?"Староста":"Пользователь"}

export default function AdminAnalytics(){
  const [data,setData]=useState<AnalyticsResponse|null>(null);
  const [period,setPeriod]=useState<Period>(14);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [chartMetric,setChartMetric]=useState<ChartMetric>("sessions");
  const [userSort,setUserSort]=useState<UserSort>("lastSeen");
  const [activityFilter,setActivityFilter]=useState<ActivityFilter>("all");
  const [expandedUser,setExpandedUser]=useState<string|null>(null);

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
    const filtered=data.users.filter(user=>{
      if(q&&!user.name.toLowerCase().includes(q))return false;
      if(activityFilter==="active"&&user.sessions===0)return false;
      if(activityFilter==="inactive"&&user.sessions>0)return false;
      return true;
    });
    return [...filtered].sort((a,b)=>{
      if(userSort==="sessions")return b.sessions-a.sessions||a.name.localeCompare(b.name,"ru");
      if(userSort==="time")return b.totalActiveSeconds-a.totalActiveSeconds||a.name.localeCompare(b.name,"ru");
      if(userSort==="views")return b.pageViews-a.pageViews||a.name.localeCompare(b.name,"ru");
      if(userSort==="days")return b.activeDays-a.activeDays||a.name.localeCompare(b.name,"ru");
      return (b.lastSeenAt??b.lastSeenOverallAt??"").localeCompare(a.lastSeenAt??a.lastSeenOverallAt??"")||a.name.localeCompare(b.name,"ru");
    });
  },[data,query,userSort,activityFilter]);

  const chartValue=(day:AnalyticsResponse["daily"][number])=>day[chartMetric];
  const maxDaily=Math.max(1,...(data?.daily.map(chartValue)??[1]));
  const chartValueLabel=(day:AnalyticsResponse["daily"][number])=>chartMetric==="activeSeconds"?duration(day.activeSeconds):String(chartValue(day));

  return <>
    <AdminHeading title="Аналитика" description="Подробное использование приложения без записи IP, заметок и содержимого пользовательских данных." actions={<button className="admin-secondary" disabled={loading} onClick={()=>void load()}>↻ Обновить</button>}/>
    <nav className="admin-chip-row admin-analytics-period" aria-label="Период аналитики">
      {PERIODS.map(days=><button key={days} type="button" className={period===days?"is-active":""} aria-pressed={period===days} onClick={()=>setPeriod(days)}>{days} дней</button>)}
    </nav>

    {loading&&!data?<LoadingState compact label="Загружаем аналитику" detail="Собираем показатели за выбранный период."/>:error?<p className="admin-analytics-error">{error}</p>:data&&<>
      <section className="admin-analytics-summary">
        <article className="admin-analytics-card"><span>Охват</span><strong>{data.summary.activeUsers}/{data.summary.totalUsers}</strong><small>{data.summary.engagementRate}% профилей активны · {data.summary.inactiveUsers} без активности</small></article>
        <article className="admin-analytics-card"><span>Сессии</span><strong>{data.summary.totalSessions}</strong><small>{data.summary.returningRate}% активных возвращались · {data.summary.returningUsers} пользователей</small></article>
        <article className="admin-analytics-card"><span>Активное время</span><strong>{duration(data.summary.totalActiveSeconds)}</strong><small>В среднем {duration(data.summary.averageActiveSecondsPerUser)} на активного пользователя</small></article>
        <article className="admin-analytics-card"><span>Средняя сессия</span><strong>{duration(data.summary.averageSessionSeconds)}</strong><small>{data.summary.pagesPerSession} просмотра на сессию</small></article>
        <article className="admin-analytics-card"><span>Просмотры</span><strong>{data.summary.totalPageViews}</strong><small>переходов по основным разделам</small></article>
        <article className="admin-analytics-card"><span>Активные дни</span><strong>{data.summary.averageActiveDays}</strong><small>в среднем из {data.periodDays} · новых пользователей {data.summary.newUsers}</small></article>
        <article className="admin-analytics-card"><span>Push</span><strong>{data.summary.pushCoverage}%</strong><small>{data.summary.pushUsers}/{data.summary.totalUsers} пользователей · {data.summary.pushDevices} устройств</small></article>
        <article className="admin-analytics-card"><span>PWA</span><strong>{data.summary.pwaShare}%</strong><small>{data.summary.pwaSessions} PWA-сессий · {data.summary.browserSessions} в браузере</small></article>
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-analytics-panel admin-analytics-trend">
          <header><div><h2>Динамика за {data.periodDays} дней</h2><span>{CHART_LABELS[chartMetric].toLowerCase()} по дням</span></div><div className="admin-analytics-chart-tabs">{(Object.keys(CHART_LABELS) as ChartMetric[]).map(metric=><button type="button" key={metric} className={chartMetric===metric?"is-active":""} onClick={()=>setChartMetric(metric)}>{CHART_LABELS[metric]}</button>)}</div></header>
          <div className="admin-analytics-chart" style={{"--analytics-days":data.daily.length} as CSSProperties}>{data.daily.map(day=><div className="admin-analytics-day" key={day.date} title={day.date+" · "+day.sessions+" сессий · "+day.activeUsers+" пользователей · "+day.pageViews+" просмотров · "+duration(day.activeSeconds)}><div className="admin-analytics-bar" style={{height:Math.max(3,chartValue(day)/maxDaily*100)+"%"}}/><small>{chartValueLabel(day)}</small><small>{day.date.slice(8)}</small></div>)}</div>
        </article>
        <article className="admin-analytics-panel"><header><div><h2>Популярные разделы</h2><span>доля всех просмотров</span></div></header><div className="admin-analytics-routes">{data.topRoutes.length?data.topRoutes.slice(0,7).map(item=><div className="admin-analytics-route" key={item.route}><div><span>{ROUTE_LABELS[item.route]} <small>{item.share}%</small></span><i style={{"--route-width":Math.max(4,item.share)+"%"} as CSSProperties}/></div><b>{item.views}</b></div>):<div className="admin-analytics-empty">Данных по разделам пока нет</div>}</div></article>
      </section>

      <section className="admin-analytics-breakdown-grid">
        <article className="admin-analytics-panel"><header><div><h2>Устройства</h2><span>по количеству сессий</span></div></header><div className="admin-analytics-breakdown">{data.devices.map(item=><div key={item.device}><div><span>{DEVICE_LABELS[item.device]}</span><b>{item.sessions} · {item.share}%</b></div><i><u style={{width:item.share+"%"}}/></i></div>)}</div></article>
        <article className="admin-analytics-panel"><header><div><h2>Формат использования</h2><span>PWA против браузера</span></div></header><div className="admin-analytics-breakdown">{data.modes.map(item=><div key={item.mode}><div><span>{MODE_LABELS[item.mode]}</span><b>{item.sessions} · {item.share}%</b></div><i><u style={{width:item.share+"%"}}/></i></div>)}</div></article>
        <article className="admin-analytics-panel"><header><div><h2>Длина сессий</h2><span>по активному времени</span></div></header><div className="admin-analytics-breakdown">{data.sessionDurations.map(item=><div key={item.bucket}><div><span>{DURATION_LABELS[item.bucket]}</span><b>{item.sessions} · {item.share}%</b></div><i><u style={{width:item.share+"%"}}/></i></div>)}</div></article>
      </section>

      <section className="admin-analytics-push">
        <header><div><p className="admin-eyebrow">Push-уведомления</p><h2>Устройства по пользователям</h2></div><span>{data.summary.pushDevices} устройств · охват {data.summary.pushCoverage}%</span></header>
        <div>{data.pushDevicesByPerson.map(person=><article key={person.personId}><div className="admin-avatar">{person.name.trim().charAt(0).toUpperCase()}</div><div><strong>{person.name}</strong><small>{person.active?"Доступен для входа":"Скрыт"}</small></div><b className={person.devices?"has-devices":""}>{person.devices}</b></article>)}</div>
      </section>

      <section className="admin-analytics-people">
        <header>
          <div><strong>По пользователям · {users.length}</strong><small>Никогда не заходили: {data.summary.neverSeenUsers}</small></div>
          <div className="admin-analytics-people-controls">
            <input className="admin-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по имени…"/>
            <select className="admin-input" value={userSort} onChange={event=>setUserSort(event.target.value as UserSort)} aria-label="Сортировка пользователей"><option value="lastSeen">По последней активности</option><option value="sessions">По сессиям</option><option value="time">По времени</option><option value="views">По просмотрам</option><option value="days">По активным дням</option></select>
            <div className="admin-analytics-filter">{(["all","active","inactive"] as ActivityFilter[]).map(value=><button type="button" key={value} className={activityFilter===value?"is-active":""} onClick={()=>setActivityFilter(value)}>{value==="all"?"Все":value==="active"?"Активные":"Неактивные"}</button>)}</div>
          </div>
        </header>
        {users.length?users.map(user=>{
          const expanded=expandedUser===user.personId;
          const maxRoute=Math.max(1,...Object.values(user.routeViews).map(value=>value??0));
          return <article className={"admin-analytics-person"+(expanded?" is-expanded":"")} key={user.personId}>
            <div className="admin-analytics-person-main">
              <button className="admin-analytics-person-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpandedUser(expanded?null:user.personId)}><span><strong>{user.name}</strong><small>{user.lastSeenAt?"В периоде: "+dateTime(user.lastSeenAt):user.lastSeenOverallAt?"Последний визит "+dateTime(user.lastSeenOverallAt):"Ещё не заходил"}</small></span><b>{expanded?"−":"+"}</b></button>
              <div className="admin-analytics-device"><span>{roleLabel(user.role)}</span>{(user.deviceCounts.mobile??0)>0&&<span>mobile {user.deviceCounts.mobile}</span>}{(user.deviceCounts.tablet??0)>0&&<span>tablet {user.deviceCounts.tablet}</span>}{(user.deviceCounts.desktop??0)>0&&<span>desktop {user.deviceCounts.desktop}</span>}{(user.modeCounts.pwa??0)>0&&<span>PWA {user.modeCounts.pwa}</span>}{(user.modeCounts.browser??0)>0&&<span>browser {user.modeCounts.browser}</span>}{user.pushDevices>0&&<span>Push {user.pushDevices}</span>}</div>
            </div>
            <div className="admin-analytics-metric"><b>{user.sessions}</b><span>сессий</span></div>
            <div className="admin-analytics-metric"><b>{duration(user.totalActiveSeconds)}</b><span>активного времени</span></div>
            <div className="admin-analytics-metric"><b>{user.pageViews}</b><span>просмотров</span></div>
            <div className="admin-analytics-metric"><b>{user.activeDays}</b><span>активных дней</span></div>
            <div className="admin-analytics-metric"><b>{user.favoriteRoute?ROUTE_LABELS[user.favoriteRoute]:"—"}</b><span>любимый раздел</span></div>
            {expanded&&<div className="admin-analytics-person-details">
              <div className="admin-analytics-detail-stats">
                <div><span>Средняя сессия</span><strong>{duration(user.averageSessionSeconds)}</strong></div>
                <div><span>Просмотров / сессию</span><strong>{user.pagesPerSession}</strong></div>
                <div><span>Первый визит</span><strong>{dateTime(user.firstSeenOverallAt)}</strong></div>
                <div><span>Последний визит</span><strong>{dateTime(user.lastSeenOverallAt)}</strong></div>
              </div>
              <div className="admin-analytics-user-routes"><strong>Разделы за период</strong>{(Object.entries(user.routeViews) as [RouteKey,number][]).filter(([,views])=>views>0).sort((a,b)=>b[1]-a[1]).map(([route,views])=><div key={route}><span>{ROUTE_LABELS[route]}</span><i><u style={{width:Math.max(5,views/maxRoute*100)+"%"}}/></i><b>{views}</b></div>)}{!Object.values(user.routeViews).some(Boolean)&&<small>Нет просмотров разделов за выбранный период</small>}</div>
            </div>}
          </article>;
        }):<div className="admin-analytics-empty">Пользователи не найдены</div>}
      </section>
    </>}
  </>;
}
