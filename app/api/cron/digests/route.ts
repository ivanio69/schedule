import { NextRequest, NextResponse } from "next/server";
import { runDigestDelivery } from "@/lib/digest";
import { verifyDigestSchedulerToken } from "@/lib/github-actions-oidc";
export const dynamic = "force-dynamic";
export async function GET(request:NextRequest){
  const authorization=request.headers.get("authorization");
  const token=authorization?.replace(/^Bearer\s+/i,"");
  const githubAllowed=await verifyDigestSchedulerToken(token);
  const secret=process.env.CRON_SECRET;
  const secretAllowed=Boolean(secret&&authorization===`Bearer ${secret}`);
  if(!githubAllowed&&!secretAllowed)return NextResponse.json({error:"Нет доступа"},{status:401});
  try{return NextResponse.json({ok:true,digest:await runDigestDelivery()},{headers:{"Cache-Control":"no-store"}})}
  catch(error){console.error("Digest scheduler failed",error);return NextResponse.json({error:"Не удалось отправить дайджесты"},{status:500})}
}
