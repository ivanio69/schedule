import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, AUTH_COOKIE, PROFILE_COOKIE, adminCookieToken, authCookieOptions, createAuthSessionToken } from "@/lib/auth-session";
import { getDatabase, getPeople } from "@/lib/database";
import { normalizePersonRole, type Person } from "@/lib/people";
import { exchangeTelegramOpenIdCode, readTelegramOpenIdFlow, TELEGRAM_OIDC_FLOW_COOKIE, verifyTelegramIdToken } from "@/lib/telegram-openid";

export const dynamic="force-dynamic";

function clearFlow(response:NextResponse){
  response.cookies.set(TELEGRAM_OIDC_FLOW_COOKIE,"",{...authCookieOptions(0),sameSite:"lax"});
  return response;
}
function fail(request:NextRequest,code:string,next="/"){
  const url=new URL("/login",request.url);
  url.searchParams.set("openid_error",code);
  url.searchParams.set("next",next);
  return clearFlow(NextResponse.redirect(url));
}

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const flow=readTelegramOpenIdFlow(request.cookies.get(TELEGRAM_OIDC_FLOW_COOKIE)?.value);
  if(!flow)return fail(request,"flow_expired");
  if(url.searchParams.get("error"))return fail(request,"telegram_denied",flow.next);
  const state=url.searchParams.get("state")??"";
  const code=url.searchParams.get("code")??"";
  if(!code||state!==flow.state)return fail(request,"invalid_state",flow.next);

  try{
    const tokens=await exchangeTelegramOpenIdCode(code,flow);
    const claims=await verifyTelegramIdToken(tokens.id_token!,flow.nonce);
    const people=await getPeople(false);
    const active=people.filter(person=>person.active);
    const bySub=active.find(person=>person.telegramOidcSub===claims.sub);

    let person:Person|undefined=bySub;
    if(!person){
      const username=claims.preferred_username?.trim().replace(/^@/,"").toLowerCase()??"";
      if(!username)return fail(request,"no_username",flow.next);
      const matches=active.filter(item=>(item.telegramUsername??"").toLowerCase()===username);
      if(matches.length!==1)return fail(request,matches.length?"ambiguous_profile":"profile_not_found",flow.next);
      person=matches[0];
      if(person.telegramOidcSub&&person.telegramOidcSub!==claims.sub)return fail(request,"profile_linked_elsewhere",flow.next);
      await (await getDatabase()).collection<Person>("people").updateOne(
        {id:person.id},
        {$set:{telegramOidcSub:claims.sub,telegramUserId:String(claims.id??claims.sub),telegramLinkedAt:new Date().toISOString()}},
      );
    }

    const botAccess=Boolean(tokens.scope?.split(/\s+/).includes("telegram:bot_access"));
    const telegramId=claims.id===undefined||claims.id===null?"":String(claims.id);
    const username=claims.preferred_username?.trim().replace(/^@/,"")??"";
    const identityUpdate:Record<string,string>={telegramOidcSub:claims.sub};
    if(telegramId)identityUpdate.telegramUserId=telegramId;
    if(username)identityUpdate.telegramUsername=username;
    if(botAccess&&telegramId){
      identityUpdate.telegramChatId=telegramId;
      identityUpdate.telegramLinkedAt=new Date().toISOString();
    }
    await (await getDatabase()).collection<Person>("people").updateOne({id:person.id},{$set:identityUpdate});

    const role=normalizePersonRole(person.role,person.adminLink);
    const success=new URL("/login",request.url);
    success.searchParams.set("openid","success");
    success.searchParams.set("next",flow.next);
    const response=clearFlow(NextResponse.redirect(success));
    response.cookies.set(AUTH_COOKIE,createAuthSessionToken(person.id,role),authCookieOptions());
    response.cookies.set(PROFILE_COOKIE,person.id,authCookieOptions());
    const adminToken=adminCookieToken();
    if(role==="admin"&&adminToken)response.cookies.set(ADMIN_COOKIE,adminToken,authCookieOptions(60*60*24));
    else response.cookies.set(ADMIN_COOKIE,"",authCookieOptions(0));
    return response;
  }catch(error){
    console.error("Telegram OpenID callback failed",error);
    return fail(request,"token_failed",flow.next);
  }
}
