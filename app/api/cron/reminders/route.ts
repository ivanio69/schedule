import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getIndividualLessons, getPeople, getProfileSettings, getRehearsals, getSchedule } from "@/lib/database";
import { getOccurrences } from "@/lib/schedule";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";
const MINUTES=[5,10,15,30] as const;
const tz="Europe/Moscow";
function localNow(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const get=(type:string)=>parts.find(p=>p.type===type)?.value??"";return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`}}
function mins(value:string){const [h,m]=value.split(":").map(Number);return h*60+m}
function due(start:string,lead:number,now:string){return mins(start)-lead===mins(now)}
async function once(key:string,run:()=>Promise<void>){const db=await getDatabase();try{await db.collection("reminder_deliveries").insertOne({key,createdAt:new Date().toISOString()});await run()}catch(error:any){if(error?.code!==11000)throw error}}

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Нет доступа"},{status:401});
  const {date,time}=localNow();
  const [schedule,people,rehearsals,individuals]=await Promise.all([getSchedule(),getPeople(true),getRehearsals(date),getIndividualLessons(undefined,date)]);
  const lessons=getOccurrences(schedule,date);
  let sent=0;
  for(const person of people){
    const settings=await getProfileSettings(person.id);
    const lead=MINUTES.includes(settings.firstLessonReminder as any)?settings.firstLessonReminder!:15;
    const visible=lessons.filter(lesson=>{if(settings.chinaMode&&!lesson.group.includes("china"))return false;const pref=settings.preferences[lesson.class]??"both";return pref==="both"||!lesson.group.length||lesson.group.includes(Number(pref))});
    const first=visible[0];
    if(first&&due(first.timeStart,lead,time))await once(`first:${date}:${person.id}:${lead}`,async()=>{const r=await sendPush([person.id],null,{title:"Скоро первая пара",body:`${first.class} · ${first.timeStart} · ${first.auditorium}`,url:"/"});sent+=r.sent});
    for(const lesson of visible){const key=`lesson:${date}:${lesson.timeStart}:${lesson.class}`,eventLead=settings.eventReminders?.[key];if(eventLead&&due(lesson.timeStart,eventLead,time))await once(`event:${key}:${person.id}:${eventLead}`,async()=>{const r=await sendPush([person.id],null,{title:"Скоро пара",body:`${lesson.class} · ${lesson.timeStart} · ${lesson.auditorium}`,url:"/schedule"});sent+=r.sent})}
    for(const rehearsal of rehearsals){const eventLead=settings.eventReminders?.[`rehearsal:${rehearsal.id}`];if(eventLead&&due(rehearsal.timeStart,eventLead,time))await once(`rehearsal:${rehearsal.id}:${person.id}:${eventLead}`,async()=>{const r=await sendPush([person.id],null,{title:"Скоро репетиция",body:`${rehearsal.subject} · ${rehearsal.timeStart}`,url:"/schedule"});sent+=r.sent})}
    for(const individual of individuals.filter(item=>item.personId===person.id)){const eventLead=settings.eventReminders?.[`individual:${individual.id}`];if(eventLead&&due(individual.timeStart,eventLead,time))await once(`individual:${individual.id}:${person.id}:${eventLead}`,async()=>{const r=await sendPush([person.id],null,{title:"Скоро индивидуальное",body:`${individual.subject} · ${individual.timeStart} · ${individual.auditorium}`,url:"/schedule"});sent+=r.sent})}
  }
  return NextResponse.json({ok:true,date,time,sent});
}
