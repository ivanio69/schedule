import DashboardV2 from "@/components/DashboardV2";
import DashboardRehearsals from "@/components/DashboardRehearsals";
import IndividualSlots from "@/components/IndividualSlots";

export default function Home() {
  return (
    <>
      <DashboardV2 />
      <DashboardRehearsals />
      <IndividualSlots />
    </>
  );
}
