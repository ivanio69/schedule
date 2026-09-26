import { createHash, createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";
import { getDatabase } from "@/lib/database";
import { buildWidgetFeed, type WidgetEvent } from "@/lib/widget-feed";

type APNSEnvironment = "sandbox" | "production";

type PushToStartTokenDoc = {
  tokenHash: string;
  token: string;
  personId: string;
  widgetTokenId: string;
  environment: APNSEnvironment;
  timeZone: string;
  osMajor: number;
  createdAt: string;
  updatedAt: string;
};

type ActivityUpdateTokenDoc = {
  tokenHash: string;
  token: string;
  personId: string;
  widgetTokenId: string;
  environment: APNSEnvironment;
  activityId: string;
  eventId: string;
  endTimestamp: number;
  createdAt: string;
  updatedAt: string;
};

type RegisterInput = {
  kind: "push-to-start" | "activity";
  token: string;
  environment: APNSEnvironment;
  timeZone: string;
  osMajor: number;
  activityId?: string;
  eventId?: string;
  endTimestamp?: number;
};

const TOKEN_PATTERN=/^[a-f0-9]{32,1024}$/i;
const TIME_ZONE_PATTERN=/^[A-Za-z0-9_+\-/]{1,80}$/;
const START_GRACE_MS=6*60*1000;
const END_GRACE_SECONDS=30*60;

function hash(value:string){return createHash("sha256").update(value).digest("hex")}

function cleanInput(value:unknown):RegisterInput|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const body=value as Record<string,unknown>;
  const kind=body.kind;
  const token=typeof body.token==="string"?body.token.toLowerCase():"";
  const environment=body.environment;
  const timeZone=typeof body.timeZone==="string"?body.timeZone:"";
  const osMajor=Number(body.osMajor);
  if((kind!=="push-to-start"&&kind!=="activity")||!TOKEN_PATTERN.test(token))return null;
  if(environment!=="sandbox"&&environment!=="production")return null;
  if(!TIME_ZONE_PATTERN.test(timeZone)||!Number.isInteger(osMajor)||osMajor<17||osMajor>99)return null;
  if(kind==="activity"){
    if(typeof body.activityId!=="string"||!body.activityId||body.activityId.length>200)return null;
    if(typeof body.eventId!=="string"||!body.eventId||body.eventId.length>800)return null;
    const endTimestamp=Number(body.endTimestamp);
    if(!Number.isFinite(endTimestamp)||endTimestamp<=0)return null;
    return{kind,token,environment,timeZone,osMajor,activityId:body.activityId,eventId:body.eventId,endTimestamp};
  }
  return{kind,token,environment,timeZone,osMajor};
}

export async function registerLiveActivityToken(personId:string,widgetTokenId:string,input:unknown){
  const cleaned=cleanInput(input);
  if(!cleaned)return null;
  const db=await getDatabase();
  const now=new Date().toISOString();
  const tokenHash=hash(cleaned.token);

  if(cleaned.kind==="push-to-start"){
    await db.collection<PushToStartTokenDoc>("live_activity_push_tokens").deleteMany({
      widgetTokenId,
      tokenHash:{$ne:tokenHash},
    });
    await db.collection<PushToStartTokenDoc>("live_activity_push_tokens").updateOne(
      {widgetTokenId,tokenHash},
      {$set:{
        tokenHash,
        token:cleaned.token,
        personId,
        widgetTokenId,
        environment:cleaned.environment,
        timeZone:cleaned.timeZone,
        osMajor:cleaned.osMajor,
        updatedAt:now,
      },$setOnInsert:{createdAt:now}},
      {upsert:true},
    );
    return{kind:cleaned.kind};
  }

  await db.collection<ActivityUpdateTokenDoc>("live_activity_update_tokens").updateOne(
    {widgetTokenId,activityId:cleaned.activityId!},
    {$set:{
      tokenHash,
      token:cleaned.token,
      personId,
      widgetTokenId,
      environment:cleaned.environment,
      activityId:cleaned.activityId!,
      eventId:cleaned.eventId!,
      endTimestamp:cleaned.endTimestamp!,
      updatedAt:now,
    },$setOnInsert:{createdAt:now}},
    {upsert:true},
  );
  return{kind:cleaned.kind};
}

export async function unregisterLiveActivityTokens(widgetTokenId:string){
  const db=await getDatabase();
  const [start,update]=await Promise.all([
    db.collection("live_activity_push_tokens").deleteMany({widgetTokenId}),
    db.collection("live_activity_update_tokens").deleteMany({widgetTokenId}),
  ]);
  return start.deletedCount+update.deletedCount;
}

type APNSConfig={teamId:string;keyId:string;privateKey:string;bundleId:string};

