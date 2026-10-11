"use client";

import { useCallback, useEffect, useState } from "react";
import ArtAppBanner from "@/components/ArtAppBanner";

export default function AdminArtBanner() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => fetch("/api/admin/art-banner", { cache: "no-store" })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить баннер");
      setEnabled(data.enabled === true);
      setError("");
    })
    .catch(value => setError(value instanceof Error ? value.message : "Не удалось загрузить баннер")), []);
  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (enabled === null || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/art-banner", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить настройку");
      setEnabled(data.enabled === true);
    } catch (value) { setError(value instanceof Error ? value.message : "Не удалось сохранить настройку"); }
    finally { setBusy(false); }
  }

  return <section className="admin-card admin-form-panel admin-art-banner">
    <div className="admin-announcement-form-head">
      <div><p className="admin-eyebrow">Баннер приложения</p><h2>артблять.</h2></div>
      <button type="button" className="admin-secondary" role="switch" aria-checked={enabled === true} disabled={enabled === null || busy} onClick={() => void toggle()}>{busy ? "Сохраняем…" : enabled === null ? "Загружаем…" : enabled ? "Выключить баннер" : "Включить баннер"}</button>
    </div>
    <p>Показывается на главной всем пользователям. Каждый может закрыть его на своём устройстве.</p>
    <ArtAppBanner />
    <span role="status">{enabled === null ? "" : enabled ? "Баннер включён" : "Баннер выключен"}</span>
    {error && <p role="alert">{error} {enabled === null && <button type="button" className="admin-secondary" onClick={() => void load()}>Повторить</button>}</p>}
  </section>;
}
