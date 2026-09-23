import { getDatabase, getIndividualLessons, getPeople, getRehearsals, getSchedule, type ProfileSettings } from "@/lib/database";
import { getOccurrences, lessonMatchesChinaMode, type GroupPreference, type ScheduleData } from "@/lib/schedule";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import { getDigestLocalDate, getDueDigestDate, normalizeDigestSettings } from "@/lib/digest-settings";
import { sendPush } from "@/lib/push";
import type { Person } from "@/lib/people";

type DigestMode = "morning" | "evening";
type DigestEvent = { start:string;end:string;title:string;kind:"lesson"|"individual"|"rehearsal";cancelled?:boolean;professor?:string };

const addDay=(date:string)=>{const value=new Date(date+"T00:00:00Z");value.setUTCDate(value.getUTCDate()+1);return value.toISOString().slice(0,10)};
const short=(value:string,max=320)=>value.length<=max?value:value.slice(0,max-1).trimEnd()+"…";

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
  const lessons=visibleLessons(schedule,date,settings).map<DigestEvent>(lesson=>({start:lesson.timeStart,end:lesson.timeEnd,title:lesson.occurrence?.status==="cancelled"?"Отменена: "+lesson.class:lesson.class,kind:"lesson",cancelled:lesson.occurrence?.status==="cancelled"}));
  const ownIndividuals=individuals.map<DigestEvent>(lesson=>({start:lesson.timeStart,end:lesson.timeEnd,title:lesson.subject||"Индивидуальное",kind:"individual",professor:lesson.professor?.trim()||undefined}));
  const ownRehearsals=rehearsals.filter(item=>item.isGlobal||item.creatorId===person.id||getRehearsalAudienceNames(item).includes(person.name)).map<DigestEvent>(item=>({start:item.timeStart,end:item.timeEnd,title:item.subject||"Репетиция",kind:"rehearsal"}));
  return [...lessons,...ownIndividuals,...ownRehearsals].sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,"ru"));
}

function lessonWord(count:number){
  const mod100=count%100,mod10=count%10;
  if(mod100>=11&&mod100<=14)return"пар";
  if(mod10===1)return"пара";
  if(mod10>=2&&mod10<=4)return"пары";
  return"пар";
}

function digestBody(mode:DigestMode,events:DigestEvent[]){
  const day=mode==="morning"?"сегодня":"завтра";
  const lessons=events.filter(item=>item.kind==="lesson"&&!item.cancelled);
  const rehearsals=events.filter(item=>item.kind==="rehearsal");
  const individuals=events.filter(item=>item.kind==="individual");
  const sentences:string[]=[];

  if(lessons.length){
    sentences.push(`${day} ${lessons.length} ${lessonWord(lessons.length)}, начало в ${lessons[0].start}`);
  }else{
    sentences.push(`${day} пар нет`);
  }

  for(const item of rehearsals){
    sentences.push(`репетиция «${item.title}» в ${item.start}`);
  }
  for(const item of individuals){
    sentences.push(item.professor
      ? `у тебя индивидуальное занятие с ${item.professor} в ${item.start}`
      : `у тебя индивидуальное занятие «${item.title}» в ${item.start}`);
  }

  const cancelled=events.filter(item=>item.kind==="lesson"&&item.cancelled);
  if(cancelled.length){
    sentences.push(cancelled.length===1
      ? `одна пара отменена — ${cancelled[0].title.replace(/^Отменена:\s*/,"")}`
      : `отменено пар: ${cancelled.length}`);
  }

  const activeEvents=events.filter(item=>!(item.kind==="lesson"&&item.cancelled));
  const latestEnd=activeEvents.reduce((latest,item)=>item.end>latest?item.end:latest,"");
  if(latestEnd)sentences.push(`освободишься в ${latestEnd}`);

  return short(sentences.map((sentence,index)=>index===0?sentence.charAt(0).toUpperCase()+sentence.slice(1):sentence).join(". ")+".");
}

function payload(mode:DigestMode,_date:string,events:DigestEvent[]){
  return{
    title:mode==="morning"?"Доброе утро":"Добрый вечер",
    body:digestBody(mode,events),
    url:"/",
  };
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
    for(const mode of ["morning","evening"] as DigestMode[]){
      const enabled=mode==="morning"?digest.morningEnabled:digest.eveningEnabled;
      const time=mode==="morning"?digest.morningTime:digest.eveningTime;
      if(!enabled)continue;
      const scheduledDate=getDueDigestDate(now,digest.timeZone,time);
      if(!scheduledDate)continue;
      dueProfiles++;
      const key=`${person.id}:${mode}:${scheduledDate}`;
      const claim=await db.collection("digest_deliveries").updateOne({key},{$setOnInsert:{key,personId:person.id,mode,localDate:scheduledDate,timeZone:digest.timeZone,createdAt:new Date().toISOString(),status:"pending"}},{upsert:true});
      if(claim.upsertedCount!==1)continue;
      claimed++;
      const targetDate=mode==="morning"?scheduledDate:addDay(scheduledDate);
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

export async function forceDigestDelivery(personId:string,now=new Date()){
  const db=await getDatabase();
  const [people,schedule,profileDoc]=await Promise.all([
    getPeople(true),
    getSchedule(),
    db.collection<ProfileSettings>("profile_settings").findOne({personId}),
  ]);
  const person=people.find(item=>item.id===personId);
  if(!person)throw new Error("Profile not found");
  const profile=profileDoc??{personId,preferences:{},notes:{},updatedAt:new Date(0).toISOString()};
  const settings=normalizeDigestSettings(profile.digestSettings);
  const localDate=getDigestLocalDate(now,settings.timeZone);
  const results=[] as Array<{mode:DigestMode;targetDate:string;subscriptions:number;sent:number;failed:number}>;
  for(const mode of ["morning","evening"] as DigestMode[]){
    const targetDate=mode==="morning"?localDate:addDay(localDate);
    const events=await eventsFor(person,targetDate,schedule,profile);
    const delivery=await sendPush([person.id],null,payload(mode,targetDate,events));
    results.push({mode,targetDate,...delivery});
  }
  return{personId,timeZone:settings.timeZone,localDate,results};
}

