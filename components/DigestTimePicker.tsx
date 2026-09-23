"use client";

type DigestTimePickerProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
};

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parts(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: match[1], minute: match[2] } : { hour: "08", minute: "00" };
}

export default function DigestTimePicker({ value, label, onChange }: DigestTimePickerProps) {
  const current = parts(value);
  return (
    <div className="settings-digest-time-picker" role="group" aria-label={label}>
      <select
        value={current.hour}
        aria-label={`${label}: часы`}
        onChange={(event) => onChange(`${event.target.value}:${current.minute}`)}
      >
        {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select
        value={current.minute}
        aria-label={`${label}: минуты`}
        onChange={(event) => onChange(`${current.hour}:${event.target.value}`)}
      >
        {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
    </div>
  );
}
