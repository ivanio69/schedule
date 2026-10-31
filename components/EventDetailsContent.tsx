"use client";

import { useState } from "react";
import type { Lesson, Rehearsal } from "@/lib/schedule";
import type { ScheduleIndividualLesson } from "@/components/IndividualLessonCard";
import EventTiming from "@/components/EventTiming";
import LessonAttendanceQuickActions from "@/components/LessonAttendanceQuickActions";
import PersonalEventNote from "@/components/PersonalEventNote";
import RehearsalTimeline from "@/components/RehearsalTimeline";
import { getRehearsalAudienceNames, isRehearsalParticipant } from "@/lib/rehearsals";

export type EventDetails =
  | { type: "lesson"; item: Lesson }
  | { type: "individual"; item: ScheduleIndividualLesson }
  | { type: "rehearsal"; item: Rehearsal };

type Props = {
  details: EventDetails;
  lessonDate: string;
  creatorId: string;
  personName: string;
  onEditRehearsal?: (rehearsal: Rehearsal) => void;
  onDeleteRehearsal?: (rehearsal: Rehearsal) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(value + "T12:00:00"));
}

function noteKey(details: EventDetails) {
  if (details.type === "individual") return "individual:" + details.item.id;
  if (details.type === "rehearsal") return "rehearsal:" + details.item.id;
  const lesson = details.item;
  return lesson.occurrence?.date && lesson.occurrence?.key
    ? "occurrence:" + lesson.occurrence.date + ":" + lesson.occurrence.key
    : [lesson.class, lesson.timeStart, lesson.timeEnd, lesson.auditorium, lesson.group.join(",")].join("|");
}

