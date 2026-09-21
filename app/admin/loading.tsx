import LoadingState from "@/components/LoadingState";

export default function AdminLoading() {
  return <LoadingState screen className="admin-loading-screen" label="Загружаем админку" detail="Подготавливаем панель управления." />;
}
