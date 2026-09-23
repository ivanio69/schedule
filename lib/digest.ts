import { getDatabase, getIndividualLessons, getPeople, getRehearsals, getSchedule, type ProfileSettings } from "@/lib/database";
import { getOccurrences, lessonMatchesChinaMode, type GroupPreference, type ScheduleData } from "@/lib/schedule";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import { normalizeDigestSettings } from "@/lib/digest-settings";
import { sendPush } from "@/lib/push";
import type { Person } from "@/lib/people";

type DigestMode = "morning" | "evening";
type DigestEvent = { start:string;title:string;kind:"lesson"|"individual"|"rehearsal";cancelled?:boolean };

function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const value = (type:string) => parts.find(part=>part.type===type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}
const minutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m};
const addDay=(date:string)=>{const value=new Date(date+"T00:00:00Z");value.setUTCDate(value.getUTCDate()+1);return value.toISOString().slice(0,10)};
const due=(current:string,target:string)=>{const now=minutes(current),wanted=minutes(target);return now>=wanted&&now<wanted+15};
const short=(value:string,max=230)=>value.length<=max?value:value.slice(0,max-1).trimEnd()+"…";

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
  const lessons=visibleLessons(schedule,date,settings).map<DigestEvent>(lesson=>({start:lesson.timeStart,title:lesson.occurrence?.status==="cancelled"?"Отменена: "+lesson.class:lesson.class,kind:"lesson",cancelled:lesson.occurrence?.status==="cancelled"}));
  const ownIndividuals=individuals.map<DigestEvent>(lesson=>({start:lesson.timeStart,title:lesson.subject||"Индивидуальное",kind:"individual"}));
  const ownRehearsals=rehearsals.filter(item=>item.isGlobal||item.creatorId===person.id||getRehearsalAudienceNames(item).includes(person.name)).map<DigestEvent>(item=>({start:item.timeStart,title:item.subject||"Репетиция",kind:"rehearsal"}));
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

export async function runDigestDelivery(now=new Date()){
  const db=await getDatabase();
  const [people,schedule,profileDocs]=await Promise.all([
    getPeople(true),
    getSchedule(),
    db.collection<ProfileSettings>("profile_settings").find({}).toArray(),
  ]);
  const profiles=new Map(profileDocs.map(item=>[item.personId,item]));
  let dueProfiles=0,claimed=0,sent=0,failed=0;
  for(const person of people){
    const profile=profiles.get(person.id)??{personId:person.id,preferences:{},notes:{},updatedAt:new Date(0).toISOString()};
    const digest=normalizeDigestSettings(profile.digestSettings);
    const clock=localClock(now,digest.timeZone);
    for(const mode of ["morning","evening"] as DigestMode[]){
      const enabled=mode==="morning"?digest.morningEnabled:digest.eveningEnabled;
      const time=mode==="morning"?digest.morningTime:digest.eveningTime;
      if(!enabled||!due(clock.time,time))continue;
      dueProfiles++;
      const key=`${person.id}:${mode}:${clock.date}`;
      const claim=await db.collection("digest_deliveries").updateOne({key},{$setOnInsert:{key,personId:person.id,mode,localDate:clock.date,timeZone:digest.timeZone,createdAt:new Date().toISOString(),status:"pending"}},{upsert:true});
      if(claim.upsertedCount!==1)continue;
      claimed++;
      const targetDate=mode==="morning"?clock.date:addDay(clock.date);
      try{
        const events=await eventsFor(person,targetDate,schedule,profile);
        const delivery=await sendPush([person.id],null,payload(mode,targetDate,events));
        sent+=delivery.sent;
        if(delivery.sent===0&&delivery.subscriptions>0)failed+=delivery.failed;
        await db.collection("digest_deliveries").updateOne({key},{$set:{status:delivery.sent>0?"sent":delivery.subscriptions===0?"no_devices":"failed",sent:delivery.sent,failed:delivery.failed,subscriptions:delivery.subscriptions,targetDate,updatedAt:new Date().toISOString()}});
      }catch(error){
        failed++;
        await db.collection("digest_deliveries").updateOne({key},{$set:{status:"failed",updatedAt:new Date().toISOString()}});
        console.error("Digest delivery failed",person.id,mode,error);
      }
    }
  }
  return{dueProfiles,claimed,sent,failed,checked:people.length,at:now.toISOString()};
}
