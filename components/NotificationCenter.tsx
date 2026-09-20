"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { APP_CHANGELOG, APP_VERSION } from "@/lib/app-version";

const READ_KEY_PREFIX = "schedule_changelog_read_versions";

function readStoredVersions(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

export default function NotificationCenter({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [readVersions, setReadVersions] = useState<string[]>([]);
  const storageKey = `${READ_KEY_PREFIX}:${personId}`;

  useEffect(() => {
    if (!personId) return;
    const stored = readStoredVersions(storageKey);
    const initial = stored ?? APP_CHANGELOG.slice(1).map(entry => entry.version);
    setReadVersions(initial);
    if (!stored) localStorage.setItem(storageKey, JSON.stringify(initial));
    setReady(true);
  }, [personId, storageKey]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCenter();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const readSet = useMemo(() => new Set(readVersions), [readVersions]);
  const unreadCount = ready ? APP_CHANGELOG.filter(entry => !readSet.has(entry.version)).length : 0;

  const markAllRead = () => {
    const next = APP_CHANGELOG.map(entry => entry.version);
    setReadVersions(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const closeCenter = () => {
    markAllRead();
    setOpen(false);
  };

  return <>
    <button
      type="button"
      className="notification-center-trigger"
      aria-label={unreadCount ? `Уведомления: ${unreadCount} новых` : "Уведомления"}
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
        <path d="M10 21h4"/>
      </svg>
      {unreadCount > 0 && <b>{unreadCount > 9 ? "9+" : unreadCount}</b>}
    </button>

    {open && typeof document !== "undefined" && createPortal(
      <div className="notification-center-overlay" onMouseDown={closeCenter}>
        <section className="notification-center-panel" role="dialog" aria-modal="true" aria-labelledby="notification-center-title" onMouseDown={event => event.stopPropagation()}>
          <header>
            <div>
              <span>ЦЕНТР УВЕДОМЛЕНИЙ</span>
              <h2 id="notification-center-title">Что нового</h2>
              <p>Версия v{APP_VERSION}</p>
            </div>
            <button type="button" onClick={closeCenter} aria-label="Закрыть">×</button>
          </header>
          <div className="notification-center-list">
            {APP_CHANGELOG.map((entry, index) => {
              const unread = !readSet.has(entry.version);
              return <article key={entry.version} className={unread ? "is-unread" : ""}>
                <div className="notification-center-version">
                  <span>v{entry.version}</span>
                  <small>{entry.date}</small>
                  {unread && <b>НОВОЕ</b>}
                </div>
                <h3>{entry.title}</h3>
                <ul>{entry.items.map(item => <li key={item}>{item}</li>)}</ul>
                {index === 0 && APP_VERSION.includes(".dev") && <em>Предрелизная сборка</em>}
              </article>;
            })}
          </div>
          <footer><button type="button" onClick={closeCenter}>Готово</button></footer>
        </section>
      </div>,
      document.body
    )}

    <style jsx global>{`
      .notification-center-trigger{position:relative;display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border:1px solid var(--border);border-radius:14px;color:var(--muted-strong);background:var(--surface);cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
      .notification-center-trigger:hover{background:var(--surface-hover);border-color:var(--border-strong);transform:translateY(-1px)}
      .notification-center-trigger svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .notification-center-trigger b{position:absolute;top:-5px;right:-5px;display:grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border:2px solid var(--surface);border-radius:999px;color:var(--accent-text);background:var(--accent);font-size:9px;line-height:1}
      .notification-center-overlay{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;width:100vw;height:100dvh;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));overflow:hidden;background:rgba(0,0,0,.78);backdrop-filter:blur(12px);overscroll-behavior:contain;isolation:isolate}
      .notification-center-panel{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(100%,620px);max-height:min(760px,calc(100dvh - 40px));min-height:0;overflow:hidden;border:1px solid var(--border);border-radius:24px;color:var(--text);background:var(--surface);box-shadow:0 30px 100px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.025)}
      .notification-center-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;min-width:0;padding:22px 22px 18px;border-bottom:1px solid var(--border);background:var(--surface)}
      .notification-center-panel>header span{color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.12em}
      .notification-center-panel>header h2{margin:7px 0 5px;font-size:26px;letter-spacing:-.035em}
      .notification-center-panel>header p{margin:0;color:var(--muted);font-size:11px;line-height:1.5}
      .notification-center-panel>header>button{display:grid;place-items:center;flex:0 0 auto;width:36px;height:36px;margin:-4px -6px 0 0;border:0;border-radius:10px;background:transparent;color:var(--muted);font-size:27px;line-height:1;cursor:pointer}
      .notification-center-list{min-height:0;overflow-x:hidden;overflow-y:auto;padding:12px;overscroll-behavior:contain;scrollbar-gutter:stable}
      .notification-center-list article{position:relative;padding:17px;border:1px solid var(--border);border-radius:16px;background:var(--surface-raised)}
      .notification-center-list article+article{margin-top:8px}
      .notification-center-list article.is-unread{border-color:#51515b;background:linear-gradient(135deg,rgba(255,255,255,.08),#131316)}
      .notification-center-version{display:flex;align-items:center;gap:8px}
      .notification-center-version>span{font-size:11px;font-weight:800}
      .notification-center-version small{color:var(--muted);font-size:9px}
      .notification-center-version b{margin-left:auto;border-radius:999px;padding:4px 7px;color:var(--accent-text);background:var(--accent);font-size:8px;letter-spacing:.08em}
      .notification-center-list h3{margin:10px 0 8px;font-size:16px}
      .notification-center-list ul{display:grid;gap:6px;margin:0;padding-left:17px;color:var(--muted-strong);font-size:11px;line-height:1.5}
      .notification-center-list em{display:inline-block;margin-top:12px;color:var(--muted);font-size:9px;font-style:normal;text-transform:uppercase;letter-spacing:.09em}
      .notification-center-panel>footer{display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--border);background:var(--surface)}
      .notification-center-panel>footer button{border:0;border-radius:10px;padding:9px 15px;color:var(--accent-text);background:var(--accent);font-size:11px;font-weight:800;cursor:pointer}
      .monday-green .notification-center-trigger{border-color:rgba(57,255,136,.38);color:var(--monday);background:rgba(5,25,13,.82)}
      .monday-green .notification-center-trigger b{border-color:#07170d;color:#07170d;background:var(--monday)}
      @media(max-width:640px){
        .notification-center-overlay{place-items:end center;padding:max(10px,env(safe-area-inset-top)) 0 0}
        .notification-center-panel{width:100%;max-height:calc(100dvh - max(10px,env(safe-area-inset-top)));border-left:0;border-right:0;border-bottom:0;border-radius:24px 24px 0 0}
        .notification-center-panel>header{padding:20px 18px 16px}
        .notification-center-list{padding:10px 10px 14px}
        .notification-center-panel>footer{padding:12px 14px calc(12px + env(safe-area-inset-bottom))}
        .notification-center-panel>footer button{width:100%;min-height:44px}
      }
    `}</style>
  </>;
}
