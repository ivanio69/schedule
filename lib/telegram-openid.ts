import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import { authHmac, safeEqualHex } from "@/lib/auth-session";

const AUTHORIZATION_ENDPOINT="https://oauth.telegram.org/auth";
const TOKEN_ENDPOINT="https://oauth.telegram.org/token";
const JWKS_ENDPOINT="https://oauth.telegram.org/.well-known/jwks.json";
const ISSUER="https://oauth.telegram.org";

export const TELEGRAM_OIDC_FLOW_COOKIE="schedule_telegram_oidc";

type FlowState={
  state:string;
  verifier:string;
  nonce:string;
  next:string;
  redirectUri:string;
  exp:number;
};

export type TelegramIdClaims={
  iss:string;
  aud:string|string[];
  sub:string;
  iat:number;
  exp:number;
  nonce?:string;
  id?:number|string;
  name?:string;
  given_name?:string;
  family_name?:string;
  preferred_username?:string;
  picture?:string;
};

type TokenResponse={
  access_token?:string;
  token_type?:string;
  expires_in?:number;
  id_token?:string;
  scope?:string;
  error?:string;
  error_description?:string;
};

type Jwk={kid?:string;kty?:string;alg?:string;use?:string;[key:string]:unknown};
type Jwks={keys?:Jwk[]};

function clientId(){return process.env.TELEGRAM_OIDC_CLIENT_ID?.trim()??""}
function clientSecret(){return process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim()??""}

export function telegramOpenIdConfigured(){return Boolean(clientId()&&clientSecret())}

function safeNext(value:string|null){
  if(!value||!value.startsWith("/")||value.startsWith("//")||value.startsWith("/login"))return "/";
  return value;
}

function b64url(bytes:Buffer){return bytes.toString("base64url")}

export function createTelegramOpenIdFlow(origin:string,nextValue:string|null){
  if(!telegramOpenIdConfigured())throw new Error("Telegram OpenID не настроен");
  const state=b64url(randomBytes(24));
  const verifier=b64url(randomBytes(48));
  const nonce=b64url(randomBytes(24));
  const challenge=b64url(createHash("sha256").update(verifier).digest());
  const redirectUri=origin.replace(/\/$/,"")+"/api/auth/openid/callback";
  const next=safeNext(nextValue);
  const exp=Math.floor(Date.now()/1000)+10*60;
  const flow:FlowState={state,verifier,nonce,next,redirectUri,exp};
  const encoded=Buffer.from(JSON.stringify(flow)).toString("base64url");
  const cookie=encoded+"."+authHmac("telegram-oidc:"+encoded);
  const params=new URLSearchParams({
    client_id:clientId(),
    redirect_uri:redirectUri,
    response_type:"code",
    scope:"openid profile telegram:bot_access",
    state,
    nonce,
    code_challenge:challenge,
    code_challenge_method:"S256",
  });
  return {url:AUTHORIZATION_ENDPOINT+"?"+params.toString(),cookie};
}

export function readTelegramOpenIdFlow(cookie:string|undefined|null):FlowState|null{
  if(!cookie)return null;
  const [encoded,signature,extra]=cookie.split(".");
  if(!encoded||!signature||extra)return null;
  const expected=authHmac("telegram-oidc:"+encoded);
  if(!safeEqualHex(signature,expected))return null;
  try{
    const flow=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as FlowState;
    if(!flow.state||!flow.verifier||!flow.nonce||!flow.redirectUri||flow.exp<=Math.floor(Date.now()/1000))return null;
    return {...flow,next:safeNext(flow.next)};
  }catch{return null}
}

export async function exchangeTelegramOpenIdCode(code:string,flow:FlowState){
  const authorization=Buffer.from(clientId()+":"+clientSecret()).toString("base64");
  const response=await fetch(TOKEN_ENDPOINT,{
    method:"POST",
    headers:{
      "Content-Type":"application/x-www-form-urlencoded",
      "Authorization":"Basic "+authorization,
    },
    body:new URLSearchParams({
      grant_type:"authorization_code",
      code,
      redirect_uri:flow.redirectUri,
      client_id:clientId(),
      code_verifier:flow.verifier,
    }),
    cache:"no-store",
  });
  const data=await response.json().catch(()=>null) as TokenResponse|null;
  if(!response.ok||!data?.id_token)throw new Error(data?.error_description??data?.error??"Telegram не выдал ID token");
  return data;
}

function decodeJson<T>(part:string):T{
  return JSON.parse(Buffer.from(part,"base64url").toString("utf8")) as T;
}

export async function verifyTelegramIdToken(token:string,expectedNonce:string):Promise<TelegramIdClaims>{
  const parts=token.split(".");
  if(parts.length!==3)throw new Error("Некорректный Telegram ID token");
  const [headerPart,payloadPart,signaturePart]=parts;
  const header=decodeJson<{alg?:string;kid?:string;typ?:string}>(headerPart);
  if(header.alg!=="RS256")throw new Error("Telegram OpenID должен использовать RS256");
  if(!header.kid)throw new Error("В Telegram ID token нет kid");

  const jwksResponse=await fetch(JWKS_ENDPOINT,{cache:"no-store"});
  if(!jwksResponse.ok)throw new Error("Не удалось получить ключи Telegram");
  const jwks=await jwksResponse.json() as Jwks;
  const jwk=jwks.keys?.find(key=>key.kid===header.kid&&key.kty==="RSA");
  if(!jwk)throw new Error("Ключ Telegram для ID token не найден");

  const key=createPublicKey({key:jwk,format:"jwk"} as Parameters<typeof createPublicKey>[0]);
  const valid=verifySignature("RSA-SHA256",Buffer.from(headerPart+"."+payloadPart),key,Buffer.from(signaturePart,"base64url"));
  if(!valid)throw new Error("Подпись Telegram ID token неверна");

  const claims=decodeJson<TelegramIdClaims>(payloadPart);
  const now=Math.floor(Date.now()/1000);
  const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==ISSUER)throw new Error("Некорректный issuer Telegram");
  if(!audience.includes(clientId()))throw new Error("Telegram ID token выдан для другого приложения");
  if(!Number.isFinite(claims.exp)||claims.exp<=now)throw new Error("Telegram ID token истёк");
  if(!Number.isFinite(claims.iat)||claims.iat>now+120)throw new Error("Некорректное время Telegram ID token");
  if(!claims.sub)throw new Error("Telegram ID token не содержит sub");
  if(!claims.nonce||claims.nonce!==expectedNonce)throw new Error("Некорректный nonce Telegram");
  return claims;
}
