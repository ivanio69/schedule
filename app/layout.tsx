import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./daily-quotes.css";
import "./admin/admin-polish.css";
import "./admin/admin-lists.css";
import "./schedule-modal.css";
import "./rehearsal-editor.css";
import "./page-transitions.css";
import "./loading-state.css";
import "./micro-interactions.css";
import "./admin/individual-slots/slots.css";
import "./individual-slots.css";
import "./day-tabs-polish.css";
import "./page-headings.css";
import "./scholarship-badge.css";
import "./offline-banner.css";
import "./seminars.css";
import "./push-notifications.css";
import "./design-system.css";
import "./admin-workspace.css";
import "./client-polish.css";
import "./appearance.css";
import "./announcements.css";
import AppNavigation from "@/components/AppNavigation";
import OfflineBanner from "@/components/OfflineBanner";
import DevEnvironmentBanner from "@/components/DevEnvironmentBanner";
import PushPrompt from "@/components/PushPrompt";
import AmbientBackground from "@/components/AmbientBackground";
import AppearanceProvider from "@/components/AppearanceProvider";
import SelectedUserGuard from "@/components/SelectedUserGuard";
import AppPageTransition from "@/components/AppPageTransition";
import VersionUpdateNotice from "@/components/VersionUpdateNotice";
import UsageAnalyticsTracker from "@/components/UsageAnalyticsTracker";
import ProfileSessionSync from "@/components/ProfileSessionSync";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
const environmentTransferBootScript = `(()=>{try{const hash=location.hash.startsWith("#")?location.hash.slice(1):"";if(!hash)return;const params=new URLSearchParams(hash);const appearance=params.get("schedule-appearance");if(appearance&&appearance.length<4000){JSON.parse(appearance);localStorage.setItem("schedule_appearance",appearance);history.replaceState(history.state,"",location.pathname+location.search)}}catch{}})();`;
const appearanceBootScript = `(()=>{try{const root=document.documentElement;const raw=localStorage.getItem("schedule_appearance");if(!raw)return;const value=JSON.parse(raw);const accents=["default","mint","blue","violet","amber","rose"];const hour=new Date().getHours();const timed=hour<6?"violet":hour<11?"amber":hour<18?"blue":"rose";const automatic=value.appAccentMode==="time";root.dataset.theme=value.theme==="light"?"light":"dark";root.dataset.accentMode=automatic?"time":"manual";root.dataset.accent=automatic?timed:accents.includes(value.appAccent)?value.appAccent:"default";root.dataset.rehearsalAccent=accents.includes(value.rehearsalAccent)?value.rehearsalAccent:"default";root.dataset.individualAccent=accents.includes(value.individualAccent)?value.individualAccent:"default";root.dataset.seminarAccent=accents.includes(value.seminarAccent)?value.seminarAccent:"default";const themeMeta=document.querySelector(\'meta[name="theme-color"]\');if(themeMeta)themeMeta.setAttribute("content",value.theme==="light"?"#f5f5f6":"#09090b")}catch{}})();`;

export const metadata: Metadata = {
  applicationName: "Расписание 214Р",
  title: "Расписание 214Р",
  description: "Расписание занятий группы 214Р",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "214Р",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#09090b" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={geist.variable} data-theme="dark" data-accent-mode="manual" data-accent="default" data-rehearsal-accent="default" data-individual-accent="default" data-seminar-accent="default" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: environmentTransferBootScript }} /><script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} /></head><body><ProfileSessionSync /><AmbientBackground /><AppearanceProvider /><OfflineBanner /><DevEnvironmentBanner /><VersionUpdateNotice /><SelectedUserGuard><UsageAnalyticsTracker /><PushPrompt /><AppNavigation /><AppPageTransition>{children}</AppPageTransition></SelectedUserGuard><Analytics /></body></html>;
}
