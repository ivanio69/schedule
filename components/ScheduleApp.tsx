"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSwipeable } from "react-swipeable";
import { DAY_NAMES, formatWeekRange, getCurrentWeek, getLessonsForWeek, getSubgroupSubjects, getTotalWeeks, type GroupPreference, type Lesson, type Rehearsal, type ScheduleData } from "@/lib/schedule";
import { RehearsalCard } from "@/components/RehearsalCard";
import { ScheduleCard } from "@/components/ScheduleCard";
import { IndividualLessonCard, type ScheduleIndividualLesson } from "@/components/IndividualLessonCard";
import type { Person } from "@/lib/people";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import LoadingState from "@/components/LoadingState";
import { buildConflictMap, type ConflictRecord, type ConflictInterval } from "@/lib/conflicts";
import type { RehearsalDraft } from "@/lib/rehearsal-drafts";

type View = "schedule" | "settings";
type Preferences = Record<string, GroupPreference>;
type Details = { type: "lesson"; item: Lesson } | { type: "individual"; item: ScheduleIndividualLesson } | { type: "rehearsal"; item: Rehearsal };
const SETTINGS_STORAGE_KEY = "schedule-subgroup-preferences";
const PERSON_KEY = "schedule_person_id";

function readPreferences(subjects: { name: string }[]): Preferences {
  const defaults = Object.fromEntries(subjects.map(({ name }) => [name, "both" as GroupPreference])) as Preferences;
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return defaults;
    return Object.fromEntries(subjects.map(({ name }) => [name, saved[name] === "1" || saved[name] === "2" || saved[name] === "both" ? saved[name] : "both"])) as Preferences;
  } catch { return defaults; }
}

function getCreatorId() { return window.localStorage.getItem(PERSON_KEY) ?? ""; }

function getDateForSelection(schedule: ScheduleData, week: number, day: number) {
  const [year, month, startDay] = schedule.semesterStart;
  const date = new Date(year, month, startDay);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + (week - 1) * 7 + day);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(date: string) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)); }
