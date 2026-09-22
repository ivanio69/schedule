import { getDatabase, getIndividualLessons, getPeople, getProfileSettings, getRehearsals, getSchedule, type ProfileSettings } from "@/lib/database";
import { getOccurrences, lessonMatchesChinaMode, type GroupPreference, type ScheduleData } from "@/lib/schedule";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import { normalizeDigestSettings } from "@/lib/digest-settings";
import { sendPush } from "@/lib/push";
import type { Person } from "@/lib/people";

export type DigestMode = "morning" | "evening";
export type DigestPlan = {
  key: string;
  personId: string;
  mode: DigestMode;
  localDate: string;
  scheduledTime: string;
  timeZone: string;
  runAt: number;
};

type DigestEvent = { start:string;title:string;kind:"lesson"|"individual"|"rehearsal";cancelled?:boolean };

export function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const value = (type:string) => parts.find(part=>part.type===type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}

const addDay=(date:string)=>{
  const value=new Date(date+"T00:00:00Z");
  value.setUTCDate(value.getUTCDate()+1);
  return value.toISOString().slice(0,10);
};
const short=(value:string,max=230)=>value.length<=max?value:value.slice(0,max-1).trimEnd()+"…";

function localPartsAsUtc(epoch:number,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(epoch));
  const n=(type:string)=>Number(parts.find(part=>part.type===type)?.value??0);
  return Date.UTC(n("year"),n("month")-1,n("day"),n("hour"),n("minute"),n("second"));
}

export function zonedTimeToEpoch(date:string,time:string,timeZone:string){
  const intended=Date.parse(`${date}T${time}:00Z`);
  let guess=intended;
  for(let index=0;index<4;index++){
    const represented=localPartsAsUtc(guess,timeZone);
    guess+=intended-represented;
  }
  return guess;
}

function visibleLessons(schedule:ScheduleData,date:string,settings:ProfileSettings){
  return getOccurrences(schedule,date).filter(lesson=>{
    if(!lessonMatchesChinaMode(lesson,settings.chinaMode===true))return false;
    if(settings.chinaMode===true)return true;
    const preference=(settings.preferences?.[lesson.class]??"both") as GroupPreference;
    return preference==="both"||!lesson.group.length||lesson.group.includes(Number(preference));
  });
}

async function eventsFor(person:Person,date:string,schedule:ScheduleData,settings:ProfileSettings):Promise<DigestEvent[]>{
  const [individuals,rehearsals]=await Promise.all([getIndividualLessons(person.id,date),getRehearsals(date)]);
  const lessons=visibleLessons(schedule,date,settings).map<DigestEvent>(lesson=>({
    start:lesson.timeStart,
    title:lesson.occurrence?.status==="cancelled"?"Отменена: "+lesson.class:lesson.class,
    kind:"lesson",
    cancelled:lesson.occurrence?.status==="cancelled",
  }));
  const ownIndividuals=individuals.map<DigestEvent>(lesson=>({
    start:lesson.timeStart,
    title:lesson.subject||"Индивидуальное",
    kind:"individual",
  }));
  const ownRehearsals=rehearsals
    .filter(item=>item.isGlobal||item.creatorId===person.id||getRehearsalAudienceNames(item).includes(person.name))
    .map<DigestEvent>(item=>({start:item.timeStart,title:item.subject||"Репетиция",kind:"rehearsal"}));
  return [...lessons,...ownIndividuals,...ownRehearsals].sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,"ru"));
}

function payload(mode:DigestMode,date:string,events:DigestEvent[]){
  const dayLabel=mode==="morning"?"Сегодня":"Завтра";
  const dateLabel=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
  if(!events.length)return{title:`${dayLabel} · ${dateLabel}`,body:`${dayLabel} нет пар, индивидуальных занятий и репетиций.`,url:"/"};
  const preview=events.slice(0,4).map(item=>`${item.start} ${item.title}`).join(" · ");
  const more=events.length>4?` · ещё ${events.length-4}`:"";
  return{title:`${dayLabel} · ${events.length} событий`,body:short(preview+more),url:"/"};
}

