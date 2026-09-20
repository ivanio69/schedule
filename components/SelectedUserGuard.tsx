"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const PERSON_KEY = "schedule_person_id";

const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("schedule-auth-change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("schedule-auth-change", notify);
  };
};

const getSnapshot = () => Boolean(localStorage.getItem(PERSON_KEY));
const getServerSnapshot = () => false;

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/admin");
}

export default function SelectedUserGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasSelectedUser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (!publicPath && !hasSelectedUser) {
      router.replace("/");
    }
  }, [hasSelectedUser, pathname, publicPath, router]);

  if (!publicPath && !hasSelectedUser) return null;
  return children;
}