function apnsConfig():APNSConfig|null{
  const teamId=process.env.APNS_TEAM_ID?.trim();
  const keyId=process.env.APNS_KEY_ID?.trim();
  const rawKey=process.env.APNS_PRIVATE_KEY?.trim();
  const bundleId=(process.env.APNS_BUNDLE_ID?.trim()||"com.schedule214.app");
  if(!teamId||!keyId||!rawKey||!bundleId)return null;
  return{teamId,keyId,privateKey:rawKey.replace(/\\n/g,"\n"),bundleId};
}

let cachedProviderToken:{value:string;expiresAt:number;fingerprint:string}|null=null;
const b64url=(value:Buffer|string)=>Buffer.from(value).toString("base64url");

function providerToken(config:APNSConfig){
  const fingerprint=hash(config.teamId+"\n"+config.keyId+"\n"+config.privateKey);
  if(cachedProviderToken&&cachedProviderToken.expiresAt>Date.now()&&cachedProviderToken.fingerprint===fingerprint)return cachedProviderToken.value;
  const issuedAt=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"ES256",kid:config.keyId}));
  const payload=b64url(JSON.stringify({iss:config.teamId,iat:issuedAt}));
  const unsigned=header+"."+payload;
  const signature=sign("sha256",Buffer.from(unsigned),{
    key:createPrivateKey(config.privateKey),
    dsaEncoding:"ieee-p1363",
  });
  const value=unsigned+"."+signature.toString("base64url");
  cachedProviderToken={value,expiresAt:Date.now()+50*60*1000,fingerprint};
  return value;
}

type APNSResult={ok:boolean;status:number;reason?:string;retryable:boolean};

async function sendAPNS(token:string,environment:APNSEnvironment,payload:unknown,config:APNSConfig):Promise<APNSResult>{
  const host=environment==="sandbox"?"api.sandbox.push.apple.com":"api.push.apple.com";
  const jwt=providerToken(config);
  const body=JSON.stringify(payload);

  return new Promise((resolve)=>{
    const client=connect("https://"+host);
    let settled=false;
    const finish=(result:APNSResult)=>{
      if(settled)return;
      settled=true;
      try{client.close()}catch{}
      resolve(result);
    };

    client.on("error",()=>finish({ok:false,status:0,reason:"connection_error",retryable:true}));
    const request=client.request({
      ":method":"POST",
      ":path":"/3/device/"+token,
      "authorization":"bearer "+jwt,
      "apns-push-type":"liveactivity",
      "apns-topic":config.bundleId+".push-type.liveactivity",
      "apns-priority":"10",
    });

    let status=0;
    let response="";
    request.setEncoding("utf8");
    request.on("response",(headers)=>{status=Number(headers[":status"]??0)});
    request.on("data",(chunk)=>{response+=chunk});
    request.on("error",()=>finish({ok:false,status,reason:"request_error",retryable:true}));
    request.on("end",()=>{
      let reason:string|undefined;
      try{reason=(JSON.parse(response) as {reason?:string}).reason}catch{}
      finish({
        ok:status===200,
        status,
        reason,
        retryable:status===0||status===429||status>=500,
      });
    });
    request.end(body);
  });
}

function localParts(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone,
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",
    hourCycle:"h23",
  }).formatToParts(date);
  const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??"";
  return{
    date:`${get("year")}-${get("month")}-${get("day")}`,
    hour:Number(get("hour")),
    minute:Number(get("minute")),
    second:Number(get("second")),
  };
}

function zonedDateToUTC(date:string,time:string,timeZone:string){
  const [year,month,day]=date.split("-").map(Number);
  const [hour,minute]=time.split(":").map(Number);
  const desired=Date.UTC(year,month-1,day,hour,minute,0);
  let guess=desired;
  for(let i=0;i<3;i++){
    const local=localParts(new Date(guess),timeZone);
    const [ly,lm,ld]=local.date.split("-").map(Number);
    const represented=Date.UTC(ly,lm-1,ld,local.hour,local.minute,local.second);
    guess+=desired-represented;
  }
  return new Date(guess);
}

function startPayload(event:WidgetEvent,date:string,timeZone:string,osMajor:number,now:Date){
  const start=zonedDateToUTC(date,event.start,timeZone);
  const end=zonedDateToUTC(date,event.end,timeZone);
  const aps:Record<string,unknown>={
    timestamp:Math.floor(now.getTime()/1000),
    event:"start",
    "content-state":{revision:1},
    "attributes-type":"ScheduleActivityAttributes",
    attributes:{
      eventId:event.id,
      title:event.title,
      subtitle:event.subtitle,
      kind:event.kind,
      startTimestamp:start.getTime()/1000,
      endTimestamp:end.getTime()/1000,
    },
    alert:{
      title:event.kind==="rehearsal"?"Репетиция началась":"Пара началась",
      body:event.title,
    },
    "stale-date":Math.floor(end.getTime()/1000),
  };
  if(osMajor>=18)aps["input-push-token"]=1;
  return{aps,start,end};
}

