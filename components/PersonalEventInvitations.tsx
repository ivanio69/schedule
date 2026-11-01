"use client";

import { useState } from "react";
import type { PersonalEvent } from "@/lib/personal-events";
import styles from "./PersonalEvents.module.css";

export default function PersonalEventInvitations({ items, onResponded }: { items: PersonalEvent[]; onResponded: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  async function respond(id: string, status: "accepted" | "declined") {
    if (busy) return;
    setBusy(id); setError(null);
    try {
      const response = await fetch("/api/personal-events", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось отправить ответ");
      onResponded(id);
    } catch (failure) { setError({id,text:failure instanceof Error?failure.message:"Не удалось отправить ответ"}); }
    finally { setBusy(null); }
  }
  if (!items.length) return null;
  return <section className={styles.invitations} aria-label="Приглашения на события">
    <div className={styles.inviteeHeading}><div><h2>Вас пригласили</h2><p>Выберите, в каких событиях участвовать.</p></div><span>{items.length}</span></div>
    {items.map(event=><article key={event.id} className={styles.invitation}>
      <p className={styles.invitationAuthor}>{event.creatorName??"Автор события"} приглашает</p><h3>{event.title}</h3>
      <p className={styles.invitationTime}>{new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(event.date+"T12:00:00"))} · {event.timeStart}–{event.timeEnd}</p>
      {event.location&&<p className={styles.invitationLocation}>{event.location}</p>}{event.notes&&<details><summary>Заметки к событию</summary><p className={styles.invitationNotes}>{event.notes}</p></details>}
      {error?.id===event.id&&<p className={styles.error} role="alert">{error.text}</p>}
      <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy!==null} onClick={()=>void respond(event.id,"declined")}>Отказаться</button><button type="button" className={styles.primary} disabled={busy!==null} onClick={()=>void respond(event.id,"accepted")}>{busy===event.id?"Отправляю…":"Принять приглашение"}</button></div>
    </article>)}
  </section>;
}
