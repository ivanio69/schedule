"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const EXIT = {
  opacity: 0,
  y: -7,
  scale: 0.997,
  filter: "blur(1.5px)",
};

const VISIBLE = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
};

export default function AppPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const navigationStarted = useRef(false);
  const lastPathname = useRef(pathname);

  useEffect(() => {
    const interceptInternalLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      // Query/hash-only changes keep their native behavior. usePathname does
      // not change for them, so route-level exit is only used for a real page
      // change where we can reliably reveal the new tree after Next swaps it.
      if (url.pathname === current.pathname) return;

      const destination = `${url.pathname}${url.search}${url.hash}`;
      const currentDestination = `${current.pathname}${current.search}${current.hash}`;
      if (destination === currentDestination) return;

      event.preventDefault();

      if (navigationStarted.current || pendingHref.current) return;

      pendingHref.current = destination;

      if (reduceMotion) {
        navigationStarted.current = true;
        router.push(destination);
        return;
      }

      setLeaving(true);
    };

    document.addEventListener("click", interceptInternalLink, true);
    return () => document.removeEventListener("click", interceptInternalLink, true);
  }, [reduceMotion, router]);

  // The route is changed only after the old page has fully faded out. Once
  // Next swaps the children, reveal the new route from the already-hidden
  // wrapper instead of letting the old DOM disappear abruptly.
  useLayoutEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    pendingHref.current = null;
    navigationStarted.current = false;

    if (reduceMotion) {
      setLeaving(false);
      return;
    }

    const frame = requestAnimationFrame(() => setLeaving(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname, reduceMotion]);

  const finishExit = () => {
    if (!leaving || navigationStarted.current || !pendingHref.current) return;
    navigationStarted.current = true;
    router.push(pendingHref.current);
  };

  return (
    <motion.div
      className="app-page-transition"
      initial={false}
      animate={leaving ? EXIT : VISIBLE}
      transition={
        reduceMotion
          ? { duration: 0 }
          : leaving
            ? { duration: 0.2, ease: [0.4, 0, 1, 1] }
            : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
      }
      onAnimationComplete={finishExit}
      aria-busy={leaving || undefined}
    >
      {children}
    </motion.div>
  );
}
