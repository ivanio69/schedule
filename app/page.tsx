import DashboardV2 from "@/components/DashboardV2";
import DashboardRehearsals from "@/components/DashboardRehearsals";
import BookedIndividualSlotsInDashboard from "@/components/BookedIndividualSlotsInDashboard";
import { ScholarshipBadge } from "@/components/ScholarshipBadge";

export default function Home() {
  return (
    <>
      <ScholarshipBadge />
      <DashboardV2 />
      <BookedIndividualSlotsInDashboard />
      <DashboardRehearsals />
    </>
  );
}
