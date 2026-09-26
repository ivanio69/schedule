import { NextRequest, NextResponse } from "next/server";
import { runLiveActivityDelivery } from "@/lib/live-activity-push";
import { verifyLiveActivitySchedulerToken } from "@/lib/github-actions-oidc";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:NextRequest){
  const authorization=request.headers.get("authorization");
  const token=authorization?.replace(/^Bearer\s+/i,"");
  const githubAllowed=await verifyLiveActivitySchedulerToken(token);
  const secret=process.env.CRON_SECRET;
  const secretAllowed=Boolean(secret&&authorization===`Bearer ${secret}`);
  if(!githubAllowed&&!secretAllowed)return NextResponse.json({error:"Нет доступа"},{status:401});

  try{
    return NextResponse.json({ok:true,liveActivities:await runLiveActivityDelivery()},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Live Activity scheduler failed",error);
    return NextResponse.json({error:"Не удалось обработать Live Activities"},{status:500});
  }
}
