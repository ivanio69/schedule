"use client";

import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

// Wait for the real page/card entrance animations, including delayed CSS cards
// and the route wrapper. Task animations and looping indicators are excluded.
export function useEntranceComplete(root: RefObject<HTMLElement | null>, key: string, enabled: boolean) {
  const reducedMotion = useReducedMotion();
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || reducedMotion) return;
    let cancelled = false;
    let completed = false;
    let frame = 0;
    const reveal = () => {
      if (cancelled || completed) return;
      completed = true;
      window.clearTimeout(fallback);
      cancelAnimationFrame(frame);
      setCompletedKey(key);
    };
    // Animation inspection is an enhancement, never a prerequisite for seeing
    // content. Some browsers can fail inspection or leave finished pending.
    const fallback = window.setTimeout(reveal, 700);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try {
          const element = root.current;
          if (!element) return;
          const animations = new Set(element.getAnimations?.({ subtree: true }) ?? []);
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            for (const animation of ancestor.getAnimations?.() ?? []) animations.add(animation);
          }
          const entrance = [...animations].filter(animation => {
            const effect = animation.effect as KeyframeEffect | null;
            const target = effect?.target;
            return animation.playState === "running"
              && effect?.getComputedTiming().endTime !== Infinity
              && !(target instanceof Element && target.closest("[data-tasks-block]"));
          });
          void Promise.allSettled(entrance.map(animation => animation.finished)).then(reveal);
        } catch {
          // Keep the bounded fallback when an animation API is unsupported.
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [root, key, enabled, reducedMotion]);
  return enabled && (reducedMotion || completedKey === key);
}
