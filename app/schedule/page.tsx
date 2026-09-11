import TodaySchedule from "@/components/TodaySchedule";
import RehearsalPeoplePicker from "@/components/RehearsalPeoplePicker";
import IndividualScheduleOverlay from "@/components/IndividualScheduleOverlay";
import ScheduleScholarshipBadge from "@/components/ScheduleScholarshipBadge";

export default function SchedulePage() {
  return (
    <>
      <RehearsalPeoplePicker />
      <IndividualScheduleOverlay />
      <ScheduleScholarshipBadge />
      <TodaySchedule />
    </>
  );
}
