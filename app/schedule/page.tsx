import TodaySchedule from "@/components/TodaySchedule";
import RehearsalPeoplePicker from "@/components/RehearsalPeoplePicker";
import IndividualScheduleOverlay from "@/components/IndividualScheduleOverlay";

export default function SchedulePage() {
  return (
    <>
      <RehearsalPeoplePicker />
      <IndividualScheduleOverlay />
      <TodaySchedule />
    </>
  );
}
