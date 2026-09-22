import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { buildDigestPlans, claimDigestPlan } from "@/lib/digest";
import { digestDeliveryWorkflow } from "@/workflows/digest-delivery";

export const dynamic = "force-dynamic";
const SCHEDULE = "5 0 * * *";

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(secret)return request.headers.get("authorization")===`Bearer ${secret}`;
  return process.env.VERCEL_ENV==="production"&&request.headers.get("x-vercel-cron-schedule")===SCHEDULE;
}

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:"Нет доступа"},{status:401});
  try{
    const plans=await buildDigestPlans();
    let scheduled=0,duplicates=0;
    const runs:string[]=[];
    for(const plan of plans){
      if(!await claimDigestPlan(plan)){duplicates++;continue}
      const run=await start(digestDeliveryWorkflow,[plan]);
      scheduled++;runs.push(run.runId);
    }
    return NextResponse.json({ok:true,planned:plans.length,scheduled,duplicates,runs:runs.slice(0,20)},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Digest scheduler failed",error);
    return NextResponse.json({error:"Не удалось запланировать дайджесты"},{status:500});
  }
}
