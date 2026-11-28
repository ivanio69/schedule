"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import { fetchSharedRead } from "@/lib/shared-read";
import { birthdayDayKey, isBirthdayToday } from "@/lib/birthdays";
import { subscribeScreenLoading } from "@/lib/screen-loading";
import { useVisibleClock } from "@/lib/visible-clock";

type BirthdayPerson = { id: string; name: string; birthday: string | null };
export const BirthdayPersonContext = createContext<BirthdayPerson | null | undefined>(undefined);

export default function BirthdayCelebration({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BirthdayPerson | null | undefined>(undefined);
  const clock = useVisibleClock();
  const [initialNow] = useState(() => new Date());
  const day = birthdayDayKey(clock === null ? initialNow : new Date(clock));
  useEffect(() => {
    let disposed = false, revision = 0, loading = true;
    let birthday: string | undefined, personId = "", celebrated = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopConfetti: (() => void) | undefined;
    const clear = () => { clearTimeout(timer); timer = undefined; stopConfetti?.(); stopConfetti = undefined; };
    const launch = () => {
      if (disposed || loading || document.hidden || !personId || !isBirthdayToday(birthday) || celebrated === personId || timer) return;
      // Let the existing loader and entrance animation finish first.
      const current = revision;
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || current !== revision || loading || document.hidden || celebrated === personId || !isBirthdayToday(birthday)) return;
        void import("@/lib/birthday-confetti").then(({ fireBirthdayConfetti }) => {
          if (disposed || current !== revision || loading || document.hidden || celebrated === personId || !isBirthdayToday(birthday)) return;
          celebrated = personId;
          stopConfetti = fireBirthdayConfetti();
        }).catch(() => {});
      }, 550);
    };
    const sync = async () => {
      const current = ++revision;
      clear();
      personId = ""; birthday = undefined;
      try {
        const response = await fetchSharedRead("/api/profile/birthday");
        const data = response.ok ? await response.json() : null;
        if (disposed || current !== revision) return;
        personId = data?.person?.id ?? "";
        birthday = data?.person?.birthday;
        setProfile(data?.person ?? null);
        launch();
      } catch { if (!disposed && current === revision) setProfile(null); }
    };
    const unsubscribe = subscribeScreenLoading(value => { loading = value; if (loading) clear(); else launch(); });
    const visible = () => {
      if (document.hidden) { ++revision; clear(); }
      else { celebrated = ""; void sync(); }
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { celebrated = ""; void sync(); } };
    const authChanged = () => { celebrated = ""; void sync(); };
    void sync();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", restored);
    window.addEventListener("schedule-auth-change", authChanged);
    return () => {
      disposed = true; ++revision; clear(); unsubscribe();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("schedule-auth-change", authChanged);
    };
  }, [day]);
  return <BirthdayPersonContext.Provider value={profile}>{children}</BirthdayPersonContext.Provider>;
}
