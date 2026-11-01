"use client";
import { getDashboardRehearsalSegments } from "@/lib/dashboard-timeline";
import { fetchAuthSession } from "@/lib/auth-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { IndividualLesson, Person } from "@/lib/people";
import type { IndividualSlot } from "@/lib/individual-slots";
import {
  getCurrentWeek,
  getLessonsForWeek,
  type GroupPreference,
  type Rehearsal,
  type ScheduleData,
} from "@/lib/schedule";
import type { SeminarList } from "@/lib/seminars";
import PersonalEventEditor from "@/components/PersonalEventEditor";
import PersonalEventInvitations from "@/components/PersonalEventInvitations";
import DayTimeline from "@/components/DayTimeline";
import EventDialog from "@/components/EventDialog";
import EventDetailsContent, { type EventDetails } from "@/components/EventDetailsContent";
import type { PersonalEvent } from "@/lib/personal-events";
import LoadingState from "@/components/LoadingState";
import DashboardAnnouncements from "@/components/DashboardAnnouncements";
import type { AttendanceReport } from "@/lib/attendance";
const PERSON_KEY = "schedule_person_id";
const mins = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIndex = () => {
  const d = new Date().getDay();
  return d === 0 ? -1 : d - 1;
};
const dayDate = (i: number) => {
  const d = new Date();
  d.setDate(d.getDate() + i - (d.getDay() - 1));
  return d;
};
const noteKey = (date: string, start: string, title: string) =>
  `${date}|${start}|${title}`;
