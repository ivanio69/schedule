"use client";

import { useEffect } from "react";

const PERSON_KEY = "schedule_person_id";

export default function ProfileSessionSync() {
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache:"no-store" });
        if (!alive) return;
        if (!response.ok) {
          if (localStorage.getItem(PERSON_KEY)) {
            localStorage.removeItem(PERSON_KEY);
            window.dispatchEvent(new Event("schedule-auth-change"));
          }
          return;
        }
        const data = await response.json();
        const id = typeof data?.person?.id === "string" ? data.person.id : "";
        if (id && localStorage.getItem(PERSON_KEY) !== id) {
          localStorage.setItem(PERSON_KEY, id);
          window.dispatchEvent(new Event("schedule-auth-change"));
        }
      } catch {}
    };
    void sync();
    const visible=()=>{if(document.visibilityState==="visible")void sync()};
    window.addEventListener("focus",sync);
    document.addEventListener("visibilitychange",visible);
    return()=>{alive=false;window.removeEventListener("focus",sync);document.removeEventListener("visibilitychange",visible)};
  }, []);
  return null;
}
