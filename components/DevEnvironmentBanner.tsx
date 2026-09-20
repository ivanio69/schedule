"use client";

import { useEffect, useState } from "react";

type EnvironmentInfo = {
  current: "stable" | "dev";
  currentVersion: string | null;
  dev: { version: string } | null;
};

export default function DevEnvironmentBanner() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/environment", { cache: "no-store" });
        if (!response.ok) return;
        const environment = await response.json() as EnvironmentInfo;
        if (cancelled) return;

        if (environment.current === "dev") {
          setVersion(environment.currentVersion ?? environment.dev?.version ?? null);
        } else {
          setVersion(null);
        }
      } catch {
        if (!cancelled) setVersion(null);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  if (!version) return null;

  return (
    <div className="dev-environment-banner" role="status" aria-live="polite">
      <strong>DEV {version}</strong>
      <span>Версия в разработке · возможны ошибки</span>
    </div>
  );
}
