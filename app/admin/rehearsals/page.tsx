import { redirect } from "next/navigation";

export default function RehearsalsPage() {
  redirect("/admin?tab=rehearsals");
}
