"use client";

import type { ReactNode } from "react";
import AdminSidebarNavigation from "@/components/AdminSidebarNavigation";
import "./admin-system.css";
import "./admin-navigation.css";
import "./rehearsals/rehearsals.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-layout">
    <AdminSidebarNavigation />
    <div className="admin-layout-main">{children}</div>
  </div>;
}
