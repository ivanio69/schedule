import { sleep } from "workflow";
import type { DigestPlan } from "@/lib/digest";

export async function digestDeliveryWorkflow(plan:DigestPlan){
  "use workflow";
  const waitSeconds=Math.max(0,Math.ceil((plan.runAt-Date.now())/1000));
  if(waitSeconds>0)await sleep(waitSeconds);
  return deliverDigestStep(plan);
}

async function deliverDigestStep(plan:DigestPlan){
  "use step";
  const { deliverDigestPlan }=await import("@/lib/digest");
  return deliverDigestPlan(plan);
}
