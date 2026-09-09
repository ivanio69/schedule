import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./admin/admin-polish.css";
import "./admin/admin-lists.css";
import "./schedule-modal.css";
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
        {children}
      </body>
    </html>
  );
}
