"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoadingState from "@/components/LoadingState";

type RuntimeError={id:string;source:string;code:string;message:string;detail?:string;count:number;lastSeenAt:string};
type NativeState={
  ready:boolean;
  busy:boolean;
  label:string;
  detail?:string;
  error?:{source:string;code:string;message:string;detail?:string}|null;
};
type BridgeWindow=Window & {
  webkit?:{messageHandlers?:{scheduleWidget?:{postMessage:(payload:unknown)=>void}}};
  __scheduleNativeState?:NativeState;
};

const sourceLabel=(source:string)=>({
  ios:"iOS",webview:"WebView",widget:"WidgetKit",activitykit:"ActivityKit",web:"Сайт",
}[source]??source);

export default function AppRuntimeStatus(){
  const [native,setNative]=useState<NativeState|null>(null);
  const [nativeMode,setNativeMode]=useState(false);
  const [errors,setErrors]=useState<RuntimeError[]>([]);
  const reported=useRef(new Set<string>());

  const loadErrors=useCallback(async()=>{
    try{
      const response=await fetch("/api/client-errors",{cache:"no-store"});
      if(!response.ok)return;
      const payload=await response.json();
      setErrors(Array.isArray(payload.errors)?payload.errors:[]);
    }catch{}
  },[]);

  useEffect(()=>{
    const win=window as BridgeWindow;
    const bridge=win.webkit?.messageHandlers?.scheduleWidget;
    if(!bridge)return;
    setNativeMode(true);
    if(win.__scheduleNativeState)setNative(win.__scheduleNativeState);

    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<NativeState>).detail;
      if(!detail)return;
      setNative(detail);
      if(detail.error)window.setTimeout(()=>void loadErrors(),350);
    };
    window.addEventListener("schedule-native-state",handler as EventListener);
    bridge.postMessage({type:"bridge-ready"});

    const timeout=window.setTimeout(()=>{
      setNative(current=>current??{
        ready:true,busy:false,label:"Приложение открыто",
        error:{source:"webview",code:"native.bridge.timeout",message:"Не удалось получить состояние iOS-интеграции"},
      });
    },12000);

    return()=>{
      window.clearTimeout(timeout);
      window.removeEventListener("schedule-native-state",handler as EventListener);
    };
  },[loadErrors]);

  useEffect(()=>{
    void loadErrors();
    const timer=window.setInterval(()=>void loadErrors(),60000);
    return()=>window.clearInterval(timer);
  },[loadErrors]);

  useEffect(()=>{
    const report=(code:string,message:string,detail?:string)=>{
      const key=code+"|"+message;
      if(reported.current.has(key))return;
      reported.current.add(key);
      void fetch("/api/client-errors",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({source:"web",code,message,detail,path:location.pathname}),
        keepalive:true,
      }).finally(()=>window.setTimeout(()=>reported.current.delete(key),15000));
    };
    const onError=(event:ErrorEvent)=>{
      if(!event.message||event.message.includes("ResizeObserver loop"))return;
      report("web.error",event.message,event.error instanceof Error?event.error.stack:undefined);
    };
    const onRejection=(event:PromiseRejectionEvent)=>{
      const reason=event.reason;
      const message=reason instanceof Error?reason.message:String(reason??"Unhandled promise rejection");
      report("web.unhandledrejection",message,reason instanceof Error?reason.stack:undefined);
    };
    window.addEventListener("error",onError);
    window.addEventListener("unhandledrejection",onRejection);
    return()=>{
      window.removeEventListener("error",onError);
      window.removeEventListener("unhandledrejection",onRejection);
    };
  },[]);

  const dismiss=async()=>{
    await fetch("/api/client-errors",{method:"DELETE",cache:"no-store"}).catch(()=>null);
    setErrors([]);
  };

  return <>
    {nativeMode&&native&&!native.ready
      ?<LoadingState screen label={native.label||"Загружаем приложение"} detail={native.detail||"Подготавливаем виджет и актуальные данные."}/>
      :null}
    {errors.length?<aside className="runtime-error-panel" aria-live="polite">
      <div className="runtime-error-panel-head">
        <div><strong>Ошибки приложения</strong><span>{errors.length===1?"1 активная ошибка":`${errors.length} активных ошибок`}</span></div>
        <button type="button" onClick={()=>void dismiss()}>Скрыть</button>
      </div>
      <div className="runtime-error-list">{errors.slice(0,3).map(error=><article key={error.id}>
        <span className="runtime-error-source">{sourceLabel(error.source)}</span>
        <div><strong>{error.message}</strong><small>{error.code}{error.count>1?` · ×${error.count}`:""}</small>{error.detail?<p>{error.detail}</p>:null}</div>
      </article>)}</div>
    </aside>:null}
  </>;
}
