"use client";

import { useEffect } from "react";
import type { Person } from "@/lib/people";

export default function RehearsalPeoplePicker() {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/people", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (cancelled) return;
      const people: Person[] = data.people ?? [];
      const mount = () => {
        const input = document.querySelector<HTMLInputElement>(".rehearsal-participants input");
        if (!input || document.querySelector(".rehearsal-people-picker")) return;
        input.style.display = "none";
        const wrap = document.createElement("div"); wrap.className = "rehearsal-people-picker";
        const selected = () => input.value.split(",").map(x=>x.trim()).filter(Boolean);
        people.forEach(person => {
          const button = document.createElement("button"); button.type="button"; button.textContent=person.name; button.className="rehearsal-person-chip";
          button.onclick=()=>{ const values=selected(); const next=values.includes(person.name)?values.filter(x=>x!==person.name):[...values,person.name]; input.value=next.join(", "); input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true})); button.classList.toggle("is-selected",next.includes(person.name)); };
          wrap.appendChild(button);
        });
        input.parentElement?.appendChild(wrap);
      };
      mount();
      const observer=new MutationObserver(mount); observer.observe(document.body,{childList:true,subtree:true});
      setTimeout(()=>observer.disconnect(),30000);
    });
    return ()=>{cancelled=true};
  }, []);
  return <style jsx global>{`.rehearsal-people-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.rehearsal-person-chip{padding:7px 10px;border:1px solid #303036;border-radius:999px;color:#aaa;background:#111114;cursor:pointer;font-size:11px}.rehearsal-person-chip:hover,.rehearsal-person-chip.is-selected{color:#111;background:#f2f2f2;border-color:#f2f2f2}`}</style>;
}
