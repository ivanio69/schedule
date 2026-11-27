import "../admin/admin-polish.css";
import "../admin/admin-lists.css";
import "../admin-workspace.css";
import HeadmanAccessGate from "@/components/HeadmanAccessGate";
import HeadmanPanel from "@/components/HeadmanPanel";

export default function HeadmanPage() {
  return <HeadmanAccessGate><HeadmanPanel /></HeadmanAccessGate>;
}
