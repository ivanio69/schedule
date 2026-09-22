"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { UsageDevice, UsageMode, UsageRoute } from "@/lib/usage-analytics";

const PERSON_KEY = "schedule_person_id";
const HEARTBEAT_MS = 15_000;
const ACTIVE_WINDOW_MS = 60_000;
const SESSION_TIMEOUT_MS = 30 * 60_000;

function routeFromPath(pathname: string): UsageRoute | null {
  if (pathname.startsWith("/admin")) return null;
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/seminars")) return "seminars";
  if (pathname.startsWith("/individual")) return "individuals";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/headman")) return "headman";
  if (pathname.startsWith("/rehearsal")) return "rehearsal-editor";
  return "other";
}

function deviceType(): UsageDevice {
  const width = Math.max(window.innerWidth || 0, screen.width || 0);
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

function displayMode(): UsageMode {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone ? "pwa" : "browser";
}

async function sendEvent(payload: Record<string, unknown>) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

export default function UsageAnalyticsTracker() {
  const pathname = usePathname();
  const [personId, setPersonId] = useState("");
  const lastInteractionRef = useRef(Date.now());
  const sessionRef = useRef("");

  useEffect(() => {
    const syncPerson = () => setPersonId(localStorage.getItem(PERSON_KEY) ?? "");
    syncPerson();
    window.addEventListener("storage", syncPerson);
    window.addEventListener("schedule-auth-change", syncPerson);
    return () => {
      window.removeEventListener("storage", syncPerson);
      window.removeEventListener("schedule-auth-change", syncPerson);
    };
  }, []);

  useEffect(() => {
    if (!personId || pathname.startsWith("/admin")) return;

    const sessionKey = `schedule_analytics_session:${personId}`;
    const lastKey = `schedule_analytics_last:${personId}`;
    const previousLast = Number(sessionStorage.getItem(lastKey) ?? "0");
    let sessionId = sessionStorage.getItem(sessionKey) ?? "";
    if (!sessionId || !previousLast || Date.now() - previousLast > SESSION_TIMEOUT_MS) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(sessionKey, sessionId);
    }
    sessionStorage.setItem(lastKey, String(Date.now()));
    sessionRef.current = sessionId;
    lastInteractionRef.current = Date.now();

    const startedKey = `schedule_analytics_started:${personId}:${sessionId}`;
    if (!sessionStorage.getItem(startedKey)) {
      sessionStorage.setItem(startedKey, "1");
      void sendEvent({ type: "start", personId, sessionId, device: deviceType(), mode: displayMode() });
    }

    const markActive = () => {
      const now = Date.now();
      lastInteractionRef.current = now;
      sessionStorage.setItem(lastKey, String(now));
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    for (const event of events) window.addEventListener(event, markActive, { passive: true });

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteractionRef.current > ACTIVE_WINDOW_MS) return;
      sessionStorage.setItem(lastKey, String(Date.now()));
      void sendEvent({
        type: "heartbeat",
        personId,
        sessionId,
        seconds: Math.round(HEARTBEAT_MS / 1000),
        device: deviceType(),
        mode: displayMode(),
      });
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") markActive();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      for (const event of events) window.removeEventListener(event, markActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [personId, pathname.startsWith("/admin")]);

  useEffect(() => {
    if (!personId) return;
    const route = routeFromPath(pathname);
    const sessionId = sessionRef.current || sessionStorage.getItem(`schedule_analytics_session:${personId}`) || "";
    if (!route || !sessionId) return;
    void sendEvent({ type: "pageview", personId, sessionId, route, device: deviceType(), mode: displayMode() });
  }, [pathname, personId]);

  return null;
}
