"use client";

import { useEffect, useState } from "react";

function isScholarshipDate(value: Date) {
  if (value.getDate() !== 14) {
    return false;
  }
  const day = value.getDay();
  return day !== 0 && day !== 6;
}

export function ScholarshipBadge({ date }: { date?: Date | string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const value = date ? new Date(typeof date === "string" ? `${date}T12:00:00` : date) : new Date();
    setVisible(isScholarshipDate(value));
  }, [date]);

  if (!visible) return null;
  return <div className="scholarship-badge" role="status"><span>₽</span><strong>Сегодня стипендия</strong></div>;
}

export function ScholarshipDate({ date }: { date: Date | string }) {
  const value = new Date(typeof date === "string" ? `${date}T12:00:00` : date);
  if (value.getDate() === 14 && value.getDay() === 6) value.setDate(13);
  if (value.getDate() === 14 && value.getDay() === 0) value.setDate(12);
  return isScholarshipDate(value) ? value : null;
}