export async function buildDigestPlans(now=new Date()):Promise<DigestPlan[]>{
  const db=await getDatabase();
  const [people,profileDocs]=await Promise.all([
    getPeople(true),
    db.collection<ProfileSettings>("profile_settings").find({}).toArray(),
  ]);
  const profiles=new Map(profileDocs.map(item=>[item.personId,item]));
  const plans:DigestPlan[]=[];
  for(const person of people){
    const settings=normalizeDigestSettings(profiles.get(person.id)?.digestSettings);
    const clock=localClock(now,settings.timeZone);
    for(const mode of ["morning","evening"] as DigestMode[]){
      const enabled=mode==="morning"?settings.morningEnabled:settings.eveningEnabled;
      const scheduledTime=mode==="morning"?settings.morningTime:settings.eveningTime;
      if(!enabled)continue;
      let localDate=clock.date;
      let runAt=zonedTimeToEpoch(localDate,scheduledTime,settings.timeZone);
      if(runAt<=now.getTime()+60_000){
        localDate=addDay(localDate);
        runAt=zonedTimeToEpoch(localDate,scheduledTime,settings.timeZone);
      }
      plans.push({
        key:`${person.id}:${mode}:${localDate}:${scheduledTime}`,
        personId:person.id,
        mode,
        localDate,
        scheduledTime,
        timeZone:settings.timeZone,
        runAt,
      });
    }
  }
  return plans;
}

export async function claimDigestPlan(plan:DigestPlan){
  const result=await (await getDatabase()).collection("digest_schedules").updateOne(
    {key:plan.key},
    {$setOnInsert:{...plan,status:"scheduled",createdAt:new Date().toISOString()}},
    {upsert:true},
  );
  return result.upsertedCount===1;
}

export async function deliverDigestPlan(plan:DigestPlan){
  const [people,profile,schedule]=await Promise.all([
    getPeople(true),
    getProfileSettings(plan.personId),
    getSchedule(),
  ]);
  const person=people.find(item=>item.id===plan.personId);
  if(!person)return{status:"inactive" as const};
  const current=normalizeDigestSettings(profile.digestSettings);
  const enabled=plan.mode==="morning"?current.morningEnabled:current.eveningEnabled;
  const currentTime=plan.mode==="morning"?current.morningTime:current.eveningTime;
  if(!enabled||currentTime!==plan.scheduledTime||current.timeZone!==plan.timeZone)return{status:"stale" as const};
  const targetDate=plan.mode==="morning"?plan.localDate:addDay(plan.localDate);
  const db=await getDatabase();
  const deliveryKey=`${plan.personId}:${plan.mode}:${plan.localDate}`;
  const claim=await db.collection("digest_deliveries").updateOne(
    {key:deliveryKey},
    {$setOnInsert:{key:deliveryKey,personId:plan.personId,mode:plan.mode,localDate:plan.localDate,timeZone:plan.timeZone,createdAt:new Date().toISOString(),status:"pending"}},
    {upsert:true},
  );
  if(claim.upsertedCount!==1)return{status:"duplicate" as const};
  try{
    const events=await eventsFor(person,targetDate,schedule,profile);
    const delivery=await sendPush([person.id],null,payload(plan.mode,targetDate,events));
    const status=delivery.sent>0?"sent":delivery.subscriptions===0?"no_devices":"failed";
    await db.collection("digest_deliveries").updateOne({key:deliveryKey},{$set:{status,sent:delivery.sent,failed:delivery.failed,subscriptions:delivery.subscriptions,targetDate,updatedAt:new Date().toISOString()}});
    await db.collection("digest_schedules").updateOne({key:plan.key},{$set:{status,completedAt:new Date().toISOString()}});
    return{status,delivery,targetDate,events:events.length};
  }catch(error){
    await Promise.all([
      db.collection("digest_deliveries").updateOne({key:deliveryKey},{$set:{status:"failed",updatedAt:new Date().toISOString()}}),
      db.collection("digest_schedules").updateOne({key:plan.key},{$set:{status:"failed",completedAt:new Date().toISOString()}}),
    ]);
    throw error;
  }
}
