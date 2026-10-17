import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { dismissClientErrors, getClientErrors, recordClientError } from "@/lib/client-errors";

export const dynamic="force-dynamic";

function session(request:NextRequest){
  return verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export async function GET(request:NextRequest){
  const auth=session(request);
  if(!auth)return NextResponse.json({error:"Не авторизован"},{status:401});
  return NextResponse.json({errors:await getClientErrors(auth.personId)},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const auth=session(request);
  if(!auth)return NextResponse.json({error:"Не авторизован"},{status:401});
  const report=await recordClientError(auth.personId,await request.json().catch(()=>null));
  if(!report)return NextResponse.json({error:"Некорректная ошибка"},{status:400});
  return NextResponse.json({ok:true,id:report.id},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:NextRequest){
  const auth=session(request);
  if(!auth)return NextResponse.json({error:"Не авторизован"},{status:401});
  return NextResponse.json({ok:true,dismissed:await dismissClientErrors(auth.personId)},{headers:{"Cache-Control":"no-store"}});
}
