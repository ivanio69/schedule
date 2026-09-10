import type { IndividualSlot } from "@/lib/individual-slots";

type Props = { slot: IndividualSlot; onClick?: () => void };

export function BookedIndividualSlotCard({ slot, onClick }: Props) {
  return <button type="button" className="schedule-card booked-individual-slot-card" onClick={onClick}>
    <div className="schedule-card__time"><strong>{slot.timeStart}</strong><span>{slot.timeEnd}</span></div>
    <div className="schedule-card__body">
      <div className="schedule-card__title-row"><h3>{slot.subject}</h3><span className="booked-individual-slot-badge">ИНДИВ.</span></div>
      <p>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</p>
      {slot.note && <small>{slot.note}</small>}
    </div>
  </button>;
}
