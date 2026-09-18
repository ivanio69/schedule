"use client";

import { useEffect, useState } from "react";

type DeviceState = "checking" | "unsupported" | "default" | "denied" | "unsubscribed" | "enabled";
function supported() {
  return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export default function NotificationPermission({ personId }: { personId: string }) {
  const [state, setState] = useState<DeviceState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!supported()) { if (alive) setState("unsupported"); return; }
      if (Notification.permission !== "granted") { if (alive) setState(Notification.permission); return; }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (alive) setState(subscription ? "enabled" : "unsubscribed");
      } catch { if (alive) setState("unsubscribed"); }
    };
    void check();
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visible);
    return () => { alive = false; window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", visible); };
  }, [personId]);

  const enable = async () => {
    if (!personId || busy || !supported()) return;
    setBusy(true); setError("");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Уведомления пока не настроены на сервере.");
      // Call directly from the click: browsers require a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission); return; }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Не удалось запустить уведомления. Обновите страницу и попробуйте снова.")), 10000); }),
      ]).finally(() => clearTimeout(timeout));
      const normalized = (key + "=".repeat((4 - key.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
      const applicationServerKey = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const response = await fetch("/api/push/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ personId, subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить подписку. Попробуйте ещё раз.");
      setState("enabled");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось включить уведомления.");
      setState(Notification.permission === "denied" ? "denied" : "unsubscribed");
    } finally { setBusy(false); }
  };

  return <section className="settings-page-row" style={{ marginTop: 16, flexWrap: "wrap" }} aria-label="Уведомления на этом устройстве">
    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
      <strong>{state === "enabled" ? "Уведомления на устройстве включены" : "Уведомления на этом устройстве"}</strong>
      <small role="status">{state === "checking" ? "Проверяем разрешение…" : state === "denied" ? "Браузер запретил уведомления." : state === "unsupported" ? "Этот браузер не поддерживает push. На iPhone откройте приложение с экрана «Домой»." : state === "enabled" ? "Ниже можно выбрать, какие события получать." : "Разрешите отправку, чтобы получать выбранные уведомления."}</small>
      {help && state === "denied" && <p style={{ fontSize: 13, lineHeight: 1.6 }}>Разрешите уведомления для сайта в настройках браузера. На iPhone проверьте настройки уведомлений установленного приложения. Затем вернитесь сюда.</p>}
      {error && <p role="alert" style={{ fontSize: 13 }}>{error}</p>}
    </div>
    {state === "denied" ? <button type="button" className="admin-secondary" aria-expanded={help} onClick={() => setHelp(!help)}>Как разрешить</button> :
      (state === "default" || state === "unsubscribed") && <button type="button" className="admin-primary" disabled={busy || !personId} onClick={() => void enable()}>{busy ? "Подключаем…" : "Включить уведомления"}</button>}
  </section>;
}
