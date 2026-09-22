"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PERSON_KEY = "schedule_person_id";
const DISMISSED_KEY = "push_prompt_dismissed_at";
function applicationServerKey(value:string){const s=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function supported(){return typeof window!=="undefined"&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window}

async function bindExistingSubscription(personId:string){
 if(!personId||!supported()||Notification.permission!=="granted")return false;
 try{
  const registration=await navigator.serviceWorker.getRegistration("/");
  const subscription=await registration?.pushManager.getSubscription();
  if(!subscription)return false;
  const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,subscription:subscription.toJSON()})});
  return response.ok;
 }catch{return false}
}

export default function PushPrompt(){
 const pathname = usePathname();
 const[show,setShow]=useState(false);const[error,setError]=useState("");
 useEffect(()=>{
  let alive=true;let lastBound="";
  const evaluate=()=>{
   if(!supported())return setShow(false);
   const personId=localStorage.getItem(PERSON_KEY)??"";
   if(Notification.permission==="granted"){
    setShow(false);
    if(personId&&personId!==lastBound){
     void bindExistingSubscription(personId).then(ok=>{if(alive&&ok)lastBound=personId});
    }
    return;
   }
   if(pathname==="/settings"||Notification.permission!=="default")return setShow(false);
   const dismissed=Number(localStorage.getItem(DISMISSED_KEY)||0);
   setShow(Boolean(personId)&&Date.now()-dismissed>259200000);
  };
  const visible=()=>{if(document.visibilityState==="visible")evaluate()};
  evaluate();
  window.addEventListener("storage",evaluate);
  window.addEventListener("schedule-person-changed",evaluate as EventListener);
  window.addEventListener("schedule-auth-change",evaluate as EventListener);
  window.addEventListener("focus",evaluate);
  document.addEventListener("visibilitychange",visible);
  const timer=window.setInterval(evaluate,5000);
  return()=>{alive=false;window.removeEventListener("storage",evaluate);window.removeEventListener("schedule-person-changed",evaluate as EventListener);window.removeEventListener("schedule-auth-change",evaluate as EventListener);window.removeEventListener("focus",evaluate);document.removeEventListener("visibilitychange",visible);window.clearInterval(timer)}
 },[pathname]);
 async function enable(){setError("");try{const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw new Error("Push не настроен на сервере");const permission=await Notification.requestPermission();if(permission!=="granted"){setShow(false);return}const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(key)});const personId=localStorage.getItem(PERSON_KEY);if(!personId)throw new Error("Профиль не выбран");const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId,subscription:subscription.toJSON()})});if(!response.ok)throw new Error("Не удалось сохранить подписку");setShow(false)}catch(e){setError(e instanceof Error?e.message:"Не удалось включить уведомления")}}
 if(!show)return null;return <div className="push-prompt-backdrop"><section className="push-prompt" role="dialog" aria-modal="true" aria-labelledby="push-prompt-title"><h2 id="push-prompt-title">Не пропускай изменения</h2><p>Включи уведомления о новых семинарах и индивидуальных занятиях.</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>void enable()}>Включить уведомления</button><button onClick={()=>{localStorage.setItem(DISMISSED_KEY,String(Date.now()));setShow(false)}}>Не сейчас</button></section></div>;
}
