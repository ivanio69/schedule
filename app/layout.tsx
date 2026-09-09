import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Расписание 214Р",
  description: "Расписание занятий группы 214Р",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Расписание 214Р",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={geist.variable} data-theme="dark">
      <body><PWARegister />{children}</body>
    </html>
  );
}
