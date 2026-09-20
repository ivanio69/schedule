import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./admin/admin-polish.css";
import "./admin/admin-lists.css";
import "./schedule-modal.css";
import "./rehearsal-editor.css";
import "./dashboard-login.css";
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
import AppNavigation from "@/components/AppNavigation";
import OfflineBanner from "@/components/OfflineBanner";
import DevEnvironmentBanner from "@/components/DevEnvironmentBanner";
import PushPrompt from "@/components/PushPrompt";
import AmbientBackground from "@/components/AmbientBackground";
import AppearanceProvider from "@/components/AppearanceProvider";
import SelectedUserGuard from "@/components/SelectedUserGuard";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
const environmentTransferBootScript = `(()=>{try{const hash=location.hash.startsWith("#")?location.hash.slice(1):"";if(!hash)return;const params=new URLSearchParams(hash);const profile=params.get("schedule-profile");const appearance=params.get("schedule-appearance");let changed=false;if(profile&&profile.length<160){localStorage.setItem("schedule_person_id",profile);changed=true}if(appearance&&appearance.length<4000){JSON.parse(appearance);localStorage.setItem("schedule_appearance",appearance);changed=true}if(changed)history.replaceState(history.state,"",location.pathname+location.search)}catch{}})();`;
const appearanceBootScript = `(()=>{try{const root=document.documentElement;const raw=localStorage.getItem("schedule_appearance");if(!raw)return;const value=JSON.parse(raw);const accents=["default","mint","blue","violet","amber","rose"];root.dataset.theme=value.theme==="light"?"light":"dark";root.dataset.accent=accents.includes(value.appAccent)?value.appAccent:"default";root.dataset.rehearsalAccent=accents.includes(value.rehearsalAccent)?value.rehearsalAccent:"default";root.dataset.individualAccent=accents.includes(value.individualAccent)?value.individualAccent:"default";root.dataset.seminarAccent=accents.includes(value.seminarAccent)?value.seminarAccent:"default"}catch{}})();`;

export const metadata: Metadata = {
  title: "Расписание 214Р",
  description: "Расписание занятий группы 214Р",
  manifest: "/manifest.webmanifest",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={geist.variable} data-theme="dark" data-accent="default" data-rehearsal-accent="default" data-individual-accent="default" data-seminar-accent="default" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: environmentTransferBootScript }} /><script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} /></head><body><AmbientBackground /><AppearanceProvider /><OfflineBanner /><DevEnvironmentBanner /><SelectedUserGuard><PushPrompt /><AppNavigation /><div className="app-page-transition">{children}</div></SelectedUserGuard><Analytics /></body></html>;
}