const pick = (items: string[], seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items[hash % items.length];
};
type Event = {
  kind: "group" | "individual" | "slot" | "rehearsal" | "personal";
  start: string;
  end: string;
  title: string;
  subtitle: string;
  detail: string;
  note?: string;
  key: string;
  status?: "cancelled" | "moved";
  reason?: string;
  attendanceKey?: string;
  attendance?: "late" | "absence";
  attendanceReason?: string;
  href?: string;
  rehearsalId?: string;
};
export default function DashboardV2() {
  const [personalInvitations, setPersonalInvitations] = useState<PersonalEvent[]>([]);
  const personalRequest = useRef(0);
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [personalEvent, setPersonalEvent] = useState<PersonalEvent | null>(null);
  const [personalError, setPersonalError] = useState("");
  const [bookedSlots, setBookedSlots] = useState<IndividualSlot[]>([]);
  const [person, setPerson] = useState<Person | null>(null),
    [schedule, setSchedule] = useState<ScheduleData | null>(null),
    [individuals, setIndividuals] = useState<IndividualLesson[]>([]),
    [rehearsals, setRehearsals] = useState<Rehearsal[]>([]),
    [seminars, setSeminars] = useState<SeminarList[]>([]),
    [attendanceReports, setAttendanceReports] = useState<AttendanceReport[]>([]),
    [preferences, setPreferences] = useState<Record<string, GroupPreference>>(
      {},
    ),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [now, setNow] = useState(() => new Date()),
    [chinaMode, setChinaMode] = useState(false),
    [loading, setLoading] = useState(true);
  const refreshPersonalEvents = useCallback(async (signal?: AbortSignal) => {
    const revision = ++personalRequest.current;
    try {
      const response = await fetch("/api/personal-events", {cache:"no-store",signal});
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (signal?.aborted || revision !== personalRequest.current) return;
      setPersonalEvents(data.events ?? []);
      setPersonalInvitations(data.invitations ?? []);
      setPersonalError("");
    } catch { if (!signal?.aborted && revision === personalRequest.current) setPersonalError("Не удалось обновить события и приглашения"); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) void refreshPersonalEvents(controller.signal); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [refreshPersonalEvents]);
  const loadProfile = async (id: string) => {
    const [sr, ir] = await Promise.all([
      fetch(`/api/profile/settings?personId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }),
      fetch(`/api/individuals?personId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }),
    ]);
    if (sr.ok) {
      const d = await sr.json();
      setPreferences(d.preferences ?? {});
      setNotes(d.notes ?? {});
      setChinaMode(d.chinaMode === true);
    }
    if (ir.ok) setIndividuals((await ir.json()).lessons ?? []);
  };
  const loadAttendance = async () => {
    const clock = new Date();
    const clockDate = dateKey(clock);
    const clockTime = `${String(clock.getHours()).padStart(2,"0")}:${String(clock.getMinutes()).padStart(2,"0")}`;
    const response = await fetch(`/api/attendance?date=${encodeURIComponent(clockDate)}&time=${encodeURIComponent(clockTime)}`, { cache: "no-store" });
    if (response.ok) setAttendanceReports((await response.json()).reports ?? []);
  };
  useEffect(() => {
    let cancelled=false;
    const today=dateKey(new Date());
    const seminarRequest=fetch("/api/seminars",{cache:"no-store"})
      .then(response=>response.ok?response.json():{lists:[]})
      .catch(()=>({lists:[]}));
    void (async()=>{
      try{
        const authResponse=await fetchAuthSession();
        if(!authResponse.ok){window.location.replace("/login");return;}
        const auth=await authResponse.json();
        const current=auth.person as {id:string;name:string;role?:Person["role"]};
        if(!current?.id){window.location.replace("/login");return;}
        localStorage.setItem(PERSON_KEY,current.id);
        const profileRequest = loadProfile(current.id).catch(() => undefined);
        const [s,seminarData,personalData,slotData]=await Promise.all([
          fetch(`/api/schedule?date=${today}&personId=${encodeURIComponent(current.id)}`,{cache:"no-store"}).then(r=>r.json()),
          seminarRequest,
          fetch("/api/personal-events", {cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).catch(()=>({events:[],failed:true})),
          fetch(`/api/individual-slots?from=${today}&to=${today}`, {cache:"no-store"}).then(r=>r.ok?r.json():({slots:[]})).catch(()=>({slots:[]})),
          profileRequest,
        ]);
        if(cancelled)return;
        setPerson({id:current.id,name:current.name,active:true,role:current.role,createdAt:""});
        setSchedule(s.schedule??null);
        setRehearsals(s.rehearsals??[]);
        setSeminars(seminarData.lists??[]);
        setPersonalEvents(personalData.events??[]);
        setPersonalInvitations(personalData.invitations??[]);
        setBookedSlots((slotData.slots??[]).filter((slot:IndividualSlot)=>slot.studentIds?.includes(current.id) || slot.studentId===current.id));
        if(personalData.failed)setPersonalError("Не удалось загрузить личные события");
        void loadAttendance();
      }finally{
        if(!cancelled)setLoading(false);
      }
    })();
    return()=>{cancelled=true};
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncClock = () => {
      if (timer) clearTimeout(timer);
      if (document.hidden) return;
      setNow(new Date());
      timer = setTimeout(syncClock, 60000 - Date.now() % 60000);
    };
    syncClock();
    document.addEventListener("visibilitychange", syncClock);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", syncClock);
    };
  }, []);
  useEffect(() => {
    if (!person?.id) return;
    const t = setInterval(() => { if (!document.hidden) void loadAttendance(); }, 60000);
    return () => clearInterval(t);
  }, [person?.id]);
  const today = todayIndex(),
    week = schedule ? getCurrentWeek(schedule, now) : 1,
    todayKey = dateKey(today >= 0 ? dayDate(today) : now);
  const groups = useMemo(
    () =>
      schedule && today >= 0
        ? getLessonsForWeek(schedule, today, week, preferences, chinaMode)
        : [],
    [schedule, today, week, preferences, chinaMode],
  );
  const events = useMemo<Event[]>(
    () =>
      [
        ...personalEvents.filter(x=>x.date===todayKey).map(x=>({
          kind: "personal" as const, start:x.timeStart, end:x.timeEnd,
          title:x.title, subtitle:x.creatorId === person?.id ? "Событие" : `Приглашение · ${x.creatorName ?? "Участник"}`, detail:x.location || (x.creatorId === person?.id ? "Ваше событие" : "Вы участвуете"), note:x.notes, key:`personal-${x.id}`,
        })),
        ...groups.map((x) => ({
          kind: "group" as const,
          start: x.timeStart,
          end: x.timeEnd,
          title: x.class,
          subtitle: x.professor,
          detail: x.auditorium,
          key: noteKey(todayKey, x.timeStart, x.class),
          status: x.occurrence?.status,
          reason: x.occurrence?.reason,
          attendanceKey: x.occurrence?.key ?? x.id,
          ...(() => {
            const report = attendanceReports.find(item =>
              item.kind === "absence" &&
              item.dateFrom <= todayKey &&
              item.dateTo >= todayKey &&
              (item.scope !== "lesson" || item.lessonKey === (x.occurrence?.key ?? x.id))
            ) ?? attendanceReports.find(item =>
              item.kind === "late" &&
              item.dateFrom === todayKey &&
              item.lessonKey === (x.occurrence?.key ?? x.id)
            );
            return report ? { attendance: report.kind, attendanceReason: report.reasonText ?? report.reason } : {};
          })(),
        })),
        ...individuals
          .filter((x) => x.date === todayKey)
          .map((x) => ({
            kind: "individual" as const,
            start: x.timeStart,
            end: x.timeEnd,
            title: x.subject,
            subtitle: `Индивидуальное · ${x.professor}`,
            detail: x.auditorium,
            note: x.note,
            key: x.id,
          })),
        ...bookedSlots
          .filter((x) => x.date === todayKey)
          .map((x) => ({
            kind: "slot" as const,
            start: x.timeStart,
            end: x.timeEnd,
            title: x.subject,
            subtitle: `Индивидуальное · ${x.professor}`,
            detail: x.auditorium || "Аудитория не указана",
            note: x.note,
            key: `slot-${x.id}`,
            href: "/individual-slots",
          })),
        ...rehearsals
          .filter((x) => x.date === todayKey)
          .flatMap((x) => getDashboardRehearsalSegments(x, person?.id, person?.name).map(segment => ({
            kind: "rehearsal" as const,
            start: segment.timeStart,
            end: segment.timeEnd,
            title: segment.title,
            subtitle: segment.blockId ? x.subject : "Репетиция",
            detail: x.responsible,
            note: segment.notes,
            key: `rehearsal-${x.id}-${segment.blockId ?? "whole"}`,
            rehearsalId: x.id,
          }))),
      ].sort((a, b) => mins(a.start) - mins(b.start)),
    [groups, individuals, bookedSlots, rehearsals, personalEvents, todayKey, attendanceReports, person?.id, person?.name],
  );
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours(),
    daySeed = `${todayKey}|${person?.id ?? "guest"}`,
    nightText =
      hour >= 1 && hour < 4
        ? pick(["спи.", "сладких снов на потоках", "ты че бухаешь?"], daySeed)
        : hour >= 4 && hour < 8
          ? pick(
              ["доброе утро?", "зачем так рано", "приз за ответственность"],
              daySeed,
            )
          : null;
  const mySeminars = useMemo(() => seminars.flatMap((list) =>
    list.topics
      .filter((topic) => topic.studentIds.includes(person?.id ?? ""))
      .map((topic) => ({
        listId: list.id,
        subject: list.subject,
        listTitle: list.title,
        topicId: topic.id,
        topicTitle: topic.title,
        participants: topic.studentNames ?? [],
      })),
  ), [seminars, person?.id]);
  if (loading)
    return (
      <LoadingState
        screen
        label="Загружаем расписание"
        detail="Собираем пары, семинары и личные занятия."
      />
    );
  if (!person) return <LoadingState screen label="Проверяем вход" detail="Подтверждаем Telegram-сессию."/>;
  return (
    <main className="dashboard-v2">
      {personalError&&<p className="admin-error" role="alert">{personalError}</p>}
      {personalEvent&&<PersonalEventEditor date={personalEvent.date} event={personalEvent} personId={person.id} onClose={()=>setPersonalEvent(null)} onSaved={()=>void refreshPersonalEvents()}/>}
      {details && <EventDialog title={details.type === "lesson" ? details.item.class : details.item.subject} eyebrow={details.type === "rehearsal" ? "РЕПЕТИЦИЯ" : "ЗАНЯТИЕ"} onClose={()=>setDetails(null)}><EventDetailsContent details={details} lessonDate={todayKey} creatorId={person.id} personName={person.name}/>{details.type === "rehearsal" && details.item.creatorId === person.id && <Link className="admin-secondary" href={`/schedule/rehearsals/new?edit=${encodeURIComponent(details.item.id)}`}>Редактировать репетицию</Link>}</EventDialog>}
      <style jsx global>{`
        .dashboard-v2 {
          width: min(calc(100% - 28px), 980px);
          margin: 0 auto;
          padding: 0 0 24px;
          color: var(--text);
        }
        /* Keep the sticky header within the timeline, before seminars. */
        .dashboard-sticky-region { display: flow-root; }
        .dashboard-v2-head {
          position: sticky;
          top: env(safe-area-inset-top, 0px);
          z-index: 30;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 10px 0 6px;
          border: 0;
          background: transparent;
          isolation: isolate;
        }
        .dashboard-v2-head::before {
          content: "";
          position: absolute;
          z-index: -1;
          inset-inline: -24px;
          bottom: -52px;
          height: 112px;
          pointer-events: none;
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
          mask-image: linear-gradient(to bottom, #000, transparent);
        }
        body:has(.dev-environment-banner) .dashboard-v2-head { top: calc(44px + env(safe-area-inset-top, 0px)); }
        .dashboard-v2 h1 {
          margin: 0;
          font-size: clamp(26px, 5vw, 40px);
          letter-spacing: -0.045em;
        }
        .dashboard-v2-head > div > p:last-child {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 14px;
        }
        .dashboard-kicker {
          margin: 0 0 3px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.12em;
        }
        .dashboard-timeline,
        .dashboard-seminars {
          margin-top: 28px;
        }
        .dashboard-section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .dashboard-section-head h2 {
          margin: 0;
          font-size: 21px;
        }
        .dashboard-section-head span {
          color: var(--muted);
        }
        .dashboard-section-head a {
          color: var(--muted);
          font-size: 11px;
          text-decoration: none;
        }
        .dashboard-section-head a:hover {
          color: var(--text);
        }
        .dashboard-event-v2 {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr) auto;
          gap: 15px;
          align-items: center;
          margin-top: 8px;
          padding: 15px 16px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          transition: 0.18s;
        }
        .dashboard-event-v2.current {
          background: var(--surface-raised);
          border-color: var(--muted);
        }
        .dashboard-event-v2.past {
          opacity: 0.42;
          filter: grayscale(0.8);
        }
        .dashboard-event-v2.individual {
          border-color: rgba(120, 180, 255, 0.3);
        }
        .dashboard-event-v2.rehearsal {
          border-color: rgba(154, 230, 180, 0.35);
        }
        .dashboard-event-v2.attendance-late {
          border-color: color-mix(in srgb,#e9a23b 48%,var(--border));
          background: color-mix(in srgb,#e9a23b 6%,var(--surface));
          box-shadow: inset 3px 0 color-mix(in srgb,#e9a23b 80%,transparent);
        }
        .dashboard-event-v2.attendance-absence {
          border-color: color-mix(in srgb,#e36d6d 44%,var(--border));
          background: color-mix(in srgb,#e36d6d 6%,var(--surface));
          box-shadow: inset 3px 0 color-mix(in srgb,#e36d6d 78%,transparent);
        }
        .dashboard-event-v2.attendance-late .dashboard-event-content > span { color:#e9a23b; }
        .dashboard-event-v2.attendance-absence .dashboard-event-content > span { color:#e98383; }
        .dashboard-event-time {
          display: grid;
          gap: 3px;
        }
        .dashboard-event-time strong {
          font-size: 16px;
        }
        .dashboard-event-time small {
          color: var(--muted);
        }
        .dashboard-event-content > span {
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }
        .dashboard-event-content h3 {
          margin: 4px 0;
          font-size: 15px;
        }
        .dashboard-event-content p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
        }
        .dashboard-note-preview {
          display: block;
          margin-top: 6px;
          color: var(--muted-strong);
          font-size: 10px;
        }
        .dashboard-note {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 0;
          color: var(--muted);
          background: var(--surface-hover);
          cursor: pointer;
          font-size: 14px;
          font-weight: 750;
          line-height: 1;
        }
        .dashboard-note:hover {
          color: var(--text);
        }
        .dashboard-seminar-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }
        .dashboard-seminar-card {
          display: grid;
          gap: 5px;
          padding: 16px;
          border: 1px solid rgba(154, 230, 180, 0.35);
          border-radius: 16px;
          color: var(--text);
          background: linear-gradient(
            135deg,
            rgba(154, 230, 180, 0.11),
            #111114
          );
          text-decoration: none;
          transition:
            transform 0.18s,
            border-color 0.18s;
        }
        .dashboard-seminar-card:hover {
          border-color: rgba(154, 230, 180, 0.7);
          transform: translateY(-1px);
        }
        .dashboard-seminar-card > span {
          color: #9ae6b4;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .dashboard-seminar-card strong {
          font-size: 14px;
          line-height: 1.4;
        }
        .dashboard-seminar-card small {
          color: var(--muted);
          font-size: 10px;
          line-height: 1.5;
        }
        .dashboard-empty {
          padding: 35px;
          border: 1px dashed var(--border);
          border-radius: 16px;
          color: var(--muted);
          text-align: center;
        }
        .dashboard-empty a {
          color: var(--muted-strong);
        }
        .dashboard-choose {
          max-width: 600px;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .dashboard-choose > p:not(.dashboard-kicker) {
          color: var(--muted);
        }
        .dashboard-people {
          display: grid;
          gap: 7px;
          margin-top: 20px;
        }
        .dashboard-people button {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 14px;
          color: var(--text);
          background: var(--surface);
          text-align: left;
          cursor: pointer;
          transition:
            background 0.18s,
            transform 0.18s;
        }
        .dashboard-people button:hover {
          background: var(--surface-raised);
          transform: translateY(-1px);
        }
        .dashboard-people span {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: var(--surface-hover);
          font-weight: 800;
        }
        .dashboard-people b {
          color: var(--muted);
        }
        @media (max-width: 650px) {
          .dashboard-v2 {
            width: calc(100% - 20px);
            padding-top: 0;
          }
          .dashboard-v2-head {
            padding-top: 8px;
            align-items: flex-start;
          }
          .dashboard-event-v2 {
            grid-template-columns: 58px minmax(0, 1fr) auto;
            gap: 9px;
            padding: 13px;
          }
          .dashboard-note {
            width: 30px;
            height: 30px;
            font-size: 13px;
          }
          .dashboard-seminar-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="dashboard-sticky-region">
      <header data-dashboard-header className="dashboard-v2-head">
        <div>
          <p className="dashboard-kicker">214Р</p>
          <h1>{nightText ?? `Привет, ${person.name.split(" ")[0]}.`}</h1>
          <p>
            {new Intl.DateTimeFormat("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(now)}
          </p>
        </div>
      </header>
      <DashboardAnnouncements personId={person.id} />
      <PersonalEventInvitations items={personalInvitations} onResponded={id => {setPersonalInvitations(items=>items.filter(item=>item.id!==id)); void refreshPersonalEvents();}}/>

      <DayTimeline events={events} date={todayKey} week={week} currentMinute={currentMin} notes={notes} onOpen={event => {
        if (event.kind === "personal") setPersonalEvent(personalEvents.find(item => `personal-${item.id}` === event.key) ?? null);
        if (event.kind === "group") {
          const item = groups.find(item => noteKey(todayKey, item.timeStart, item.class) === event.key);
          if (item) setDetails({type:"lesson",item});
        }
        if (event.kind === "individual") {
          const item = individuals.find(item => item.id === event.key);
          if (item) setDetails({type:"individual",item:{...item,personName:person.name}});
        }
        if (event.kind === "rehearsal") {
          const source = events.find(item => item.key === event.key);
          const item = rehearsals.find(item => item.id === source?.rehearsalId);
          if (item) setDetails({type:"rehearsal",item});
        }
      }}/>
      </div>
      <section className="dashboard-seminars">
        <div className="dashboard-section-head">
          <h2>Мои семинары</h2>
          <Link href="/seminars">Все семинары →</Link>
        </div>
        {mySeminars.length ? (
          <div className="dashboard-seminar-grid">
            {mySeminars.map((item) => (
              <Link
                className="dashboard-seminar-card"
                href="/seminars"
                key={`${item.listId}-${item.topicId}`}
              >
                <span>
                  {item.subject} · {item.listTitle}
                </span>
                <strong>{item.topicTitle}</strong>
                <small>
                  {item.participants.length > 1
                    ? `Участники: ${item.participants.join(" · ")}`
                    : "Ты записан на эту тему"}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty">
            Ты пока не записан на семинары.{" "}
            <Link href="/seminars">Выбрать тему</Link>
          </div>
        )}
      </section>
    </main>
  );
}
