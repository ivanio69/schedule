"use client";

import { useEffect, useState } from "react";
import versionInfo from "@/version.json";

type BuildVersion = {
  version?: string;
  release?: string;
  dev?: number;
  channel?: "preview" | "production";
};

function isNewerBuild(remote: BuildVersion) {
  if (!remote.release) return false;
  if (remote.release !== versionInfo.release) return true;
  return remote.channel === "preview"
    && Number.isFinite(remote.dev)
    && Number(remote.dev) > versionInfo.dev;
}

export default function VersionUpdateNotice() {
  const [remote, setRemote] = useState<BuildVersion | null>(null);
  const [hidden, setHidden] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch("/api/build-version?ts=" + Date.now(), { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as BuildVersion;
        if (!stopped) setRemote(isNewerBuild(data) ? data : null);
      } catch {}
    };
    void check();
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const update = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async registration => {
          try {
            await registration.update();
            registration.waiting?.postMessage("SKIP_WAITING");
          } catch {}
        }));
      }
    } finally {
      window.location.reload();
    }
  };

  if (!remote || hidden) return null;
  const label = remote.version ?? (remote.channel === "preview"
    ? remote.release + ".dev" + remote.dev
    : remote.release);
  return <aside className="version-update-notice" role="status" aria-live="polite">
    <div><strong>Доступна новая версия</strong><span>Сейчас открыта устаревшая сборка · новая {label}</span></div>
    <div><button type="button" onClick={() => void update()} disabled={updating}>{updating ? "Обновляю…" : "Обновить"}</button><button type="button" className="is-quiet" onClick={() => setHidden(true)}>Позже</button></div>
  </aside>;
}
