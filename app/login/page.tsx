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
  resendAfter?:number;
  retryAfter?:number;
  error?:string;
};

const ERROR_TEXT:Record<string,string>={
  not_configured:"Telegram OpenID ещё не настроен на сервере.",
  start_failed:"Не удалось начать вход через Telegram.",
  flow_expired:"Сессия входа истекла. Попробуй ещё раз.",
  telegram_denied:"Вход в Telegram был отменён.",
  invalid_state:"Проверка входа не прошла. Попробуй ещё раз.",
  no_username:"У этого Telegram-аккаунта нет имени пользователя. Оно нужно для первой привязки к профилю.",
  profile_not_found:"Для этого имени пользователя Telegram не найден профиль в приложении.",
  ambiguous_profile:"Это имя пользователя Telegram привязано к нескольким профилям. Обратись к администратору.",
  profile_linked_elsewhere:"Этот профиль уже привязан к другому Telegram-аккаунту.",
  token_failed:"Telegram не удалось подтвердить. Попробуй ещё раз.",
};

export default function LoginPage(){
  const reducedMotion=useReducedMotion();
  const[nextPath,setNextPath]=useState("/");
  const[error,setError]=useState("");
  const[success,setSuccess]=useState(false);
  const[successText,setSuccessText]=useState("Telegram подтвердил аккаунт");
  const[ready,setReady]=useState(false);
  const[method,setMethod]=useState<"openid"|"otp">("openid");

  const[people,setPeople]=useState<LoginPerson[]>([]);
  const[peopleLoading,setPeopleLoading]=useState(false);
  const[query,setQuery]=useState("");
  const[selected,setSelected]=useState<LoginPerson|null>(null);
  const[otpStep,setOtpStep]=useState<"choose"|"link"|"code">("choose");
  const[requestId,setRequestId]=useState("");
  const[linkId,setLinkId]=useState("");
  const[botUrl,setBotUrl]=useState("");
  const[telegram,setTelegram]=useState("");
  const[code,setCode]=useState("");
  const[busy,setBusy]=useState(false);
  const[resendAt,setResendAt]=useState(0);
  const[now,setNow]=useState(Date.now());

  const finishLogin=async(personId:string,label:string,next=nextPath)=>{
    localStorage.setItem("schedule_person_id",personId);
    window.dispatchEvent(new Event("schedule-auth-change"));
    setSuccessText(label);
    setSuccess(true);
    await new Promise(resolve=>window.setTimeout(resolve,reducedMotion?80:480));
    window.location.replace(next);
  };

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const raw=params.get("next")??"/";
    const next=raw.startsWith("/")&&!raw.startsWith("//")?raw:"/";
    setNextPath(next);
    const errorCode=params.get("openid_error");
    if(errorCode)setError(ERROR_TEXT[errorCode]??"Не удалось войти через Telegram.");

    if(params.get("openid")==="success"){
      void fetch("/api/auth/session",{cache:"no-store"}).then(async response=>{
        if(!response.ok)throw new Error("Сессия не создана");
        const data=await response.json();
        if(!data?.person?.id)throw new Error("Профиль не найден");
        await finishLogin(data.person.id,"Telegram подтвердил аккаунт",next);
      }).catch(()=>{setError("Не удалось завершить вход. Попробуй ещё раз.");setReady(true)});
      return;
    }
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);

  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    return value?people.filter(person=>person.name.toLowerCase().includes(value)):people;
  },[people,query]);

  const loadPeople=async()=>{
    if(people.length||peopleLoading)return;
    setPeopleLoading(true);setError("");
    try{
      const response=await fetch("/api/auth/people",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось загрузить профили");
      setPeople(data.people??[]);
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось загрузить профили")}
    finally{setPeopleLoading(false)}
  };

  const openOtp=()=>{
    setMethod("otp");setOtpStep("choose");setError("");
    void loadPeople();
  };

  const applyRequest=(data:RequestResult)=>{
    if(data.status==="code_sent"&&data.requestId){
      setRequestId(data.requestId);setTelegram(data.telegram??"Telegram");setOtpStep("code");setCode("");
      setResendAt(Date.now()+(data.resendAfter??30)*1000);
      return;
    }
    if(data.status==="link_required"&&data.linkId&&data.botUrl){
      setLinkId(data.linkId);setBotUrl(data.botUrl);setTelegram(data.telegram??"Telegram");setOtpStep("link");
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
        if(response.status===429&&data.retryAfter){setResendAt(Date.now()+data.retryAfter*1000);if(requestId)setOtpStep("code")}
        throw new Error(data.error??"Не удалось отправить код");
      }
      applyRequest(data);
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось отправить код")}
    finally{setBusy(false)}
  };

  useEffect(()=>{
    if(method!=="otp"||otpStep!=="link"||!linkId||!selected)return;
    let stopped=false;
    const poll=window.setInterval(()=>{
      void fetch("/api/auth/link-status?id="+encodeURIComponent(linkId),{cache:"no-store"}).then(r=>r.json()).then(data=>{
        if(stopped||!data.linked)return;
        window.clearInterval(poll);
        void requestCode(selected);
      }).catch(()=>{});
    },1800);
    return()=>{stopped=true;window.clearInterval(poll)};
  },[method,otpStep,linkId,selected?.id]);

  const verifyOtp=async()=>{
    if(!requestId||code.length!==6||busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,code})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Не удалось войти");
      await finishLogin(data.person.id,"Код подтверждён");
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось войти")}
    finally{setBusy(false)}
  };

  const resetOtp=()=>{setOtpStep("choose");setSelected(null);setRequestId("");setLinkId("");setBotUrl("");setCode("");setError("")};
  const backToOpenId=()=>{resetOtp();setMethod("openid")};
  const resendSeconds=Math.max(0,Math.ceil((resendAt-now)/1000));
  const startUrl="/api/auth/openid/start?next="+encodeURIComponent(nextPath);

  return <motion.main className={styles.page} animate={success&&!reducedMotion?{backgroundColor:"rgba(0,0,0,.2)"}:{}} transition={{duration:.32}}>
    <motion.div className={styles.glow} aria-hidden="true" animate={success&&!reducedMotion?{scale:1.14,opacity:.3}:{scale:1,opacity:1}} transition={{duration:.48}}/>
    <AnimatePresence>{success&&<motion.div className={styles.loginSuccess} initial={reducedMotion?false:{opacity:0,scale:.88,filter:"blur(12px)"}} animate={{opacity:1,scale:1,filter:"blur(0px)"}}><span>✓</span><strong>Вход выполнен</strong><small>{successText}</small></motion.div>}</AnimatePresence>

    <motion.section className={styles.shell} initial={reducedMotion?false:{opacity:0,y:28,scale:.97,filter:"blur(12px)"}} animate={success&&!reducedMotion?{opacity:0,y:-12,scale:.96,filter:"blur(16px)"}:{opacity:1,y:0,scale:1,filter:"blur(0px)"}} transition={{duration:success?.36:.46,ease:[.22,1,.36,1]}}>
      <header className={styles.head}>
        <motion.div className={styles.mark} initial={reducedMotion?false:{scale:.78,rotate:-6,opacity:0}} animate={{scale:1,rotate:0,opacity:1}} transition={{delay:.08,duration:.4,ease:[.22,1,.36,1]}}>214Р</motion.div>
        <motion.div initial={reducedMotion?false:{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:.13,duration:.38}}>
          <span>РАСПИСАНИЕ</span>
          <h1>{method==="openid"?"Вход":otpStep==="choose"?"Вход по коду":otpStep==="link"?"Привяжи Telegram":"Код из Telegram"}</h1>
        </motion.div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {method==="openid"&&<motion.div key="openid" className={styles.content} initial={reducedMotion?false:{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:-10}}>
          <p className={styles.lead}>Основной способ — Telegram OpenID. Telegram сам подтверждает аккаунт, а приложение получает только данные профиля, необходимые для входа.</p>
          <div className={styles.openIdCard}>
            <div className={styles.telegramIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 4 3.8 10.6c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.1c.2.7.1 1 .9 1 .6 0 .9-.3 1.2-.6l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8L22.8 5c.3-1.2-.5-1.7-1.8-1Z"/></svg></div>
            <div><strong>Telegram OpenID</strong><span>OpenID Connect · PKCE · рекомендуемый способ</span></div>
          </div>
          <a className={styles.telegramButton+" "+(!ready?styles.disabled:"")} href={ready?startUrl:undefined}>Войти через Telegram <b>↗</b></a>
          <div className={styles.or}><span>или</span></div>
          <button type="button" className={styles.otpButton} onClick={openOtp}>Войти по 6-значному коду</button>
        </motion.div>}

        {method==="otp"&&otpStep==="choose"&&<motion.div key="otp-choose" className={styles.content} initial={reducedMotion?false:{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:10}}>
          <p className={styles.lead}>Выбери профиль. Мы отправим одноразовый код в Telegram, привязанный к этому человеку.</p>
          <label className={styles.search}><span>Поиск</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Имя…"/></label>
          <div className={styles.people}>
            {peopleLoading&&<div className={styles.empty}>Загружаем профили…</div>}
            {!peopleLoading&&filtered.map(person=><button type="button" key={person.id} disabled={busy} onClick={()=>void requestCode(person)}><i>{person.name.trim().charAt(0).toUpperCase()}</i><strong>{person.name}</strong><b>→</b></button>)}
            {!peopleLoading&&people.length>0&&!filtered.length&&<div className={styles.empty}>Никого не нашли</div>}
          </div>
          <button type="button" className={styles.back} onClick={backToOpenId}>← Вернуться к OpenID</button>
        </motion.div>}

        {method==="otp"&&otpStep==="link"&&selected&&<motion.div key="otp-link" className={styles.content} initial={reducedMotion?false:{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:10}}>
          <div className={styles.identity}><i>{selected.name[0]}</i><div><strong>{selected.name}</strong><span>{telegram}</span></div></div>
          <p className={styles.lead}>Бот ещё не может отправить код этому аккаунту. Открой Telegram и нажми <b>Start</b> — после привязки код придёт автоматически.</p>
          <a className={styles.telegramButton} href={botUrl} target="_blank" rel="noreferrer">Открыть Telegram-бота ↗</a>
          <div className={styles.waiting}><span/><div><strong>Ждём привязку</strong><small>После Start код отправится автоматически</small></div></div>
          <button type="button" className={styles.secondary} onClick={()=>void requestCode()} disabled={busy}>{busy?"Проверяем…":"Я уже привязал Telegram"}</button>
          <button type="button" className={styles.back} onClick={resetOtp}>← Выбрать другой профиль</button>
        </motion.div>}

        {method==="otp"&&otpStep==="code"&&selected&&<motion.div key="otp-code" className={styles.content} initial={reducedMotion?false:{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={reducedMotion?undefined:{opacity:0,x:10}}>
          <div className={styles.identity}><i>{selected.name[0]}</i><div><strong>{selected.name}</strong><span>Код отправлен в {telegram}</span></div></div>
          <label className={styles.codeField}><span>6-значный код</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={event=>{if(event.key==="Enter")void verifyOtp()}} placeholder="000000"/></label>
          <button type="button" className={styles.primary} disabled={busy||code.length!==6} onClick={()=>void verifyOtp()}>{busy?"Проверяем…":"Войти"}</button>
          <button type="button" className={styles.secondary} disabled={busy||resendSeconds>0} onClick={()=>void requestCode()}>{resendSeconds>0?"Отправить снова через "+resendSeconds+" с":"Отправить код ещё раз"}</button>
          <button type="button" className={styles.back} onClick={resetOtp}>← Выбрать другой профиль</button>
        </motion.div>}
      </AnimatePresence>

      {error&&<motion.p className={styles.error} role="alert" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}}>{error}</motion.p>}
      <footer><span>{method==="openid"?"OpenID Connect":"Одноразовый код · 10 минут"}</span></footer>
    </motion.section>
  </motion.main>;
}
