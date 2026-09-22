"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./login.module.css";

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
  const[ready,setReady]=useState(false);

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
        localStorage.setItem("schedule_person_id",data.person.id);
        window.dispatchEvent(new Event("schedule-auth-change"));
        setSuccess(true);
        await new Promise(resolve=>window.setTimeout(resolve,reducedMotion?80:480));
        window.location.replace(next);
      }).catch(()=>{setError("Не удалось завершить вход. Попробуй ещё раз.");setReady(true)});
      return;
    }
    setReady(true);
  },[reducedMotion]);

  const startUrl="/api/auth/openid/start?next="+encodeURIComponent(nextPath);

  return <motion.main className={styles.page} animate={success&&!reducedMotion?{backgroundColor:"rgba(0,0,0,.2)"}:{}} transition={{duration:.32}}>
    <motion.div className={styles.glow} aria-hidden="true" animate={success&&!reducedMotion?{scale:1.14,opacity:.3}:{scale:1,opacity:1}} transition={{duration:.48}}/>
    <AnimatePresence>{success&&<motion.div className={styles.loginSuccess} initial={reducedMotion?false:{opacity:0,scale:.88,filter:"blur(12px)"}} animate={{opacity:1,scale:1,filter:"blur(0px)"}}><span>✓</span><strong>Вход выполнен</strong><small>Telegram подтвердил аккаунт</small></motion.div>}</AnimatePresence>

    <motion.section className={styles.shell} initial={reducedMotion?false:{opacity:0,y:28,scale:.97,filter:"blur(12px)"}} animate={success&&!reducedMotion?{opacity:0,y:-12,scale:.96,filter:"blur(16px)"}:{opacity:1,y:0,scale:1,filter:"blur(0px)"}} transition={{duration:success?.36:.46,ease:[.22,1,.36,1]}}>
      <header className={styles.head}>
        <motion.div className={styles.mark} initial={reducedMotion?false:{scale:.78,rotate:-6,opacity:0}} animate={{scale:1,rotate:0,opacity:1}} transition={{delay:.08,duration:.4,ease:[.22,1,.36,1]}}>214Р</motion.div>
        <motion.div initial={reducedMotion?false:{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:.13,duration:.38}}>
          <span>РАСПИСАНИЕ</span>
          <h1>Вход</h1>
        </motion.div>
      </header>

      <motion.div className={styles.content} initial={reducedMotion?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.19,duration:.4}}>
        <p className={styles.lead}>Подтверди аккаунт через Telegram. Приложение получит только данные профиля, необходимые для входа, и сопоставит имя пользователя с твоим профилем.</p>

        <div className={styles.openIdCard}>
          <div className={styles.telegramIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 4 3.8 10.6c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.1c.2.7.1 1 .9 1 .6 0 .9-.3 1.2-.6l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8L22.8 5c.3-1.2-.5-1.7-1.8-1Z"/></svg></div>
          <div><strong>Telegram OpenID</strong><span>Стандартный OpenID Connect · PKCE</span></div>
        </div>

        <a className={styles.telegramButton+" "+(!ready?styles.disabled:"")} href={ready?startUrl:undefined}>Войти через Telegram <b>↗</b></a>
        <p className={styles.securityNote}>Пароли и коды приложение не запрашивает — подтверждение проходит на стороне Telegram.</p>
      </motion.div>

      {error&&<motion.p className={styles.error} role="alert" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}}>{error}</motion.p>}
      <footer><span>OpenID Connect</span><span>Доступ только после подтверждения Telegram</span></footer>
    </motion.section>
  </motion.main>;
}
