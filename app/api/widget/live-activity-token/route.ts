import { NextResponse } from "next/server";
import { readBearerToken, resolveWidgetToken } from "@/lib/widget-auth";
import { registerLiveActivityToken, unregisterLiveActivityTokens } from "@/lib/live-activity-push";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function POST(request:Request){
  const widgetToken=await resolveWidgetToken(readBearerToken(request));
  if(!widgetToken)return NextResponse.json({error:"Недействительный токен виджета"},{status:401});
  try{
    const result=await registerLiveActivityToken(widgetToken.personId,widgetToken.id,await request.json());
    if(!result)return NextResponse.json({error:"Некорректный ActivityKit token"},{status:400});
    return NextResponse.json({ok:true,kind:result.kind},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Failed to register Live Activity token",error);
    return NextResponse.json({error:"Не удалось зарегистрировать Live Activity"},{status:500});
  }
}

export async function DELETE(request:Request){
  const widgetToken=await resolveWidgetToken(readBearerToken(request));
  if(!widgetToken)return NextResponse.json({error:"Недействительный токен виджета"},{status:401});
  const revoked=await unregisterLiveActivityTokens(widgetToken.id);
  return NextResponse.json({ok:true,revoked},{headers:{"Cache-Control":"no-store"}});
}
