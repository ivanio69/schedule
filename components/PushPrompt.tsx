"use client";
import { useEffect, useState } from "react";

const PERSON_KEY = "schedule_person_id";
const DISMISSED_KEY = "push_prompt_dismissed_at";
function applicationServerKey(value:string){const s=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function supported(){return typeof window!=="undefined"&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window}

export default function PushPrompt(){
 const[show,setShow]=useState(false);const[error,setError]=useState("");
 useEffect(()=>{const evaluate=()=>{if(!supported()||Notification.permission!=="default")return setShow(false);const personId=localStorage.getItem(PERSON_KEY);const dismissed=Number(localStorage.getItem(DISMISSED_KEY)||0);setShow(Boolean(personId)&&Date.now()-dismissed>259200000)};evaluate();window.addEventListener("storage",evaluate);window.addEventListener("schedule-person-changed",evaluate as EventListener);const timer=window.setInterval(evaluate,1000);return()=>{window.removeEventListener("storage",evaluate);window.removeEventListener("schedule-person-changed",evaluate as EventListener);window.clearInterval(timer)}},[]);
 async function enable(){setError("");try{const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw new Error("Push не настроен на сервере");const permission=await Notification.requestPermission();if(permission!=="granted"){setShow(false);return}const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(key)});const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId:localStorage.getItem(PERSON_KEY),subscription:subscription.toJSON()})});if(!response.ok)throw new Error("Не удалось сохранить подписку");setShow(false)}catch(e){setError(e instanceof Error?e.message:"Не удалось включить уведомления")}}
 if(!show)return null;return <div className="push-prompt-backdrop"><section className="push-prompt"><h2>Не пропускай изменения</h2><p>Включи уведомления о новых семинарах и индивидуальных занятиях.</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>void enable()}>Включить уведомления</button><button onClick={()=>{localStorage.setItem(DISMISSED_KEY,String(Date.now()));setShow(false)}}>Не сейчас</button></section></div>;
}
