"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/admin") return;

    const addRehearsalsItem = () => {
      const nav = document.querySelector<HTMLElement>(".admin-modebar");
      if (!nav || nav.querySelector("[data-admin-rehearsals-nav]")) return Boolean(nav);

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.adminRehearsalsNav = "true";
      button.innerHTML = `<span>07</span>Репетиции`;
      button.addEventListener("click", () => { window.location.href = "/admin/rehearsals"; });
      nav.appendChild(button);
      return true;
    };

    if (addRehearsalsItem()) return;
    const observer = new MutationObserver(() => {
      if (addRehearsalsItem()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return <>{children}</>;
}
