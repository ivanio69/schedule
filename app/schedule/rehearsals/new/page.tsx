import RehearsalScheduleEditor from "@/components/RehearsalScheduleEditor";

export default async function NewScheduledRehearsalPage({ searchParams }: { searchParams: Promise<{ date?: string; edit?: string }> }) {
  const params = await searchParams;
  return <RehearsalScheduleEditor initialDate={params.date ?? ""} editId={params.edit ?? ""} />;
}
