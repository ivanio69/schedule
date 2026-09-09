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
