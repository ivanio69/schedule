import ScheduleApp from "@/components/ScheduleApp";
import RehearsalPeoplePicker from "@/components/RehearsalPeoplePicker";
import AllRehearsalsButton from "@/components/AllRehearsalsButton";

export default function SchedulePage() {
  return <>
    <style>{`.quick-app-nav{position:sticky;top:12px;z-index:20;display:grid;grid-template-columns:1fr 1.5fr;gap:4px;width:min(calc(100% - 32px),520px);margin:12px auto -18px;padding:4px;border:1px solid #27272c;border-radius:14px;background:rgba(17,17,20,.88);backdrop-filter:blur(14px);box-shadow:0 12px 35px rgba(0,0,0,.22)}.quick-app-nav a{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:10px;color:#94949d;text-decoration:none;font-size:12px;font-weight:750;transition:.18s ease}.quick-app-nav a:hover{color:#f5f5f5;background:#18181c}.quick-app-nav a.is-active{color:#111114;background:#f2f2f2}.rehearsals-toolbar{width:min(calc(100% - 32px),980px);margin:30px auto -18px;display:flex;justify-content:flex-end}@media(max-width:600px){.quick-app-nav{width:min(calc(100% - 20px),520px);top:8px;margin-bottom:-8px}.quick-app-nav a{min-height:42px}.rehearsals-toolbar{width:min(calc(100% - 20px),980px);margin-top:24px}}`}</style>
    <nav className="quick-app-nav" aria-label="Основные разделы">
      <a href="/">Дашборд</a>
      <a className="is-active" href="/schedule">Полное расписание</a>
    </nav>
    <div className="rehearsals-toolbar">
      <AllRehearsalsButton />
    </div>
    <RehearsalPeoplePicker />
    <ScheduleApp />
  </>;
}
