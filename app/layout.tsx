import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./admin/admin-polish.css";
import "./admin/admin-lists.css";
import "./schedule-modal.css";
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
import AppNavigation from "@/components/AppNavigation";
import OfflineBanner from "@/components/OfflineBanner";
import PushPrompt from "@/components/PushPrompt";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
export const metadata: Metadata = {
  title: "Расписание 214Р",
  description: "Расписание занятий группы 214Р",
  manifest: "/manifest.webmanifest",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={geist.variable} data-theme="dark"><body><OfflineBanner /><PushPrompt /><AppNavigation /><div className="app-page-transition">{children}</div></body></html>;
}
