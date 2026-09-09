import ScheduleApp from "@/components/ScheduleApp";
import RehearsalPeoplePicker from "@/components/RehearsalPeoplePicker";

export default function SchedulePage() {
  return <>
    <nav className="quick-app-nav" aria-label="Основные разделы">
      <a href="/">Дашборд</a>
      <a className="is-active" href="/schedule">Полное расписание</a>
    </nav>
    <RehearsalPeoplePicker />
    <ScheduleApp />
  </>;
}