function parseRehearsalTags(value: string) {
  return [...new Set(value.split(/[,\n]/).map(tag => tag.trim().replace(/^#/, "").toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 8);
}

function getSelectionForDate(schedule: ScheduleData, value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const target = new Date(`${value}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const [year, month, startDay] = schedule.semesterStart;
  const first = new Date(year, month, startDay, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  const diff = Math.round((target.getTime() - first.getTime()) / 86_400_000);
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  const day = diff % 7;
  if (week < 1 || week > getTotalWeeks(schedule) || day < 0 || day >= DAY_NAMES.length) return null;
  return { week, day };
}

function lessonDeepLinkId(lesson: Lesson) {
  return lesson.occurrence?.key ?? lesson.id ?? `${lesson.class}|${lesson.timeStart}|${lesson.auditorium}`;
}

export default function ScheduleApp() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [individualLessons, setIndividualLessons] = useState<ScheduleIndividualLesson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [creatorId, setCreatorId] = useState("");
  const [view, setView] = useState<View>("schedule");
  const [preferences, setPreferences] = useState<Preferences>({});
  const [chinaMode, setChinaMode] = useState(false);
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [rehearsalSubject, setRehearsalSubject] = useState("");
  const [rehearsalResponsible, setRehearsalResponsible] = useState("");
  const [rehearsalParticipants, setRehearsalParticipants] = useState<string[]>([]);
  const [rehearsalNotes, setRehearsalNotes] = useState("");
  const [rehearsalTags, setRehearsalTags] = useState("");
  const [rehearsalStart, setRehearsalStart] = useState("18:00");
  const [rehearsalEnd, setRehearsalEnd] = useState("20:00");
  const [rehearsalSaving, setRehearsalSaving] = useState(false);
  const [rehearsalError, setRehearsalError] = useState("");
  const [rehearsalConflicts, setRehearsalConflicts] = useState<ConflictRecord[]>([]);
  const [rehearsalConflictsLoading, setRehearsalConflictsLoading] = useState(false);
  const [rehearsalEditing, setRehearsalEditing] = useState(false);
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [rehearsalDrafts, setRehearsalDrafts] = useState<RehearsalDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [deepLinkNotice, setDeepLinkNotice] = useState("");
  const didInitializeSelection = useRef(false);
  const didOpenDeepLink = useRef(false);

  const totalWeeks = useMemo(() => schedule ? getTotalWeeks(schedule) : 1, [schedule]);
  const currentWeek = useMemo(() => schedule ? getCurrentWeek(schedule) : 1, [schedule]);
  const subgroupSubjects = useMemo(() => schedule ? getSubgroupSubjects(schedule) : [], [schedule]);
  const lessons = useMemo(() => schedule ? getLessonsForWeek(schedule, day, week, preferences, chinaMode) : [], [schedule, day, week, preferences, chinaMode]);
  const selectedDate = useMemo(() => schedule ? getDateForSelection(schedule, week, day) : "", [schedule, week, day]);
  const creatorName = useMemo(() => people.find(person => person.id === creatorId)?.name ?? "", [people, creatorId]);

  useEffect(() => { const id=getCreatorId(); setCreatorId(id); void fetch("/api/people",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>setPeople(data?.people??[])).catch(()=>{}); if(id) void fetch(`/api/profile/settings?personId=${encodeURIComponent(id)}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>setChinaMode(data?.chinaMode===true)).catch(()=>{}); }, []);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/schedule?date=${selectedDate}&personId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json() as { schedule: ScheduleData; rehearsals: Rehearsal[] };
        setSchedule(data.schedule);
        setRehearsals(data.rehearsals ?? []);
        if (!didInitializeSelection.current) {
          didInitializeSelection.current = true;
          const params = new URLSearchParams(window.location.search);
          const requestedDate = params.get("date");
          const requestedSelection = requestedDate ? getSelectionForDate(data.schedule, requestedDate) : null;
          if (requestedSelection) {
            setWeek(requestedSelection.week);
            setDay(requestedSelection.day);
          } else {
            const now = new Date();
            const todayIndex = (now.getDay() + 6) % 7;
            setWeek(getCurrentWeek(data.schedule, now));
            setDay(todayIndex < DAY_NAMES.length ? todayIndex : 0);
          }
        }
        setPreferences(readPreferences(getSubgroupSubjects(data.schedule)));
      } catch { setRehearsals([]); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, creatorId]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    void fetch(`/api/individual-lessons?date=${encodeURIComponent(selectedDate)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled) setIndividualLessons((data?.individualLessons ?? []) as ScheduleIndividualLesson[]);
      })
      .catch(() => {
        if (!cancelled) setIndividualLessons([]);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => {
    if (loading || didOpenDeepLink.current || !selectedDate) return;
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get("date");
    if (requestedDate && requestedDate !== selectedDate) return;
    const rehearsalId = params.get("rehearsal");
    const individualId = params.get("individual");
    const lessonId = params.get("lesson");
    if (!rehearsalId && !individualId && !lessonId) {
      didOpenDeepLink.current = true;
      return;
    }
    if (rehearsalId) {
      const item = rehearsals.find(value => value.id === rehearsalId);
      if (item) {
        setDetails({ type: "rehearsal", item });
        didOpenDeepLink.current = true;
      }
      return;
    }
    if (individualId) {
      const item = individualLessons.find(value => value.id === individualId);
      if (item) {
        setDetails({ type: "individual", item });
        didOpenDeepLink.current = true;
      }
      return;
    }
    if (lessonId) {
      const item = lessons.find(value => lessonDeepLinkId(value) === lessonId);
      if (item) {
        setDetails({ type: "lesson", item });
        didOpenDeepLink.current = true;
      }
    }
  }, [loading, selectedDate, rehearsals, individualLessons, lessons]);

  useEffect(() => {
    if ((!rehearsalOpen && !rehearsalEditing) || !creatorName) return;
    setRehearsalParticipants(current => current.includes(creatorName) ? current : [creatorName, ...current]);
  }, [rehearsalOpen, rehearsalEditing, creatorName]);

  useEffect(() => {
    if (!rehearsalOpen && !rehearsalEditing) {
      setRehearsalConflicts([]);
      setRehearsalConflictsLoading(false);
      return;
    }
    const conflictDate = rehearsalEditing ? rehearsalDate : selectedDate;
    if (!conflictDate || !rehearsalParticipants.length || rehearsalStart >= rehearsalEnd) {
      setRehearsalConflicts([]);
      setRehearsalConflictsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRehearsalConflictsLoading(true);
      void fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          date: conflictDate,
          timeStart: rehearsalStart,
          timeEnd: rehearsalEnd,
          participantMode: "rehearsal",
          participants: rehearsalParticipants,
          blocks: [],
          excludeRehearsalId: rehearsalEditing && details?.type === "rehearsal" ? details.item.id : undefined,
        }),
      }).then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { conflicts?: ConflictRecord[] };
        setRehearsalConflicts(data.conflicts ?? []);
      }).catch(() => {
        if (!controller.signal.aborted) setRehearsalConflicts([]);
      }).finally(() => {
        if (!controller.signal.aborted) setRehearsalConflictsLoading(false);
      });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [rehearsalOpen, rehearsalEditing, rehearsalDate, selectedDate, rehearsalStart, rehearsalEnd, rehearsalParticipants, details]);

  useEffect(() => { if (Object.keys(preferences).length) window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences)); }, [preferences]);
  useLayoutEffect(() => {
    if (loading) return;
    const toolbar = document.querySelector<HTMLElement>(".week-toolbar");
    if (!toolbar) return;
    // iOS Safari can defer painting this layer until the first scroll.
    // Reading layout before the first frame and then settling the layer forces
    // the week selector to be visible immediately without moving the page.
    void toolbar.getBoundingClientRect();
    toolbar.dataset.iosPaint = "ready";
    const frame = requestAnimationFrame(() => {
      toolbar.dataset.iosPaint = "settled";
    });
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  useEffect(() => {
    if (!details) { setRehearsalEditing(false); return; }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDetails(null); };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [details]);

  const copyDetailsLink = async () => {
    if (!details || !selectedDate) return;
    const url = new URL("/schedule", window.location.origin);
    url.searchParams.set("date", selectedDate);
    if (details.type === "rehearsal") url.searchParams.set("rehearsal", details.item.id);
    if (details.type === "individual") url.searchParams.set("individual", details.item.id);
    if (details.type === "lesson") url.searchParams.set("lesson", lessonDeepLinkId(details.item));
    const value = url.toString();
    try {
      await navigator.clipboard.writeText(value);
      setDeepLinkNotice("Ссылка скопирована");
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setDeepLinkNotice(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
    }
    window.setTimeout(() => setDeepLinkNotice(""), 1800);
  };

  const refreshRehearsals = async () => {
    const response = await fetch(`/api/rehearsals?date=${selectedDate}&personId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { rehearsals: Rehearsal[] };
    setRehearsals(data.rehearsals ?? []);
  };
  const refreshDrafts = async () => {
    if (!creatorId) { setRehearsalDrafts([]); return; }
    try {
      const response = await fetch(`/api/rehearsal-drafts?personId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
      const data = response.ok ? await response.json() as { drafts?: RehearsalDraft[] } : null;
      setRehearsalDrafts((data?.drafts ?? []).filter(draft => draft.kind === "simple" && draft.date === selectedDate));
    } catch { setRehearsalDrafts([]); }
  };
  const loadSimpleDraft = (draft: RehearsalDraft) => {
    setActiveDraftId(draft.id);
    setRehearsalSubject(draft.subject);
    setRehearsalResponsible(draft.responsible);
    setRehearsalParticipants(creatorName ? [...new Set([creatorName, ...draft.participants])] : draft.participants);
    setRehearsalNotes(draft.notes);
    setRehearsalTags((draft.tags ?? []).join(", "));
    setRehearsalStart(draft.timeStart);
    setRehearsalEnd(draft.timeEnd);
    setDraftNotice("Черновик открыт");
  };
  const saveSimpleDraft = async () => {
    if (!creatorId || draftSaving) return;
    setDraftSaving(true); setDraftNotice("");
    try {
      const response = await fetch("/api/rehearsal-drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id: activeDraftId || undefined, ownerId: creatorId, kind: "simple", subject: rehearsalSubject, responsible: rehearsalResponsible,
        date: selectedDate, notes: rehearsalNotes, tags: parseRehearsalTags(rehearsalTags), timeStart: rehearsalStart, timeEnd: rehearsalEnd, participantMode: "rehearsal",
        participants: rehearsalParticipants, blocks: [],
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить черновик");
      setActiveDraftId(data.draft.id);
      setDraftNotice("Черновик сохранён");
      await refreshDrafts();
    } catch (error) { setDraftNotice(error instanceof Error ? error.message : "Не удалось сохранить черновик"); }
    finally { setDraftSaving(false); }
  };
  const deleteActiveDraft = async () => {
    if (!creatorId || !activeDraftId) return;
    await fetch(`/api/rehearsal-drafts?personId=${encodeURIComponent(creatorId)}&id=${encodeURIComponent(activeDraftId)}`, { method: "DELETE" }).catch(() => {});
    setActiveDraftId("");
    await refreshDrafts();
  };

  const moveDay = (direction: 1 | -1) => {
    if (direction === 1) {
      if (day < DAY_NAMES.length - 1) setDay(v => v + 1);
      else { setDay(0); setWeek(v => Math.min(v + 1, totalWeeks)); }
    } else if (day > 0) setDay(v => v - 1);
    else { setDay(DAY_NAMES.length - 1); setWeek(v => Math.max(v - 1, 1)); }
  };
  const handlers = useSwipeable({ onSwipedLeft: () => moveDay(1), onSwipedRight: () => moveDay(-1), preventScrollOnSwipe: false, trackMouse: false });
  const setPreference = (subject: string, preference: GroupPreference) => setPreferences(current => ({ ...current, [subject]: preference }));
  const toggleRehearsalParticipant = (name: string) => { if (name === creatorName) return; setRehearsalParticipants(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]); };

  const createRehearsal = async () => {
    setRehearsalError("");
    const participants = rehearsalParticipants;
    if (!creatorId) { setRehearsalError("Сначала выберите свой профиль на дашборде"); return; }
    if (!rehearsalSubject.trim() || !rehearsalResponsible.trim()) { setRehearsalError("Укажите предмет и ответственного"); return; }
    setRehearsalSaving(true);
    try {
      const response = await fetch("/api/rehearsals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId, subject: rehearsalSubject, date: selectedDate, timeStart: rehearsalStart, timeEnd: rehearsalEnd, responsible: rehearsalResponsible, participants, participantMode: "rehearsal", blocks: [], notes: rehearsalNotes, tags: parseRehearsalTags(rehearsalTags) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось создать репетицию");
      if (activeDraftId) await deleteActiveDraft();
      setRehearsalSubject(""); setRehearsalResponsible(""); setRehearsalParticipants([]); setRehearsalNotes(""); setRehearsalTags(""); setRehearsalOpen(false); await refreshRehearsals();
    } catch (error) { setRehearsalError(error instanceof Error ? error.message : "Не удалось создать репетицию"); }
    finally { setRehearsalSaving(false); }
  };

  const openCreateRehearsal = () => {
    setRehearsalSubject("");
    setRehearsalResponsible("");
    setRehearsalParticipants(creatorName ? [creatorName] : []);
    setRehearsalNotes("");
    setRehearsalTags("");
    setRehearsalStart("18:00");
    setRehearsalEnd("20:00");
    setRehearsalDate(selectedDate);
    setRehearsalError("");
    setActiveDraftId("");
    setDraftNotice("");
    setRehearsalOpen(true);
    void refreshDrafts();
  };

  const beginRehearsalEdit = (item: Rehearsal) => {
    setRehearsalSubject(item.subject);
    setRehearsalResponsible(item.responsible);
    setRehearsalParticipants(creatorName ? [...new Set([creatorName, ...item.participants])] : item.participants);
    setRehearsalNotes(item.notes ?? "");
    setRehearsalTags((item.tags ?? []).join(", "));
    setRehearsalStart(item.timeStart);
    setRehearsalEnd(item.timeEnd);
    setRehearsalDate(item.date);
    setRehearsalError("");
    setRehearsalEditing(true);
  };

  const saveRehearsalEdit = async (item: Rehearsal) => {
    const participants = rehearsalParticipants;
    if (!creatorId || !rehearsalSubject.trim() || !rehearsalResponsible.trim() || !rehearsalDate) {
      setRehearsalError("Заполните данные репетиции");
      return;
    }
    setRehearsalSaving(true);
    setRehearsalError("");
    try {
      const response = await fetch("/api/rehearsals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          creatorId,
          subject: rehearsalSubject,
          date: rehearsalDate,
          timeStart: rehearsalStart,
          timeEnd: rehearsalEnd,
          responsible: rehearsalResponsible,
          participants,
          participantMode: "rehearsal",
          blocks: [],
          notes: rehearsalNotes,
          tags: parseRehearsalTags(rehearsalTags),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось изменить репетицию");
      setRehearsalEditing(false);
      setDetails(null);
      await refreshRehearsals();
    } catch (error) {
      setRehearsalError(error instanceof Error ? error.message : "Не удалось изменить репетицию");
    } finally {
      setRehearsalSaving(false);
    }
  };

  const removeRehearsal = async (id: string) => {
    if (!creatorId) return;
    const response = await fetch(`/api/rehearsals?id=${encodeURIComponent(id)}&creatorId=${encodeURIComponent(creatorId)}`, { method: "DELETE" });
    if (response.ok) { setRehearsals(items => items.filter(item => item.id !== id)); setDetails(null); }
  };

  if (loading || !schedule) return <LoadingState screen label="Загружаем расписание" detail="Получаем недели, пары и репетиции."/>;

  const entries = [
    ...lessons.map(item => ({ key: `lesson-${item.occurrence?.date ?? selectedDate}-${item.occurrence?.key ?? item.id ?? item.class}-${item.timeStart}`, type: "lesson" as const, time: item.timeStart, item })),
    ...individualLessons.map(item => ({ key: `individual-${item.id}`, type: "individual" as const, time: item.timeStart, item })),
    ...rehearsals.map(item => ({ key: `rehearsal-${item.id}`, type: "rehearsal" as const, time: item.timeStart, item })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const personalIntervals: ConflictInterval[] = entries.flatMap(entry => {
    if (entry.type === "lesson") {
      if (entry.item.occurrence?.status === "cancelled") return [];
      return [{ key: entry.key, label: `Пара: ${entry.item.class}`, timeStart: entry.item.timeStart, timeEnd: entry.item.timeEnd }];
    }
    if (entry.type === "individual") {
      if (!creatorId || entry.item.personId !== creatorId) return [];
      return [{ key: entry.key, label: `Индивидуальное: ${entry.item.subject}`, timeStart: entry.item.timeStart, timeEnd: entry.item.timeEnd }];
    }
    if (entry.item.participantMode === "blocks" && entry.item.blocks?.length && !entry.item.isGlobal) {
      return entry.item.blocks
        .filter(block => Boolean(creatorName) && block.participants.includes(creatorName))
        .map(block => ({ key: entry.key, label: `Репетиция: ${entry.item.subject} · ${block.title}`, timeStart: block.timeStart, timeEnd: block.timeEnd }));
    }
    return [{ key: entry.key, label: `Репетиция: ${entry.item.subject}`, timeStart: entry.item.timeStart, timeEnd: entry.item.timeEnd }];
  });
  const conflictMap = buildConflictMap(personalIntervals);

  return <MotionConfig reducedMotion="user"><main className="schedule-shell">
    <header className="schedule-header"><div><p className="eyebrow">214Р · расписание</p><h1>{view === "schedule" ? "Учебная неделя" : "Настройки"}</h1>{view === "schedule" && <p className="week-caption">{formatWeekRange(schedule, week)}</p>}</div></header>
    {view === "schedule" ? <>
      <nav className="day-tabs" aria-label="Дни недели">{DAY_NAMES.map((name,index)=><button type="button" key={name} className={day===index?"is-active":""} aria-current={day===index?"page":undefined} onClick={()=>setDay(index)}><span>{name}</span><small>{index+1}</small></button>)}</nav>
      <section className="schedule-panel" {...handlers} aria-live="polite">
        <div className="week-toolbar"><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.max(1,v-1))} disabled={week===1} aria-label="Предыдущая неделя">←</button><button type="button" className="week-number" onClick={()=>setWeek(currentWeek)} aria-label="Перейти к текущей неделе"><span>Неделя</span><strong>{week}</strong>{week===currentWeek&&<em>сейчас</em>}</button><button type="button" className="icon-button" onClick={()=>setWeek(v=>Math.min(totalWeeks,v+1))} disabled={week===totalWeeks} aria-label="Следующая неделя">→</button></div>
        {rehearsalOpen ? <section className="rehearsal-form"><div className="rehearsal-form__head"><div><p className="rehearsal-label">Новая репетиция</p><h2>{selectedDate}</h2></div><a className="rehearsal-schedule-link" href={`/schedule/rehearsals/new?date=${encodeURIComponent(selectedDate)}`}>Создать с графиком →</a></div>{rehearsalDrafts.length>0&&<div className="rehearsal-drafts-strip"><span>Черновики</span>{rehearsalDrafts.map(draft=><button type="button" key={draft.id} className={activeDraftId===draft.id?"is-active":""} onClick={()=>loadSimpleDraft(draft)}>{draft.subject||"Без названия"} · {new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(new Date(draft.updatedAt))}</button>)}</div>}<div className="rehearsal-grid"><label>Предмет<input className="admin-input" value={rehearsalSubject} onChange={e=>setRehearsalSubject(e.target.value)} placeholder="Например, сценическое движение" autoFocus /></label><label>Ответственный<input className="admin-input" value={rehearsalResponsible} onChange={e=>setRehearsalResponsible(e.target.value)} placeholder="ФИО" /></label><label>Теги<input className="admin-input" value={rehearsalTags} onChange={e=>setRehearsalTags(e.target.value)} placeholder="прогон, сцена, костюмы" /></label><label>Начало<input className="admin-input" type="time" value={rehearsalStart} onChange={e=>setRehearsalStart(e.target.value)} /></label><label>Конец<input className="admin-input" type="time" value={rehearsalEnd} onChange={e=>setRehearsalEnd(e.target.value)} /></label><div className="rehearsal-participants"><span>Участники</span><div className="rehearsal-people-picker" role="group" aria-label="Участники репетиции">{people.map(person=><button type="button" key={person.id} className={`${rehearsalParticipants.includes(person.name)?"is-active":""}${person.name===creatorName?" is-locked":""}`} aria-pressed={rehearsalParticipants.includes(person.name)} disabled={person.name===creatorName} title={person.name===creatorName?"Автор участвует автоматически":undefined} onClick={()=>toggleRehearsalParticipant(person.name)}>{person.name}{person.name===creatorName?" · автор":""}</button>)}</div><small>{rehearsalParticipants.length?`Выбрано: ${rehearsalParticipants.length}`:"Выберите приглашённых"}</small></div><label className="rehearsal-notes-field">Заметки<textarea className="admin-input" value={rehearsalNotes} onChange={e=>setRehearsalNotes(e.target.value)} placeholder="Что взять, подготовить или не забыть…" /></label></div>{rehearsalConflictsLoading&&<p className="rehearsal-conflict-status">Проверяем пересечения…</p>}{rehearsalConflicts.length>0&&<div className="rehearsal-conflict-notice"><strong>Есть конфликты · {rehearsalConflicts.length}</strong>{rehearsalConflicts.slice(0,6).map((conflict,index)=><span key={`${conflict.personId}-${conflict.existing.id}-${index}`}><b>{conflict.personName}</b> · {conflict.existing.timeStart}–{conflict.existing.timeEnd} · {conflict.existing.title}</span>)}{rehearsalConflicts.length>6&&<small>И ещё {rehearsalConflicts.length-6}</small>}</div>}{rehearsalError&&<p className="admin-error">{rehearsalError}</p>}{draftNotice&&<p className="rehearsal-draft-notice" role="status">{draftNotice}</p>}<div className="rehearsal-form__actions"><button type="button" className="admin-secondary" disabled={draftSaving} onClick={()=>void saveSimpleDraft()}>{draftSaving?"Сохраняю…":activeDraftId?"Обновить черновик":"Сохранить черновик"}</button><button type="button" className="admin-secondary" onClick={()=>setRehearsalOpen(false)}>Отмена</button><button type="button" className="admin-primary" disabled={rehearsalSaving} onClick={()=>void createRehearsal()}>{rehearsalSaving?"Создаю…":"Создать репетицию"}</button></div></section> : <><button type="button" className="add-rehearsal-button" onClick={openCreateRehearsal}>＋ Добавить репетицию</button><div className="schedule-scholarship-slot" /></>}
        <AnimatePresence mode="wait" initial={false}><motion.div key={`${week}-${day}-${chinaMode}-${JSON.stringify(preferences)}-${individualLessons.map(item=>item.id).join(",")}`} className="lesson-list" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.18}}>{entries.map(entry=>entry.type==="lesson"?<ScheduleCard key={entry.key} lesson={entry.item} conflictWith={conflictMap.get(entry.key)} onClick={()=>setDetails({type:"lesson",item:entry.item})}/>:entry.type==="individual"?<IndividualLessonCard key={entry.key} lesson={entry.item} conflictWith={conflictMap.get(entry.key)} onClick={()=>setDetails({type:"individual",item:entry.item})}/>:<RehearsalCard key={entry.key} rehearsal={entry.item} conflictWith={conflictMap.get(entry.key)} own={entry.item.creatorId===creatorId} onDelete={entry.item.creatorId===creatorId?()=>void removeRehearsal(entry.item.id):undefined} onClick={()=>setDetails({type:"rehearsal",item:entry.item})}/>) }{entries.length===0&&<div className="empty-state"><span className="empty-state__icon">—</span><h2>Ничего нет</h2><p>В этот день ничего не запланировано.</p></div>}</motion.div></AnimatePresence>
      </section>
    </> : <section className="settings-panel" aria-label="Настройки расписания"><div className="settings-section"><div><p className="settings-section__eyebrow">Подгруппы</p><h2>Настройки предметов</h2><p>Для каждого предмета с подгруппами выберите, какую группу показывать.</p></div><div className="settings-list">{subgroupSubjects.map(({name,groups})=>{const value=preferences[name]??"both";return <div className="setting-row setting-row--subject" key={name}><span><strong>{name}</strong><small>Подгруппы: {groups.join(" и ")}</small></span><div className="preference-switch" role="group" aria-label={`Подгруппа для предмета ${name}`}>{(["1","2","both"] as GroupPreference[]).map(option=><button type="button" key={option} className={value===option?"is-active":""} aria-pressed={value===option} onClick={()=>setPreference(name,option)}>{option==="both"?"Обе":option}</button>)}</div></div>})}</div></div></section>}
    <nav className="bottom-nav" aria-label="Разделы"><button type="button" className={view==="schedule"?"is-active":""} onClick={()=>setView("schedule")}>Расписание</button><button type="button" className={view==="settings"?"is-active":""} onClick={()=>setView("settings")}>Настройки</button></nav>
    <AnimatePresence initial={false}>{details&&<motion.div className="details-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetails(null)}} initial={{opacity:0}} animate={{opacity:1,transition:{duration:.16,ease:[.22,1,.36,1]}}} exit={{opacity:0,transition:{duration:.14,ease:[.4,0,1,1]}}}><motion.section className={`details-modal${details.type==="rehearsal"?" details-modal--rehearsal":""}`} role="dialog" aria-modal="true" aria-labelledby="details-title" initial={{opacity:0,y:20,scale:.97,filter:"blur(4px)"}} animate={{opacity:1,y:0,scale:1,filter:"blur(0px)",transition:{duration:.2,ease:[.22,1,.36,1]}}} exit={{opacity:0,y:10,scale:.985,filter:"blur(5px)",transition:{duration:.14,ease:[.4,0,1,1]}}}><div className="details-modal__header"><div><span className="details-modal__eyebrow">{details.type==="lesson"?"Занятие":details.type==="individual"?"Индивидуальное занятие":rehearsalEditing?"Редактирование репетиции":"Репетиция"}</span><h2 id="details-title">{details.type==="lesson"?details.item.class:details.type==="rehearsal"&&rehearsalEditing?rehearsalSubject:details.item.subject}</h2></div><button type="button" className="details-modal__close" onClick={()=>setDetails(null)} aria-label="Закрыть">×</button></div>{details.type==="rehearsal"&&rehearsalEditing?<div className="details-modal__edit-form"><div className="details-modal__edit-grid"><label>Название<input className="admin-input" value={rehearsalSubject} onChange={e=>setRehearsalSubject(e.target.value)} autoFocus /></label><label>Дата<input className="admin-input" type="date" value={rehearsalDate} onChange={e=>setRehearsalDate(e.target.value)} /></label><label>Ответственный<input className="admin-input" value={rehearsalResponsible} onChange={e=>setRehearsalResponsible(e.target.value)} /></label><label>Теги<input className="admin-input" value={rehearsalTags} onChange={e=>setRehearsalTags(e.target.value)} placeholder="прогон, сцена, костюмы" /></label><label>Начало<input className="admin-input" type="time" value={rehearsalStart} onChange={e=>setRehearsalStart(e.target.value)} /></label><label>Конец<input className="admin-input" type="time" value={rehearsalEnd} onChange={e=>setRehearsalEnd(e.target.value)} /></label><label className="details-modal__edit-notes">Заметки<textarea className="admin-input" value={rehearsalNotes} onChange={e=>setRehearsalNotes(e.target.value)} placeholder="Заметки к репетиции" /></label><div className="details-modal__edit-participants"><span>Участники</span><div className="rehearsal-people-picker" role="group" aria-label="Участники репетиции">{people.map(person=><button type="button" key={person.id} className={`${rehearsalParticipants.includes(person.name)?"is-active":""}${person.name===creatorName?" is-locked":""}`} aria-pressed={rehearsalParticipants.includes(person.name)} disabled={person.name===creatorName} title={person.name===creatorName?"Автор участвует автоматически":undefined} onClick={()=>toggleRehearsalParticipant(person.name)}>{person.name}{person.name===creatorName?" · автор":""}</button>)}</div><small>{rehearsalParticipants.length?`Выбрано: ${rehearsalParticipants.length}`:"Выберите приглашённых"}</small></div></div>{rehearsalConflictsLoading&&<p className="rehearsal-conflict-status">Проверяем пересечения…</p>}{rehearsalConflicts.length>0&&<div className="rehearsal-conflict-notice"><strong>Есть конфликты · {rehearsalConflicts.length}</strong>{rehearsalConflicts.slice(0,6).map((conflict,index)=><span key={`${conflict.personId}-${conflict.existing.id}-${index}`}><b>{conflict.personName}</b> · {conflict.existing.timeStart}–{conflict.existing.timeEnd} · {conflict.existing.title}</span>)}</div>}{rehearsalError&&<p className="admin-error">{rehearsalError}</p>}<div className="details-modal__actions"><button type="button" className="admin-secondary" disabled={rehearsalSaving} onClick={()=>{setRehearsalEditing(false);setRehearsalError("")}}>Отмена</button><button type="button" className="details-modal__save" disabled={rehearsalSaving} onClick={()=>void saveRehearsalEdit(details.item)}>{rehearsalSaving?"Сохраняю…":"Сохранить изменения"}</button></div></div>:<><div className="details-modal__time"><strong>{details.item.timeStart}</strong><span>—</span><span>{details.item.timeEnd}</span></div><dl className="details-modal__list"><div><dt>Дата</dt><dd>{formatDate(details.type==="lesson"?selectedDate:details.item.date)}</dd></div>{details.type==="lesson"?<><div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div><div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div><div><dt>Подгруппа</dt><dd>{details.item.group.filter(group=>typeof group==="number").length===2?"Обе группы":`${details.item.group[0]} подгруппа`}</dd></div>{details.item.occurrence?.status&&<div><dt>Статус</dt><dd>{details.item.occurrence.status==="cancelled"?"Пара отменена":"Пара перенесена"}</dd></div>}{details.item.occurrence?.reason&&<div><dt>Причина</dt><dd>{details.item.occurrence.reason}</dd></div>}{details.item.occurrence?.status==="moved"&&details.item.occurrence.originalDate&&<div><dt>Изначально</dt><dd>{formatDate(details.item.occurrence.originalDate)}</dd></div>}</>:details.type==="individual"?<><div><dt>Студент</dt><dd>{details.item.personName}</dd></div><div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div><div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div>{details.item.note&&<div><dt>Примечание</dt><dd>{details.item.note}</dd></div>}</>:<><div><dt>Автор</dt><dd>{details.item.creatorName??"Автор не указан"}</dd></div><div><dt>Ответственный</dt><dd>{details.item.responsible}</dd></div>{details.item.tags?.length?<div><dt>Теги</dt><dd>{details.item.tags.map(tag=>`#${tag}`).join(" ")}</dd></div>:null}<div><dt>Участники</dt><dd className="details-modal__participants">{getRehearsalAudienceNames(details.item).length?getRehearsalAudienceNames(details.item).map(p=><span key={p}>{p}</span>):<span>Не указаны</span>}</dd></div><div><dt>Заметки</dt><dd>{details.item.notes?.trim()||"Нет заметок"}</dd></div></>}</dl><div className="details-modal__share"><button type="button" onClick={()=>void copyDetailsLink()}>↗ Скопировать ссылку</button>{deepLinkNotice&&<span role="status">{deepLinkNotice}</span>}</div>{details.type==="rehearsal"&&details.item.blocks?.length?<section className="details-modal__schedule"><div className="details-modal__schedule-head"><span>ГРАФИК</span><strong>{details.item.blocks.length} {details.item.blocks.length===1?"блок":"блоков"}</strong></div>{details.item.blocks.map((block,index)=><article key={block.id} className="details-modal__block"><div className="details-modal__block-time"><strong>{block.timeStart}</strong><small>{block.timeEnd}</small></div><div><span>{String(index+1).padStart(2,"0")}</span><h3>{block.title}</h3>{block.notes&&<p>{block.notes}</p>}{details.item.participantMode==="blocks"&&<div className="details-modal__block-people">{block.participants.length?block.participants.map(name=><b key={name}>{name}</b>):<b>Без участников</b>}</div>}</div></article>)}</section>:null}{details.type==="rehearsal"&&details.item.creatorId===creatorId&&<div className="details-modal__actions">{details.item.blocks?.length?<a className="details-modal__edit-button" href={`/schedule/rehearsals/new?edit=${encodeURIComponent(details.item.id)}`}>Редактировать график</a>:<button type="button" className="details-modal__edit-button" onClick={()=>beginRehearsalEdit(details.item)}>Редактировать</button>}<button type="button" className="details-modal__delete" onClick={()=>void removeRehearsal(details.item.id)}>Удалить репетицию</button></div>}</>}</motion.section></motion.div>}</AnimatePresence>
  </main></MotionConfig>;
}
