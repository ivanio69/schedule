"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./login.module.css";

type LoginPerson={id:string;name:string};
type RequestResult={
  status?:"code_sent"|"link_required";
  requestId?:string;
  linkId?:string;
  botUrl?:string;
  telegram?:string;
  expiresIn?:number;
  resendAfter?:number;
  retryAfter?:number;
  error?:string;
};

export default function LoginPage(){
  const reducedMotion=useReducedMotion();
  const[people,setPeople]=useState<LoginPerson[]>([]);
  const[query,setQuery]=useState("");
  const[selected,setSelected]=useState<LoginPerson|null>(null);
  const[step,setStep]=useState<"choose"|"link"|"code">("choose");
  const[requestId,setRequestId]=useState("");
  const[linkId,setLinkId]=useState("");
  const[botUrl,setBotUrl]=useState("");
  const[telegram,setTelegram]=useState("");
  const[code,setCode]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[resendAt,setResendAt]=useState(0);
  const[now,setNow]=useState(Date.now());
  const[nextPath,setNextPath]=useState("/");
  const[success,setSuccess]=useState(false);

  useEffect(()=>{
    const raw=new URLSearchParams(window.location.search).get("next")??"/";
    setNextPath(raw.startsWith("/")&&!raw.startsWith("//")?raw:"/");
    void fetch("/api/auth/people",{cache:"no-store"}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось загрузить профили");
      setPeople(data.people??[]);
    }).catch(cause=>setError(cause instanceof Error?cause.message:"Не удалось загрузить профили"));
  },[]);

  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);

  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    return value?people.filter(person=>person.name.toLowerCase().includes(value)):people;
  },[people,query]);

  const applyRequest=(data:RequestResult)=>{
    if(data.status==="code_sent"&&data.requestId){
      setRequestId(data.requestId);setTelegram(data.telegram??"Telegram");setStep("code");setCode("");
      setResendAt(Date.now()+(data.resendAfter??30)*1000);
      return;
    }
    if(data.status==="link_required"&&data.linkId&&data.botUrl){
      setLinkId(data.linkId);setBotUrl(data.botUrl);setTelegram(data.telegram??"Telegram");setStep("link");
      return;
    }
    throw new Error(data.error??"Не удалось продолжить вход");
  };

  const requestCode=async(person=selected)=>{
    if(!person||busy)return;
    setBusy(true);setError("");setSelected(person);
    try{
      const response=await fetch("/api/auth/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personId:person.id})});
      const data=await response.json() as RequestResult;
      if(!response.ok){
        if(response.status===429&&data.retryAfter){setResendAt(Date.now()+data.retryAfter*1000);if(requestId)setStep("code")}
        throw new Error(data.error??"Не удалось отправить код");
      }
      applyRequest(data);
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось отправить код")}
    finally{setBusy(false)}
  };

  useEffect(()=>{
    if(step!=="link"||!linkId||!selected)return;
    let stopped=false;
    const poll=window.setInterval(()=>{
      void fetch("/api/auth/link-status?id="+encodeURIComponent(linkId),{cache:"no-store"}).then(r=>r.json()).then(data=>{
        if(stopped||!data.linked)return;
        window.clearInterval(poll);
        void requestCode(selected);
      }).catch(()=>{});
    },1800);
    return()=>{stopped=true;window.clearInterval(poll)};
  },[step,linkId,selected?.id]);

  const verify=async()=>{
    if(!requestId||code.length!==6||busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,code})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось войти");
      localStorage.setItem("schedule_person_id",data.person.id);
      window.dispatchEvent(new Event("schedule-auth-change"));
      setSuccess(true);
      await new Promise(resolve=>window.setTimeout(resolve,reducedMotion?80:420));
      window.location.replace(nextPath);
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось войти")}
    finally{setBusy(false)}
  };

  const back=()=>{setStep("choose");setRequestId("");setLinkId("");setBotUrl("");setCode("");setError("")};
  const resendSeconds=Math.max(0,Math.ceil((resendAt-now)/1000));

  return <motion.main className={styles.page} animate={success&&!reducedMotion?{backgroundColor:"rgba(0,0,0,.2)"}:{}} transition={{duration:.3}}>
    <motion.div className={styles.glow} aria-hidden="true" animate={success&&!reducedMotion?{scale:1.12,opacity:.35}:{scale:1,opacity:1}} transition={{duration:.42}}/>
    <AnimatePresence>{success&&<motion.div className={styles.loginSuccess} initial={reducedMotion?false:{opacity:0,scale:.9,filter:"blur(10px)"}} animate={{opacity:1,scale:1,filter:"blur(0px)"}} exit={{opacity:0}}><span>✓</span><strong>Вход выполнен</strong></motion.div>}</AnimatePresence>
    <motion.section className={styles.shell} initial={reducedMotion?false:{opacity:0,y:22,scale:.975,filter:"blur(10px)"}} animate={success&&!reducedMotion?{opacity:0,y:-10,scale:.965,filter:"blur(14px)"}:{opacity:1,y:0,scale:1,filter:"blur(0px)"}} transition={{duration:success?.34:.42,ease:[.22,1,.36,1]}}>
      <header className={styles.head}>
        <div className={styles.mark}>214Р</div>
        <div><span>РАСПИСАНИЕ</span><h1>{step==="choose"?"Вход":step==="link"?"Привяжи Telegram":"Код из Telegram"}</h1></div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {step==="choose"&&<motion.div key="choose" className={styles.content} initial={reducedMotion?false:{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:-8}}>
          <p className={styles.lead}>Выбери свой профиль. Для входа мы отправим одноразовый 6-значный код в привязанный Telegram.</p>
          <label className={styles.search}><span>Поиск</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Имя…"/></label>
          <div className={styles.people}>
            {filtered.map(person=><button type="button" key={person.id} disabled={busy} onClick={()=>void requestCode(person)}><i>{person.name.trim().charAt(0).toUpperCase()}</i><strong>{person.name}</strong><b>→</b></button>)}
            {!filtered.length&&<div className={styles.empty}>Никого не нашли</div>}
          </div>
        </motion.div>}

        {step==="link"&&selected&&<motion.div key="link" className={styles.content} initial={reducedMotion?false:{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:8}}>
          <div className={styles.identity}><i>{selected.name[0]}</i><div><strong>{selected.name}</strong><span>{telegram}</span></div></div>
          <p className={styles.lead}>Это первый вход через бота. Открой Telegram и нажми <b>Start</b>. Бот проверит имя пользователя и привяжет этот аккаунт.</p>
          <a className={styles.telegramButton} href={botUrl} target="_blank" rel="noreferrer">Открыть Telegram-бота ↗</a>
          <div className={styles.waiting}><span/><div><strong>Ждём привязку</strong><small>После Start код отправится автоматически</small></div></div>
          <button type="button" className={styles.secondary} onClick={()=>void requestCode()} disabled={busy}>{busy?"Проверяем…":"Я уже привязал Telegram"}</button>
          <button type="button" className={styles.back} onClick={back}>← Выбрать другой профиль</button>
        </motion.div>}

        {step==="code"&&selected&&<motion.div key="code" className={styles.content} initial={reducedMotion?false:{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:8}}>
          <div className={styles.identity}><i>{selected.name[0]}</i><div><strong>{selected.name}</strong><span>Код отправлен в {telegram}</span></div></div>
          <label className={styles.codeField}><span>6-значный код</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={event=>{if(event.key==="Enter")void verify()}} placeholder="000000"/></label>
          <button type="button" className={styles.primary} disabled={busy||code.length!==6} onClick={()=>void verify()}>{busy?"Проверяем…":"Войти"}</button>
          <button type="button" className={styles.secondary} disabled={busy||resendSeconds>0} onClick={()=>void requestCode()}>{resendSeconds>0?"Отправить снова через "+resendSeconds+" с":"Отправить код ещё раз"}</button>
          <button type="button" className={styles.back} onClick={back}>← Выбрать другой профиль</button>
        </motion.div>}
      </AnimatePresence>

      {error&&<p className={styles.error} role="alert">{error}</p>}
      <footer><span>Код действует 10 минут</span><span>До подтверждения приложение закрыто</span></footer>
    </motion.section>
  </motion.main>;
}