export default function EventDetailsContent({ details, lessonDate, creatorId, personName, onEditRehearsal, onDeleteRehearsal }: Props) {
  const [notice, setNotice] = useState("");
  const spectator = details.type === "rehearsal" && !isRehearsalParticipant(details.item, creatorId, personName);
  const date = details.type === "lesson" ? lessonDate : details.item.date;
  const today = (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })();
  const showRehearsalTimer = details.type !== "rehearsal" || date === today;

  const downloadCalendar = () => {
    const start = new Date(date + "T" + details.item.timeStart + ":00");
    const end = new Date(date + "T" + details.item.timeEnd + ":00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const utc = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const name = details.type === "lesson" ? details.item.class : details.item.subject;
    const location = details.type === "lesson" || details.type === "individual" ? details.item.auditorium : "";
    const data = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Schedule//Events//RU", "BEGIN:VEVENT",
      "UID:" + crypto.randomUUID() + "@schedule", "DTSTAMP:" + utc(new Date()), "DTSTART:" + utc(start),
      "DTEND:" + utc(end), "SUMMARY:" + escapeIcs(name), "LOCATION:" + escapeIcs(location),
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([data], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "schedule-event.ics";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyLink = async () => {
    const url = new URL("/schedule", window.location.origin);
    url.searchParams.set("date", date);
    if (details.type === "rehearsal") url.searchParams.set("rehearsal", details.item.id);
    if (details.type === "individual") url.searchParams.set("individual", details.item.id);
    if (details.type === "lesson") url.searchParams.set("lesson", details.item.occurrence?.key ?? details.item.id ?? details.item.class);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Ссылка скопирована");
    } catch {
      const input = document.createElement("textarea");
      input.value = url.toString();
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setNotice(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
    }
    window.setTimeout(() => setNotice(""), 1800);
  };

  return <>
    {details.type === "rehearsal" && !showRehearsalTimer ? <p className="event-timing__static-time" aria-label="Время репетиции">{details.item.timeStart}–{details.item.timeEnd}</p> : spectator ? <p className="event-timing__static-time" aria-label="Время репетиции">{details.item.timeStart}–{details.item.timeEnd}</p> : <EventTiming
      lesson={details.type === "lesson"}
      date={date}
      start={details.item.timeStart}
      end={details.item.timeEnd}
      blocks={details.type === "rehearsal" ? details.item.blocks : undefined}
      cancelled={details.type === "lesson" && details.item.occurrence?.status === "cancelled"}
    />}
    <dl className="details-modal__list">
      <div><dt>Дата</dt><dd>{formatDate(date)}</dd></div>
      {details.type === "lesson" ? <>
        <div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div>
        <div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div>
        <div><dt>Подгруппа</dt><dd>{details.item.group.filter(group => typeof group === "number").length === 2 ? "Обе группы" : details.item.group[0] + " подгруппа"}</dd></div>
        {details.item.occurrence?.status && <div><dt>Статус</dt><dd>{details.item.occurrence.status === "cancelled" ? "Пара отменена" : "Пара перенесена"}</dd></div>}
        {details.item.occurrence?.reason && <div><dt>Причина</dt><dd>{details.item.occurrence.reason}</dd></div>}
        {details.item.occurrence?.status === "moved" && details.item.occurrence.originalDate && <div><dt>Изначально</dt><dd>{formatDate(details.item.occurrence.originalDate)}</dd></div>}
      </> : details.type === "individual" ? <>
        <div><dt>Студент</dt><dd>{details.item.personName}</dd></div>
        <div><dt>Преподаватель</dt><dd>{details.item.professor}</dd></div>
        <div><dt>Аудитория</dt><dd>{details.item.auditorium}</dd></div>
        {details.item.note && <div><dt>Примечание</dt><dd>{details.item.note}</dd></div>}
      </> : <>
        <div><dt>Моё участие</dt><dd>{isRehearsalParticipant(details.item, creatorId, personName) ? "Вы участвуете" : "Вы не участвуете"}</dd></div>
        <div><dt>Автор</dt><dd>{details.item.creatorName ?? "Автор не указан"}</dd></div>
        <div><dt>Ответственный</dt><dd>{details.item.responsible}</dd></div>
        <div><dt>Участники</dt><dd className="details-modal__participants">
          {getRehearsalAudienceNames(details.item).length
            ? getRehearsalAudienceNames(details.item).map(name => <span key={name}>{name}</span>)
            : <span>Не указаны</span>}
        </dd></div>
        <div><dt>Заметки</dt><dd>{details.item.notes?.trim() || "Нет заметок"}</dd></div>
      </>}
    </dl>
    {details.type === "lesson" && <LessonAttendanceQuickActions
      date={date}
      lessonKey={details.item.occurrence?.key}
      start={details.item.timeStart}
      end={details.item.timeEnd}
      cancelled={details.item.occurrence?.status === "cancelled"}
    />}
    <div className="details-modal__personal-note"><PersonalEventNote noteKey={noteKey(details)}/></div>
    <div className="details-modal__share">
      <button type="button" onClick={() => void copyLink()}>↗ Скопировать ссылку</button>
      <button type="button" onClick={downloadCalendar}>＋ В календарь</button>
      {notice && <span role="status">{notice}</span>}
    </div>
    {details.type === "rehearsal" && <>
      <RehearsalTimeline rehearsal={details.item} personName={personName}/>
      {details.item.creatorId === creatorId && <div className="details-modal__actions">
        {details.item.blocks?.length
          ? <a className="details-modal__edit-button" href={"/schedule/rehearsals/new?edit=" + encodeURIComponent(details.item.id)}>Редактировать график</a>
          : onEditRehearsal
            ? <button type="button" className="details-modal__edit-button" onClick={() => onEditRehearsal(details.item)}>Редактировать</button>
            : <a className="details-modal__edit-button" href={"/schedule?date=" + encodeURIComponent(details.item.date) + "&rehearsal=" + encodeURIComponent(details.item.id)}>Редактировать в расписании</a>}
        {onDeleteRehearsal && <button type="button" className="details-modal__delete" onClick={() => onDeleteRehearsal(details.item)}>Удалить репетицию</button>}
      </div>}
    </>}
  </>;
}
