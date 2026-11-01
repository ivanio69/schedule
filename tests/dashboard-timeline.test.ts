import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardRehearsalSegments, getDayOccupancy } from "../lib/dashboard-timeline";
import { getOccurrences, type Rehearsal, type ScheduleData } from "../lib/schedule";

const rehearsal: Rehearsal = {
  id:"r",creatorId:"author",subject:"Прогон",date:"2026-11-02",timeStart:"15:00",timeEnd:"18:00",responsible:"Автор",participants:[],participantMode:"blocks",createdAt:"",
  blocks:[
    {id:"one",title:"Первая сцена",timeStart:"15:00",timeEnd:"15:45",participants:["Анна"]},
    {id:"two",title:"Вторая сцена",timeStart:"16:00",timeEnd:"17:00",participants:["Борис"]},
    {id:"three",title:"Финал",timeStart:"17:30",timeEnd:"18:00",participants:["Анна"]},
  ],
};
test("block invitations include only the user's blocks, keeping gaps free",()=>{
  const segments = getDashboardRehearsalSegments(rehearsal,"anna","Анна");
  assert.deepEqual(segments.map(segment=>segment.blockId),["one","three"]);
  const occupancy=getDayOccupancy(segments.map(segment=>({start:segment.timeStart,end:segment.timeEnd})));
  assert.equal(occupancy.occupiedMinutes,75);
  assert.deepEqual(occupancy.gaps,[{start:945,end:1050}]);
  assert.equal(getDashboardRehearsalSegments(rehearsal,"outsider","Виктор").length,0);
});
test("rehearsal-level and global participation include all scheduled blocks; unblocked rehearsals keep one row",()=>{
  assert.equal(getDashboardRehearsalSegments({...rehearsal,participantMode:"rehearsal",participants:["Анна"]},"anna","Анна").length,3);
  assert.equal(getDashboardRehearsalSegments({...rehearsal,isGlobal:true},"outsider","Виктор").length,3);
  assert.equal(getDashboardRehearsalSegments({...rehearsal,blocks:[],participants:["Анна"],participantMode:"rehearsal"},"anna","Анна").length,1);
});
test("overlapping lessons and events are counted once and cancellations do not consume gaps",()=>{
  const occupancy=getDayOccupancy([{start:"09:00",end:"11:00"},{start:"10:00",end:"12:00"},{start:"12:00",end:"13:00",status:"cancelled"},{start:"14:00",end:"15:00"}]);
  assert.equal(occupancy.occupiedMinutes,240);
  assert.deepEqual(occupancy.gaps,[{start:720,end:840}]);
});
test("a moved occurrence is counted on the destination date, never again on the original date",()=>{
  const lesson={id:"lesson",class:"Речь",professor:"Преподаватель",auditorium:"1",timeStart:"09:00",timeEnd:"10:00",group:[1],weeks:[]};
  const schedule:ScheduleData={semesterStart:[2026,10,2],days:Array.from({length:6},(_,day)=>({table:day===0?[lesson]:[]})),changes:[{key:"lesson",date:"2026-11-02",lesson,kind:"move",targetDate:"2026-11-03",timeStart:"14:00",timeEnd:"15:00",auditorium:"2",reason:"Перенос",revision:1}]};
  assert.equal(getOccurrences(schedule,"2026-11-02").length,0);
  const target=getOccurrences(schedule,"2026-11-03");
  assert.equal(target.length,1);
  assert.equal(getDayOccupancy(target.map(item=>({start:item.timeStart,end:item.timeEnd,status:item.occurrence?.status}))).occupiedMinutes,60);
});
