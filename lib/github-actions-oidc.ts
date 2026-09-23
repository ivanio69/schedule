import { createPublicKey, verify } from "node:crypto";

const ISSUER="https://token.actions.githubusercontent.com";
const JWKS_URL="https://token.actions.githubusercontent.com/.well-known/jwks";
const AUDIENCE="schedule-digests";
type Claims={iss?:string;aud?:string|string[];exp?:number;nbf?:number;repository?:string;ref?:string;event_name?:string};
let cached:{expiresAt:number;keys:Array<Record<string,unknown>>}|null=null;
const decode=(value:string)=>Buffer.from(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"="),"base64");
const parse=(value:string)=>JSON.parse(decode(value).toString("utf8")) as Record<string,unknown>;
async function keys(){
  if(cached&&cached.expiresAt>Date.now())return cached.keys;
  const response=await fetch(JWKS_URL,{cache:"no-store"});
  if(!response.ok)throw new Error("GitHub OIDC JWKS unavailable");
  const body=await response.json() as {keys?:Array<Record<string,unknown>>};
  if(!Array.isArray(body.keys))throw new Error("Invalid GitHub OIDC JWKS");
  cached={keys:body.keys,expiresAt:Date.now()+3_600_000};
  return body.keys;
}
export async function verifyDigestSchedulerToken(token:string|undefined|null){
  if(!token)return false;
  const parts=token.split(".");
  if(parts.length!==3)return false;
  try{
    const header=parse(parts[0]) as {alg?:unknown;kid?:unknown};
    const claims=parse(parts[1]) as Claims;
    if(header.alg!=="RS256"||typeof header.kid!=="string")return false;
    const jwk=(await keys()).find(item=>item.kid===header.kid);
    if(!jwk)return false;
    const key=createPublicKey({key:jwk as JsonWebKey,format:"jwk"});
    const valid=verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),key,decode(parts[2]));
    if(!valid)return false;
    const now=Math.floor(Date.now()/1000);
    if(claims.iss!==ISSUER||typeof claims.exp!=="number"||claims.exp<now||(typeof claims.nbf==="number"&&claims.nbf>now+30))return false;
    const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(!audiences.includes(AUDIENCE))return false;
    if(claims.repository!=="ivanio69/schedule"||claims.ref!=="refs/heads/main")return false;
    return claims.event_name==="schedule"||claims.event_name==="workflow_dispatch";
  }catch{return false}
}
