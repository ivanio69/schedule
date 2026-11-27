"use client";

import type { ReactNode } from "react";
import AdminSidebarNavigation from "@/components/AdminSidebarNavigation";
import AdminAccessGate from "@/components/AdminAccessGate";
import "./admin-polish.css";
import "./admin-lists.css";
import "./individual-slots/slots.css";
import "../admin-workspace.css";
import "./admin-system.css";
import "./admin-navigation.css";
import "./admin-analytics.css";
import "./rehearsals/rehearsals.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessGate><div className="admin-layout">
    <AdminSidebarNavigation />
    <div className="admin-layout-main">{children}</div>
  </div></AdminAccessGate>;
}
