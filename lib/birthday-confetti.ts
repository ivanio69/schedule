let stopCurrent: (() => void) | undefined;

// Loaded only for the birthday celebration. One canvas, no idle animation loop.
export function fireBirthdayConfetti(): () => void {
  stopCurrent?.();
  if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.birthdayConfetti = "true";
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "10000" });
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const width = window.innerWidth, height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e3ccff";
  const colors = [accent, "#f5ca78", "#e9a4c2", "#a8d5c4", "#b7b4ed"];
  const particles = Array.from({ length: width < 600 ? 64 : 96 }, (_, i) => ({
    x: i % 2 ? width * .92 : width * .08, y: height * .38,
    vx: (i % 2 ? -1 : 1) * (2 + Math.random() * 6), vy: -5 - Math.random() * 8,
    rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * .18,
    size: 4 + Math.random() * 5, color: colors[i % colors.length],
  }));
  let frame = 0, previous = 0, elapsed = 0, stopped = false;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stop = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); canvas.remove();
    document.removeEventListener("visibilitychange", visibility);
    media.removeEventListener("change", stop);
    window.removeEventListener("pagehide", stop);
    if (stopCurrent === stop) stopCurrent = undefined;
  };
  const visibility = () => { if (document.hidden) stop(); };
  const draw = (time: number) => {
    const step = previous ? Math.min((time - previous) / 16.67, 2) : 1;
    elapsed += previous ? time - previous : 0; previous = time;
    if (elapsed > 3200) { stop(); return; }
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.min(1, (3200 - elapsed) / 650);
    for (const p of particles) {
      p.vx *= Math.pow(.991, step); p.vy += .16 * step;
      p.x += p.vx * step; p.y += p.vy * step; p.rotation += p.spin * step;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
    }
    frame = requestAnimationFrame(draw);
  };
  stopCurrent = stop;
  document.body.appendChild(canvas);
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", stop);
  window.addEventListener("pagehide", stop);
  frame = requestAnimationFrame(draw);
  return stop;
}
