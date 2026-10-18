"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const TechnicalChangelogDialog = dynamic(() => import("./TechnicalChangelogDialog"), { ssr: false });

type EnvironmentInfo = {
  current: "stable" | "dev";
  currentVersion: string | null;
  dev: { version: string } | null;
};

export default function DevEnvironmentBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

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
    <><button type="button" className="dev-environment-banner" onClick={() => setChangelogOpen(true)} aria-haspopup="dialog" aria-expanded={changelogOpen} aria-label={`DEV ${version}. Открыть технический чейнджлог`}>
      <strong>DEV {version}</strong>
      <span>Версия в разработке · возможны ошибки</span>
    </button>
    {changelogOpen && <TechnicalChangelogDialog onClose={() => setChangelogOpen(false)} />}</>
  );
}
