import { NextRequest, NextResponse } from "next/server";
import versionInfo from "@/version.json";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";

const ENV_COOKIE = "schedule_environment";
const DEV_HOST_COOKIE = "schedule_dev_host";

function isAllowedPreviewHost(host: string | undefined) {
  return Boolean(host&&host.startsWith("schedule-git-")&&host.endsWith("-ivanio.vercel.app")&&!host.includes("/")&&!host.includes(":"));
}
function clearDevCookies(response: NextResponse) {
  response.cookies.set(ENV_COOKIE,"",{path:"/",maxAge:0,sameSite:"lax"});
  response.cookies.set(DEV_HOST_COOKIE,"",{path:"/",maxAge:0,sameSite:"lax"});
  response.cookies.set("schedule_dev_pr","",{path:"/",maxAge:0,sameSite:"lax"});
  response.cookies.set("schedule_dev_version","",{path:"/",maxAge:0,sameSite:"lax"});
  return response;
}
function staticPath(pathname:string){
  return pathname.startsWith("/_next/")||pathname==="/sw.js"||pathname==="/manifest.webmanifest"||pathname==="/favicon.ico"||pathname==="/apple-touch-icon.png"||pathname.startsWith("/icons/");
}
function publicApi(request:NextRequest){
  const pathname=request.nextUrl.pathname;
  if(pathname.startsWith("/api/auth/")||pathname==="/api/telegram/webhook"||pathname.startsWith("/api/environment")||pathname.startsWith("/api/build-version"))return true;
  if(pathname==="/api/calendar/apple"&&Boolean(request.nextUrl.searchParams.get("token")))return true;
  return false;
}
function unauthorized(request:NextRequest){
  if(request.nextUrl.pathname.startsWith("/api/"))return NextResponse.json({error:"Требуется вход через Telegram"},{status:401});
  const login=request.nextUrl.clone();login.pathname="/login";login.search="";login.searchParams.set("next",request.nextUrl.pathname+request.nextUrl.search);
  return NextResponse.redirect(login);
}
function forbidden(request:NextRequest){
  if(request.nextUrl.pathname.startsWith("/api/"))return NextResponse.json({error:"Нет доступа"},{status:403});
  const home=request.nextUrl.clone();home.pathname="/";home.search="";
  return NextResponse.redirect(home);
}

export function proxy(request: NextRequest) {
  const {pathname,search}=request.nextUrl;
  if(staticPath(pathname))return NextResponse.next();

  const isLogin=pathname==="/login";
  const isPublicApi=publicApi(request);
  const session=verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);

  if(!session&&!isLogin&&!isPublicApi)return unauthorized(request);
  if(session&&isLogin){const home=request.nextUrl.clone();home.pathname="/";home.search="";return NextResponse.redirect(home)}
  if(session&&(pathname.startsWith("/admin")||pathname.startsWith("/api/admin"))&&session.role!=="admin")return forbidden(request);
  if(session&&(pathname.startsWith("/headman")||pathname.startsWith("/api/headman"))&&session.role!=="headman"&&session.role!=="admin")return forbidden(request);

  // Preview deployments render directly. Production remains the same-origin
  // gateway for the selected DEV environment after authentication.
  if(process.env.VERCEL_ENV!=="production")return NextResponse.next();
  if(pathname.startsWith("/api/environment")||pathname==="/api/telegram/webhook"||staticPath(pathname))return NextResponse.next();
  if(request.cookies.get(ENV_COOKIE)?.value!=="dev")return NextResponse.next();

  const devPr=Number(request.cookies.get("schedule_dev_pr")?.value??"");
  const host=request.cookies.get(DEV_HOST_COOKIE)?.value;
  if(!isAllowedPreviewHost(host)||!Number.isFinite(devPr)||devPr<=versionInfo.pr)return clearDevCookies(NextResponse.next());

  const target=new URL(pathname+search,"https://"+host);
  const response=NextResponse.rewrite(target);
  response.headers.set("x-schedule-environment","dev");
  return response;
}

export const config={matcher:"/:path*"};
