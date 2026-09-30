import { NextResponse } from "next/server";
import { recordClientError } from "@/lib/client-errors";
import { readBearerToken, resolveWidgetToken } from "@/lib/widget-auth";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  const token=await resolveWidgetToken(readBearerToken(request));
  if(!token)return NextResponse.json({error:"Недействительный токен виджета"},{status:401});
  const report=await recordClientError(token.personId,await request.json().catch(()=>null));
  if(!report)return NextResponse.json({error:"Некорректная ошибка"},{status:400});
  return NextResponse.json({ok:true,id:report.id},{headers:{"Cache-Control":"no-store"}});
}
