import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./admin/admin-polish.css";
import "./admin/admin-lists.css";
import "./schedule-modal.css";
import "./dashboard-login.css";
import AppNavigation from "@/components/AppNavigation";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Расписание 214Р",
  description: "Расписание занятий группы 214Р",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={geist.variable} data-theme="dark">
      <body>
        <AppNavigation />
        <div className="app-page-transition">{children}</div>
        <style jsx global>{`
          .app-page-transition {
            animation: app-page-enter .28s cubic-bezier(.22,1,.36,1) both;
            will-change: opacity, transform;
          }

          @keyframes app-page-enter {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @media (prefers-reduced-motion: reduce) {
            .app-page-transition { animation: none; }
          }

          @view-transition {
            navigation: auto;
          }

          ::view-transition-old(root) {
            animation: app-page-out .16s ease both;
          }

          ::view-transition-new(root) {
            animation: app-page-in .28s cubic-bezier(.22,1,.36,1) both;
          }

          @keyframes app-page-out {
            to { opacity: 0; transform: translateY(-5px); }
          }

          @keyframes app-page-in {
            from { opacity: 0; transform: translateY(8px); }
          }

          @media (prefers-reduced-motion: reduce) {
            ::view-transition-old(root),
            ::view-transition-new(root) {
              animation: none !important;
            }
          }
        `}</style>
      </body>
    </html>
  );
}
