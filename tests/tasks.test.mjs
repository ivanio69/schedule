import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), URL, console });
  return exports;
}
const helpers = load('lib/tasks.ts');
const scheduleHelpers = load('lib/schedule.ts');
const input = { title: 'Подготовить реквизит', date: '2026-11-02', notes: 'Взять ткань', timing: 'anytime', time: '', event: null };
const lesson = { id: 'lesson-a', class: 'Режиссура', professor: 'А.А.', auditorium: '1', timeStart: '09:00', timeEnd: '10:30', group: [1,2], weeks: [1,2] };
const last = { ...lesson, id: 'lesson-b', class: 'Танец', timeStart: '14:00', timeEnd: '15:30' };
const link = { kind: 'lesson', id: lesson.id, date: input.date };

function fixture(personId = 'alice') {
  let user = personId;
  const tasks = [], personal = [], slots = [], individuals = [], rehearsals = [];
  const schedule = { semesterStart: [2026,10,2], days: [{ table: [lesson,last] }, ...Array.from({length:5},()=>({table:[]}))], changes: [] };
  const profile = { preferences:{}, chinaMode:false };
  const matches = (item, filter) => Object.entries(filter).every(([key,value]) => {
    if(key==='$or') return value.some(part=>matches(item,part));
    if(value && typeof value==='object') {
      if('$in' in value) return value.$in.includes(item[key]);
      if('$elemMatch' in value) return (item[key]??[]).some(part=>matches(part,value.$elemMatch));
    }
    return item[key]===value;
  });
  const collectionFor = items => ({
    createIndex: async () => "tasks_owner_id",
    find: filter => ({ toArray: async()=>structuredClone(items.filter(item=>matches(item,filter))) }),
    findOne: async filter => structuredClone(items.find(item=>matches(item,filter))??null),
    insertOne: async item => { items.push(structuredClone(item)); },
    updateOne: async (filter,update) => { const item=items.find(item=>matches(item,filter)); if(item){Object.assign(item,structuredClone(update.$set));for(const [key,value] of Object.entries(update.$inc??{}))item[key]=(item[key]??0)+value;}return {matchedCount:item?1:0}; },
    deleteOne: async filter => {const index=items.findIndex(item=>matches(item,filter));if(index>=0)items.splice(index,1);return{deletedCount:index>=0?1:0};},
  });
  const db = { collection: name => collectionFor(({tasks,personal_events:personal,individual_slots:slots,individual_lessons:individuals,rehearsals})[name]??[]) };
  const database = { getDatabase: async()=>db, getSchedule:async()=>schedule, getProfileSettings:async()=>profile,
    getRehearsals:async date=>rehearsals.filter(item=>item.date===date), getIndividualLessons:async(id,date)=>individuals.filter(item=>item.personId===id&&item.date===date), getIndividualSlots:async from=>slots.filter(item=>item.date===from),
  };
  const resolver = load('lib/task-events.ts', {'@/lib/database':database,'@/lib/schedule':scheduleHelpers,'@/lib/tasks':helpers});
  const route = load('app/api/tasks/route.ts', {
    'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
    'next/headers':{cookies:async()=>({get:()=>({value:user})})},
    '@/lib/auth-session':{AUTH_COOKIE:'auth',verifyAuthSessionToken:token=>token?{personId:token}:null},
    '@/lib/database':database,'@/lib/tasks':helpers,'@/lib/task-events':resolver,
  });
  const request=(method,body,query='')=>route[method](new Request('https://schedule.test/api/tasks'+query,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})}));
  const day=async(date=input.date)=> (await request('GET',null,'?date='+date)).json();
  return {tasks,personal,slots,individuals,rehearsals,schedule,profile,request,day,as:id=>{user=id;}};
}