function endPayload(now:Date){
  return{aps:{
    timestamp:Math.floor(now.getTime()/1000),
    event:"end",
    "content-state":{revision:2},
    "dismissal-date":Math.floor(now.getTime()/1000),
  }};
}

function invalidToken(result:APNSResult){
  return result.status===410||["BadDeviceToken","DeviceTokenNotForTopic","Unregistered"].includes(result.reason??"");
}

export async function runLiveActivityDelivery(now=new Date()){
  const config=apnsConfig();
  if(!config)return{configured:false,starts:{checked:0,due:0,sent:0,failed:0},ends:{checked:0,due:0,sent:0,failed:0},at:now.toISOString()};

  const db=await getDatabase();
  const [startTokens,endTokens]=await Promise.all([
    db.collection<PushToStartTokenDoc>("live_activity_push_tokens").find({}).toArray(),
    db.collection<ActivityUpdateTokenDoc>("live_activity_update_tokens").find({}).toArray(),
  ]);

  const feedCache=new Map<string,Awaited<ReturnType<typeof buildWidgetFeed>>>();
  let startDue=0,startSent=0,startFailed=0;

  for(const device of startTokens){
    let clock;
    try{clock=localParts(now,device.timeZone)}catch{
      await db.collection("live_activity_push_tokens").deleteOne({tokenHash:device.tokenHash});
      continue;
    }
    const cacheKey=device.personId+":"+clock.date;
    let feed=feedCache.get(cacheKey);
    if(feed===undefined){
      feed=await buildWidgetFeed(device.personId,clock.date);
      feedCache.set(cacheKey,feed);
    }
    if(!feed)continue;

    for(const event of feed.events){
      if(event.status==="cancelled"||(event.kind!=="lesson"&&event.kind!=="rehearsal"))continue;
      const built=startPayload(event,clock.date,device.timeZone,device.osMajor,now);
      const age=now.getTime()-built.start.getTime();
      if(age<0||age>START_GRACE_MS)continue;
      if(built.end<=now)continue;
      startDue++;

      const key=`start:${device.tokenHash}:${clock.date}:${hash(event.id)}`;
      const claim=await db.collection("live_activity_deliveries").updateOne(
        {key},
        {$setOnInsert:{key,personId:device.personId,eventId:event.id,kind:"start",createdAt:now.toISOString(),status:"pending"}},
        {upsert:true},
      );
      if(claim.upsertedCount!==1)continue;

      const result=await sendAPNS(device.token,device.environment,built.aps,config);
      if(result.ok){
        startSent++;
        await db.collection("live_activity_deliveries").updateOne({key},{$set:{status:"sent",sentAt:new Date().toISOString()}});
      }else{
        startFailed++;
        await db.collection("live_activity_deliveries").updateOne({key},{$set:{status:"failed",httpStatus:result.status,reason:result.reason??null,updatedAt:new Date().toISOString()}});
        if(invalidToken(result))await db.collection("live_activity_push_tokens").deleteOne({tokenHash:device.tokenHash});
        else if(result.retryable)await db.collection("live_activity_deliveries").deleteOne({key});
      }
    }
  }

  let endDue=0,endSent=0,endFailed=0;
  const nowSeconds=now.getTime()/1000;
  for(const activity of endTokens){
    if(activity.endTimestamp>nowSeconds||nowSeconds-activity.endTimestamp>END_GRACE_SECONDS)continue;
    endDue++;
    const key=`end:${activity.tokenHash}:${activity.activityId}`;
    const claim=await db.collection("live_activity_deliveries").updateOne(
      {key},
      {$setOnInsert:{key,personId:activity.personId,eventId:activity.eventId,activityId:activity.activityId,kind:"end",createdAt:now.toISOString(),status:"pending"}},
      {upsert:true},
    );
    if(claim.upsertedCount!==1)continue;

    const result=await sendAPNS(activity.token,activity.environment,endPayload(now),config);
    if(result.ok){
      endSent++;
      await Promise.all([
        db.collection("live_activity_deliveries").updateOne({key},{$set:{status:"sent",sentAt:new Date().toISOString()}}),
        db.collection("live_activity_update_tokens").deleteOne({widgetTokenId:activity.widgetTokenId,activityId:activity.activityId}),
      ]);
    }else{
      endFailed++;
      await db.collection("live_activity_deliveries").updateOne({key},{$set:{status:"failed",httpStatus:result.status,reason:result.reason??null,updatedAt:new Date().toISOString()}});
      if(invalidToken(result))await db.collection("live_activity_update_tokens").deleteOne({widgetTokenId:activity.widgetTokenId,activityId:activity.activityId});
      else if(result.retryable)await db.collection("live_activity_deliveries").deleteOne({key});
    }
  }

  return{
    configured:true,
    starts:{checked:startTokens.length,due:startDue,sent:startSent,failed:startFailed},
    ends:{checked:endTokens.length,due:endDue,sent:endSent,failed:endFailed},
    at:now.toISOString(),
  };
}
