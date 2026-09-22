import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "@/lib/auth-session";
import { createTelegramOpenIdFlow, TELEGRAM_OIDC_FLOW_COOKIE, telegramOpenIdConfigured } from "@/lib/telegram-openid";

export const dynamic="force-dynamic";

function loginError(request:NextRequest,code:string){
  const url=new URL("/login",request.url);
  url.searchParams.set("openid_error",code);
  return NextResponse.redirect(url);
}

export async function GET(request:NextRequest){
  if(!telegramOpenIdConfigured())return loginError(request,"not_configured");
  try{
    const url=new URL(request.url);
    const flow=createTelegramOpenIdFlow(url.origin,url.searchParams.get("next"));
    const response=NextResponse.redirect(flow.url);
    response.cookies.set(TELEGRAM_OIDC_FLOW_COOKIE,flow.cookie,{...authCookieOptions(10*60),sameSite:"lax"});
    return response;
  }catch(error){
    console.error("Failed to start Telegram OpenID",error);
    return loginError(request,"start_failed");
  }
}
