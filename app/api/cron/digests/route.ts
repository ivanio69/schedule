import { NextRequest, NextResponse } from "next/server";
import { runDigestDelivery } from "@/lib/digest";

export const dynamic = "force-dynamic";
const SCHEDULE = "*/15 * * * *";
function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(secret)return request.headers.get("authorization")===`Bearer ${secret}`;
  return process.env.VERCEL_ENV==="production"&&request.headers.get("x-vercel-cron-schedule")===SCHEDULE;
}
export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:"Нет доступа"},{status:401});
  try{return NextResponse.json({ok:true,digest:await runDigestDelivery()},{headers:{"Cache-Control":"no-store"}})}
  catch(error){console.error("Digest cron failed",error);return NextResponse.json({error:"Не удалось отправить дайджесты"},{status:500})}
}