test('validates dates, times, field lengths and link shapes; discards hidden timing values',()=>{
  assert.ok(helpers.normalizeTask(input));
  assert.equal(helpers.normalizeTask({...input,time:'99:99'}).time,'');
  for(const change of [{title:' '},{title:'x'.repeat(161)},{date:'2026-02-30'},{date:'2026-02-29'},{date:{$gt:''}},{notes:'x'.repeat(2001)},{timing:'maybe'},{timing:'time',time:'24:00'},{timing:'time',time:'1:30'},{event:{kind:'personal',id:{$gt:''},date:input.date}},{event:{...link,date:'invalid'}},{event:{...link,kind:'admin'}}]) assert.equal(helpers.normalizeTask({...input,...change}),null);
  assert.ok(helpers.normalizeTask({...input,timing:'time',time:'00:00'}));
});

test('owner CRUD, completion/reopen, private cache headers and date filtering',async()=>{
  const f=fixture();
  const response=await f.request('POST',{...input,creatorId:'bob',completed:true});
  assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const {task}=await response.json(); assert.equal(task.creatorId,'alice');assert.equal(task.completed,false);
  assert.equal((await f.day()).tasks.length,1);assert.equal((await f.day('2026-11-03')).tasks.length,0);
  assert.equal((await f.request('PATCH',{id:task.id,revision:0,completed:true})).status,200);
  assert.equal((await f.day()).tasks[0].completed,true);
  assert.equal((await f.request('PATCH',{id:task.id,revision:1,completed:false})).status,200);
  assert.equal((await f.request('PUT',{...input,id:task.id,revision:2,title:'Новое',date:'2026-11-03'})).status,200);
  assert.equal((await f.day()).tasks.length,0);assert.equal((await f.day('2026-11-03')).tasks[0].title,'Новое');
  assert.equal((await f.request('DELETE',{id:task.id,revision:3})).status,200);assert.equal(f.tasks.length,0);
});

test('other users and admins cannot read or mutate a task, even by forging owner parameters',async()=>{
  const f=fixture();const {task}=await(await f.request('POST',input)).json();
  for(const user of ['bob','admin']) {
    f.as(user);assert.equal((await(await f.request('GET',null,'?date='+input.date+'&creatorId=alice')).json()).tasks.length,0);
    for(const method of ['PUT','PATCH','DELETE']) assert.equal((await f.request(method,{...input,id:task.id,revision:0,creatorId:'alice',completed:true})).status,404);
  }
  assert.equal(f.tasks[0].title,input.title);assert.equal(f.tasks[0].completed,false);
});

test('every endpoint requires an authenticated session and malformed input is rejected',async()=>{
  const f=fixture(null);
  for(const method of ['GET','POST','PUT','PATCH','DELETE'])assert.equal((await f.request(method,method==='GET'?null:input)).status,401);
  f.as('alice');assert.equal((await f.request('GET',null,'?date=2026-02-30')).status,400);
  assert.equal((await f.request('POST',null)).status,400);
  assert.equal((await f.request('DELETE',{id:{$ne:''},revision:0})).status,400);
});

