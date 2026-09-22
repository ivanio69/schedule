"use client";

import { useEffect } from "react";

const PERSON_KEY = "schedule_person_id";

export default function ProfileSessionSync() {
  useEffect(() => {
    let sequence = 0;
    const sync = () => {
      const current = ++sequence;
      const personId = localStorage.getItem(PERSON_KEY);
      const request = personId
        ? fetch("/api/profile-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId }),
            cache: "no-store",
            keepalive: true,
          })
        : fetch("/api/profile-session", { method: "DELETE", cache: "no-store", keepalive: true });
      void request.catch(() => {}).then(() => {
        if (current !== sequence) return;
      });
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("schedule-auth-change", sync);
    return () => {
      sequence += 1;
      window.removeEventListener("storage", sync);
      window.removeEventListener("schedule-auth-change", sync);
    };
  }, []);

  return null;
}
