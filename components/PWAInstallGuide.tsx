"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "desktop";
}

export default function PWAInstallGuide() {
  const pathname = usePathname();
  const [installed, setInstalled] = useState(true);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setPlatform(detectPlatform());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (pathname !== "/" || installed) return null;

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  const isManual = platform === "ios" || !installPrompt;

  return (
    <aside className="pwa-guide" aria-label="Установка приложения">
      <style>{`
        .pwa-guide{position:fixed;z-index:90;right:18px;bottom:18px;width:min(440px,calc(100vw - 36px));padding:20px;border:1px solid var(--border);border-radius:22px;background:linear-gradient(145deg,#17171b,#0f0f12);box-shadow:0 20px 70px rgba(0,0,0,.55);backdrop-filter:blur(18px)}
        .pwa-guide__top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .pwa-guide__eyebrow{display:block;margin-bottom:6px;color:#b8a7ff;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        .pwa-guide h2{margin:0;font-size:20px;line-height:1.15;letter-spacing:-.025em}
        .pwa-guide__top p{margin:7px 0 0;color:var(--muted);font-size:11px;line-height:1.45}
        .pwa-guide__app-icon{display:grid;place-items:center;flex:0 0 auto;width:48px;height:48px;border:1px solid rgba(184,167,255,.4);border-radius:14px;color:#fff;background:rgba(184,167,255,.12);font-size:11px;font-weight:800}
        .pwa-guide__install{width:100%;margin-top:15px;padding:10px 13px;border:1px solid #f2f2f2;border-radius:11px;color:#111114;background:#f2f2f2;cursor:pointer;font-size:12px;font-weight:800}
        .pwa-guide__steps{display:grid;gap:9px;margin-top:15px}
        .pwa-step{display:grid;grid-template-columns:92px 1fr;align-items:center;gap:11px;min-width:0}
        .pwa-step>div:last-child{display:grid;gap:3px}
        .pwa-step strong{font-size:11px;line-height:1.3}
        .pwa-step>div:last-child span{color:var(--muted);font-size:10px;line-height:1.4}
        .pwa-step__picture{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;height:58px;padding:7px;border:1px solid var(--border);border-radius:12px;color:var(--muted);background:#0b0b0d;font-size:9px;text-align:center}
        .pwa-step__picture--ios{flex-direction:column;gap:3px}
        .pwa-step__picture--ios b{color:var(--text);font-size:9px}
        .pwa-step__picture--ios i{position:absolute;right:8px;bottom:6px;color:#fff;font-size:17px;font-style:normal}
        .pwa-step__picture--android{justify-content:space-between;padding:9px 12px}
        .pwa-step__picture--android b{color:var(--text);font-size:20px;line-height:1}
        .pwa-step__picture--android span{font-size:8px}
        .pwa-step__picture--phone{width:42px;height:58px;margin:auto;flex-direction:column;gap:2px;border-radius:9px;border-color:#3b3b42}
        .pwa-step__picture--phone b{color:var(--text);font-size:8px}
        .pwa-step__picture--phone span{font-size:7px}
        .pwa-step__picture--desktop{justify-content:space-between;padding:8px 10px}
        .pwa-step__picture--desktop b{color:var(--text);font-size:8px}
        .pwa-step__picture--desktop span{padding:4px 6px;border:1px solid var(--border);border-radius:6px;color:var(--text);background:var(--surface);font-size:8px}
        @media(max-width:600px){.pwa-guide{right:10px;bottom:10px;width:calc(100vw - 20px);padding:17px;border-radius:18px}.pwa-guide h2{font-size:18px}.pwa-step{grid-template-columns:82px 1fr}.pwa-step__picture{height:54px}.pwa-step>div:last-child span{font-size:9px}}
      `}</style>

      <div className="pwa-guide__top">
        <div>
          <span className="pwa-guide__eyebrow">Приложение</span>
          <h2>Установите расписание</h2>
          <p>Оно откроется отдельно от браузера и будет удобнее на телефоне.</p>
        </div>
        <div className="pwa-guide__app-icon" aria-hidden="true">214</div>
      </div>

      {!isManual && (
        <button type="button" className="pwa-guide__install" onClick={() => void install()}>
          Установить приложение
        </button>
      )}

      <div className="pwa-guide__steps">
        {platform === "ios" ? (
          <>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--ios"><span>□</span><b>Поделиться</b><i>↑</i></div>
              <div><strong>1. Нажмите «Поделиться»</strong><span>Внизу окна Safari нажмите кнопку со стрелкой вверх.</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--ios"><span>＋</span><b>На экран «Домой»</b></div>
              <div><strong>2. Выберите «На экран “Домой”»</strong><span>Прокрутите меню, если пункт не виден сразу.</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--phone"><b>214</b><span>Расписание</span></div>
              <div><strong>3. Нажмите «Добавить»</strong><span>После этого откройте расписание с домашнего экрана.</span></div>
            </div>
          </>
        ) : platform === "android" ? (
          <>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--android"><b>⋮</b><span>Меню</span></div>
              <div><strong>1. Откройте меню браузера</strong><span>Нажмите «⋮» в правом верхнем углу Chrome.</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--android"><b>＋</b><span>Установить приложение</span></div>
              <div><strong>2. Выберите установку</strong><span>Нажмите «Установить приложение» или «Добавить на главный экран».</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--phone"><b>214</b><span>Расписание</span></div>
              <div><strong>3. Запустите с главного экрана</strong><span>После установки появится отдельная иконка расписания.</span></div>
            </div>
          </>
        ) : (
          <>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--desktop"><span>＋</span><b>Установить</b></div>
              <div><strong>1. Нажмите значок установки</strong><span>Обычно он находится справа от адресной строки.</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--desktop"><b>Расписание 214Р</b><span>Установить</span></div>
              <div><strong>2. Подтвердите установку</strong><span>В Chrome или Edge выберите «Установить».</span></div>
            </div>
            <div className="pwa-step">
              <div className="pwa-step__picture pwa-step__picture--desktop"><b>214Р</b><span>Приложение</span></div>
              <div><strong>3. Открывайте как приложение</strong><span>После установки расписание появится среди приложений.</span></div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
