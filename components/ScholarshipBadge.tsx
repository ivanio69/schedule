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
  return <div className="scholarship-badge" role="status"><span>₽</span><strong>Сегодня стипендия</strong></div>;
}

export function ScholarshipDate({ date }: { date: Date | string }) {
  const value = parseDate(date);
  return isScholarshipDate(value) ? value : null;
}
