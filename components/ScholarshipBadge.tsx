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
    <>
      <style jsx global>{`.scholarship-badge{display:flex;align-items:center;justify-content:center;gap:9px;width:min(calc(100% - 28px),980px);margin:18px auto 0;padding:12px 16px;border:1px solid #d8ff45;border-radius:14px;color:#d8ff45;background:rgba(216,255,69,.1);box-shadow:0 0 28px rgba(216,255,69,.12);font-size:12px;font-weight:800;letter-spacing:.02em}.scholarship-badge span{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;color:#09090b;background:#d8ff45;font-size:14px}.scholarship-badge strong{font-weight:800}.schedule-scholarship-wrap{margin:0 0 -4px}.schedule-scholarship-wrap .scholarship-badge{width:100%;margin:18px 0 0}@media(max-width:600px){.scholarship-badge{width:calc(100% - 20px);padding:10px 12px;font-size:11px}.schedule-scholarship-wrap .scholarship-badge{width:100%}}`}</style>
      <div className="scholarship-badge" role="status"><span>₽</span><strong>Сегодня стипендия</strong></div>
    </>
  );
}

export function ScholarshipDate({ date }: { date: Date | string }) {
  const value = parseDate(date);
  return isScholarshipDate(value) ? value : null;
}
