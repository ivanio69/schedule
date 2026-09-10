"use client";

import { useEffect } from "react";

export default function AdminIndividualsPage() {
  useEffect(() => {
    window.location.replace("/admin/individual-slots");
  }, []);

  return (
    <main className="admin-shell" style={{ paddingTop: 48 }}>
      <p className="admin-muted">Открываю новую систему индивидуальных слотов…</p>
    </main>
  );
}
