"use client";

import { useEffect } from "react";
import type { Person } from "@/lib/people";

export default function RehearsalPeoplePicker() {
  useEffect(() => {
    let cancelled = false;

    fetch("/api/people", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const people: Person[] = data.people ?? [];

        const mount = () => {
          const input = document.querySelector<HTMLInputElement>(
            ".rehearsal-participants input",
          );
          if (!input || document.querySelector(".rehearsal-people-picker")) return;

          input.style.display = "none";
          const wrap = document.createElement("div");
          wrap.className = "rehearsal-people-picker";

          const readSelected = () =>
            input.value
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);

          const writeSelected = (names: string[]) => {
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )?.set;
            setter?.call(input, names.join(", "));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };

          const refresh = () => {
            const selected = new Set(readSelected());
            wrap.querySelectorAll<HTMLButtonElement>("button[data-person]").forEach(
              (button) =>
                button.classList.toggle(
                  "is-selected",
                  selected.has(button.dataset.person ?? ""),
                ),
            );
            const all = wrap.querySelector<HTMLButtonElement>("button[data-all]");
            all?.classList.toggle(
              "is-selected",
              people.length > 0 && people.every((person) => selected.has(person.name)),
            );
          };

          const allButton = document.createElement("button");
          allButton.type = "button";
          allButton.textContent = "ВСЕ";
          allButton.className = "rehearsal-person-chip rehearsal-person-chip--all";
          allButton.dataset.all = "true";
          allButton.onclick = () => {
            const selected = readSelected();
            const everyoneSelected = people.every((person) => selected.includes(person.name));
            writeSelected(everyoneSelected ? [] : people.map((person) => person.name));
            refresh();
          };
          wrap.appendChild(allButton);

          people.forEach((person) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = person.name;
            button.className = "rehearsal-person-chip";
            button.dataset.person = person.name;
            button.onclick = () => {
              const selected = readSelected();
              const next = selected.includes(person.name)
                ? selected.filter((name) => name !== person.name)
                : [...selected, person.name];
              writeSelected(next);
              refresh();
            };
            wrap.appendChild(button);
          });

          input.parentElement?.appendChild(wrap);
          refresh();
        };

        mount();
        const observer = new MutationObserver(mount);
        observer.observe(document.body, { childList: true, subtree: true });
        const timer = window.setTimeout(() => observer.disconnect(), 120000);
        return () => {
          observer.disconnect();
          window.clearTimeout(timer);
        };
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <style jsx global>{`
      .rehearsal-people-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
      .rehearsal-person-chip{padding:7px 10px;border:1px solid #303036;border-radius:999px;color:#aaa;background:#111114;cursor:pointer;font-size:11px;transition:.16s ease}
      .rehearsal-person-chip:hover,.rehearsal-person-chip.is-selected{color:#111;background:#f2f2f2;border-color:#f2f2f2}
      .rehearsal-person-chip--all{font-weight:800}
    `}</style>
  );
}