test('stale and concurrent writes cannot overwrite newer changes',async()=>{
  const f=fixture();const {task}=await(await f.request('POST',input)).json();
  const results=await Promise.all([f.request('PATCH',{id:task.id,revision:0,completed:true}),f.request('PUT',{...input,id:task.id,revision:0,title:'Race'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.request('DELETE',{id:task.id,revision:0})).status,409);
  assert.equal((await f.request('PATCH',{id:task.id,revision:1,completed:'true'})).status,400);
});

test('after classes uses active subgroup lessons, updates after cancellation and handles free days',async()=>{
  const f=fixture();await f.request('POST',{...input,timing:'after-classes'});
  assert.equal((await f.day()).tasks[0].scheduledTime,'15:30');
  f.schedule.changes.push({key:last.id,date:input.date,lesson:last,kind:'cancel',targetDate:input.date,timeStart:last.timeStart,timeEnd:last.timeEnd,auditorium:'1',reason:'Нет',revision:1});
  assert.equal((await f.day()).tasks[0].scheduledTime,'10:30');
  f.schedule.changes.push({key:lesson.id,date:input.date,lesson,kind:'cancel',targetDate:input.date,timeStart:lesson.timeStart,timeEnd:lesson.timeEnd,auditorium:'1',reason:'Нет',revision:1});
  assert.equal((await f.day()).tasks[0].scheduledTime,null);
  assert.equal((await f.day()).tasks.length,1);
});

test('links are selected from visible events; private events and foreign individual lessons are never exposed',async()=>{
  const f=fixture();f.personal.push({id:'secret',creatorId:'bob',date:input.date,title:'Secret',timeStart:'18:00',timeEnd:'19:00'}, {id:'invite',creatorId:'bob',date:input.date,title:'Invite',timeStart:'18:00',timeEnd:'19:00',invitations:[{personId:'alice',status:'accepted'}]});
  f.individuals.push({id:'foreign',personId:'bob',date:input.date,subject:'Secret',timeStart:'12:00',timeEnd:'13:00'});
  f.slots.push({id:'slot',date:input.date,subject:'Slot',studentIds:['alice'],timeStart:'16:00',timeEnd:'17:00'});
  const data=await f.day();assert.ok(!data.events.some(e=>e.id==='secret'||e.id==='foreign'));assert.ok(data.events.some(e=>e.id==='invite'));assert.ok(data.events.some(e=>e.id==='slot'));
  for(const [kind,id] of [['personal','secret'],['individual','foreign'],['rehearsal','missing']]) assert.equal((await f.request('POST',{...input,event:{kind,id,date:input.date}})).status,400);
  assert.equal((await f.request('POST',{...input,event:{kind:'personal',id:'invite',date:input.date}})).status,201);
  assert.equal((await f.request('POST',{...input,event:link})).status,201);
});

test('linked lesson follows a move without duplication and uses new day classes; cancellation preserves task',async()=>{
  const f=fixture();const {task}=await(await f.request('POST',{...input,event:link,timing:'after-classes'})).json();
  f.schedule.changes.push({key:lesson.id,date:input.date,lesson,kind:'move',targetDate:'2026-11-03',timeStart:'12:00',timeEnd:'13:30',auditorium:'2',reason:'Перенос',revision:1});
  assert.equal((await f.day()).tasks.length,0);
  let data=await f.day('2026-11-03');assert.equal(data.tasks.length,1);assert.equal(data.tasks[0].scheduledTime,'13:30');assert.equal(data.tasks[0].linkedEvent.title,lesson.class);
  f.schedule.changes[0]={...f.schedule.changes[0],kind:'cancel',targetDate:input.date};
  data=await f.day();assert.equal(data.tasks[0].linkedEvent.cancelled,true);
  assert.equal((await f.request('PUT',{...input,event:link,id:task.id,revision:0,title:'Сохранить после отмены'})).status,200);
});

test('deleted events preserve their tasks with an unavailable label and can be detached',async()=>{
  const f=fixture();f.rehearsals.push({id:'rep',date:input.date,subject:'Репетиция',timeStart:'16:00',timeEnd:'17:00'});
  const {task}=await(await f.request('POST',{...input,event:{kind:'rehearsal',id:'rep',date:input.date}})).json();
  f.rehearsals.length=0;const data=await f.day();assert.equal(data.tasks.length,1);assert.equal(data.tasks[0].linkMissing,true);
  assert.equal((await f.request('PUT',{...input,id:task.id,revision:0})).status,200);assert.equal((await f.day()).tasks[0].linkMissing,false);
});


test('after classes follows subgroup and Chinese-mode preferences, not unrelated lessons or rehearsals', async()=>{
  const f=fixture();
  f.schedule.days[0].table=[{...lesson,group:[1]},{...last,group:[2]},{...last,id:'china',class:'Китайский',group:['china'],timeEnd:'18:00'}];
  f.profile.preferences={Режиссура:'1',Танец:'1'};
  f.rehearsals.push({id:'late',date:input.date,subject:'Репетиция',timeStart:'19:00',timeEnd:'23:00'});
  await f.request('POST',{...input,timing:'after-classes'});
  assert.equal((await f.day()).tasks[0].scheduledTime,'10:30');
  f.profile.chinaMode=true;
  assert.equal((await f.day()).tasks[0].scheduledTime,'18:00');
});
