import RehearsalScheduleEditor from "@/components/RehearsalScheduleEditor";

export default async function NewAdminScheduledRehearsalPage({ searchParams }: { searchParams: Promise<{ date?: string; edit?: string }> }) {
  const params = await searchParams;
  return <RehearsalScheduleEditor admin initialDate={params.date ?? ""} editId={params.edit ?? ""} />;
}
