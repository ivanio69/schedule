import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";

export type ClientErrorSource = "web" | "ios" | "webview" | "widget" | "activitykit";

export type ClientErrorReport = {
  id: string;
  personId: string;
  source: ClientErrorSource;
  code: string;
  message: string;
  detail?: string;
  path?: string;
  version?: string;
  fingerprint: string;
  count: number;
  createdAt: string;
  lastSeenAt: string;
  dismissedAt?: string;
};

const SOURCES = new Set<ClientErrorSource>(["web","ios","webview","widget","activitykit"]);
const clean = (value:unknown,max:number) => typeof value==="string" ? value.trim().slice(0,max) : "";
const fingerprint=(personId:string,source:string,code:string,message:string)=>
  createHash("sha256").update([personId,source,code,message].join("|")).digest("hex");

export async function recordClientError(personId:string,input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const body=input as Record<string,unknown>;
  const rawSource=clean(body.source,32) as ClientErrorSource;
  const source=SOURCES.has(rawSource)?rawSource:"web";
  const code=clean(body.code,120)||"unknown";
  const message=clean(body.message,700);
  if(!message)return null;
  const detail=clean(body.detail,2200)||undefined;
  const path=clean(body.path,300)||undefined;
  const version=clean(body.version,80)||undefined;
  const now=new Date();
  const nowIso=now.toISOString();
  const fp=fingerprint(personId,source,code,message);
  const db=await getDatabase();
  const collection=db.collection<ClientErrorReport>("client_error_reports");
  const recentAfter=new Date(now.getTime()-15*60*1000).toISOString();
  const existing=await collection.findOne({
    personId,
    fingerprint:fp,
    dismissedAt:{$exists:false},
    lastSeenAt:{$gte:recentAfter},
  });
  if(existing){
    await collection.updateOne(
      {_id:existing._id},
      {$set:{lastSeenAt:nowIso,detail,path,version},$inc:{count:1}},
    );
    return{...existing,lastSeenAt:nowIso,detail,path,version,count:(existing.count??1)+1};
  }
  const report:ClientErrorReport={
    id:randomUUID(),personId,source,code,message,detail,path,version,
    fingerprint:fp,count:1,createdAt:nowIso,lastSeenAt:nowIso,
  };
  await collection.insertOne(report);
  if(Math.random()<0.08){
    const cutoff=new Date(now.getTime()-30*24*60*60*1000).toISOString();
    await collection.deleteMany({lastSeenAt:{$lt:cutoff}});
  }
  return report;
}

export async function getClientErrors(personId:string,limit=6){
  const db=await getDatabase();
  return db.collection<ClientErrorReport>("client_error_reports")
    .find({personId,dismissedAt:{$exists:false}},{projection:{_id:0,fingerprint:0}})
    .sort({lastSeenAt:-1})
    .limit(Math.max(1,Math.min(20,limit)))
    .toArray();
}

export async function dismissClientErrors(personId:string){
  const db=await getDatabase();
  const result=await db.collection<ClientErrorReport>("client_error_reports").updateMany(
    {personId,dismissedAt:{$exists:false}},
    {$set:{dismissedAt:new Date().toISOString()}},
  );
  return result.modifiedCount;
}
