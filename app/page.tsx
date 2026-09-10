import DashboardV2 from "@/components/DashboardV2";
import DashboardRehearsals from "@/components/DashboardRehearsals";
import BookedIndividualSlotsInDashboard from "@/components/BookedIndividualSlotsInDashboard";

export default function Home() {
  return (
    <>
      <DashboardV2 />
      <BookedIndividualSlotsInDashboard />
      <DashboardRehearsals />
    </>
  );
}
