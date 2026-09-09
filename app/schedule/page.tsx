import ScheduleApp from "@/components/ScheduleApp";
import RehearsalPeoplePicker from "@/components/RehearsalPeoplePicker";
import AllRehearsalsButton from "@/components/AllRehearsalsButton";

export default function SchedulePage() {
  return (
    <>
      <div className="rehearsals-toolbar">
        <AllRehearsalsButton />
      </div>
      <RehearsalPeoplePicker />
      <ScheduleApp />
    </>
  );
}
