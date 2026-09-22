import HeadmanAccessGate from "@/components/HeadmanAccessGate";
import HeadmanPanel from "@/components/HeadmanPanel";

export default function HeadmanPage() {
  return <HeadmanAccessGate><HeadmanPanel /></HeadmanAccessGate>;
}
