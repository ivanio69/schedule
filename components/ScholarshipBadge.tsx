"use client";

import { useEffect, useState } from "react";

function parseDate(date?: Date | string) {
  return date ? new Date(typeof date === "string" ? `${date}T12:00:00` : date) : new Date();
}

function payoutDate(year: number, month: number) {
  const value = new Date(year, month, 14);
  if (value.getDay() === 6) value.setDate(13);
  if (value.getDay() === 0) value.setDate(12);
  return value;
}

function isScholarshipDate(value: Date) {
  const payout = payoutDate(value.getFullYear(), value.getMonth());
  return value.getFullYear() === payout.getFullYear() && value.getMonth() === payout.getMonth() && value.getDate() === payout.getDate();
}

export function ScholarshipBadge({ date }: { date?: Date | string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => setVisible(isScholarshipDate(parseDate(date))), [date]);

  if (!visible) return null;

  return (
    <div
      className="scholarship-badge"
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "min(calc(100% - 20px), 980px)",
        margin: "18px auto 0",
        padding: "13px 18px",
        border: "2px solid #d8ff45",
        borderRadius: 16,
        color: "#09090b",
        background: "#d8ff45",
        boxShadow: "0 0 0 1px rgba(216,255,69,.35), 0 0 32px rgba(216,255,69,.35)",
        fontSize: 13,
        fontWeight: 850,
        letterSpacing: ".01em",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: 28,
          height: 28,
          flex: "0 0 28px",
          borderRadius: 9,
          color: "#d8ff45",
          background: "#09090b",
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        ₽
      </span>
      <strong>Сегодня стипендия</strong>
    </div>
  );
}

export function ScholarshipDate({ date }: { date: Date | string }) {
  const value = parseDate(date);
  return isScholarshipDate(value) ? value : null;
}
