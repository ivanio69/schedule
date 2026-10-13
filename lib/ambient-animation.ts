const TEXTURE_SIZE = 256;
const DOT_SIZE = 24;
const DOT_OFFSETS = [-44, -22, 0, 22, 44];
const random = (min: number, max: number) => min + Math.random() * (max - min);
type Subscribe = (listener: (loading: boolean) => void) => () => void;

export function startAmbientAnimation(root: HTMLElement, subscribe: Subscribe) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(".ambient-spots > span"));
  const models = nodes.map(() => ({
    x: random(-.46, .46), y: random(-.46, .46),
    width: random(.35, .55), height: random(.30, .45),
    dx: random(-.15, .15), dy: random(-.15, .15),
    duration: random(24000, 44000),
  }));
  const animations = new Map<HTMLElement, Animation>();
  const dotAnimations = new Map<HTMLElement, Animation>();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let loading: boolean | undefined;
  let disposed = false;
  let resizeFrame = 0;
  const transform = (x: number, y: number, sx: number, sy: number) =>
    `translate3d(${x}px,${y}px,0) scale(${sx},${sy})`;
  const destination = (index: number, isLoading: boolean, drift = 0) => {
    if (isLoading) return transform(DOT_OFFSETS[index], 0, DOT_SIZE / TEXTURE_SIZE, DOT_SIZE / TEXTURE_SIZE);
    const model = models[index];
    const vmax = Math.max(window.innerWidth, window.innerHeight);
    return transform(
      (model.x + model.dx * drift) * window.innerWidth,
      (model.y + model.dy * drift) * window.innerHeight,
      model.width * vmax / TEXTURE_SIZE, model.height * vmax / TEXTURE_SIZE,
    );
  };
  const remember = (node: HTMLElement, animation: Animation) => {
    animations.set(node, animation);
    if (document.hidden) animation.pause();
  };
  const startLoop = (node: HTMLElement, index: number, isLoading: boolean) => {
    if (disposed || media.matches) return;
    if (isLoading) {
      // Geometry and jumping use independent compositor properties. Start the
      // first jump during the morph, then follow in left-to-right order.
      if (dotAnimations.has(node)) return;
      const bounce = node.animate([
        { translate: "0px 0px", opacity: 1 },
        { translate: "0px -8px", opacity: 1, offset: .28 },
        { translate: "0px 0px", opacity: .72, offset: .55 },
        { translate: "0px 0px", opacity: 1 },
      ], { duration: 680, delay: index * 90, iterations: Infinity, easing: "ease-in-out" });
      dotAnimations.set(node, bounce);
      if (document.hidden) bounce.pause();
    } else {
      remember(node, node.animate([
        { transform: destination(index, false) },
        { transform: destination(index, false, 1), offset: .33 },
        { transform: destination(index, false, -1), offset: .66 },
        { transform: destination(index, false) },
      ], { duration: models[index].duration, iterations: Infinity, easing: "ease-in-out" }));
    }
  };
  const render = (next: boolean, tween: boolean) => {
    root.dataset.loading = String(next);
    nodes.forEach((node, index) => {
      // Read only the five compositor matrices at a loading boundary. Capture
      // before cancelling so an interrupted morph continues from its current frame.
      const style = tween ? getComputedStyle(node) : null;
      const jumpY = style ? parseFloat(style.translate?.split(" ")[1] ?? "0") || 0 : 0;
      const from = style ? `translateY(${jumpY}px) ${style.transform}` : "";
      animations.get(node)?.cancel();
      animations.delete(node);
      dotAnimations.get(node)?.cancel();
      dotAnimations.delete(node);
      node.style.translate = "0px 0px";
      const target = destination(index, next);
      node.style.transform = target;
      node.style.opacity = "1";
      if (next) startLoop(node, index, true);
      if (!tween || media.matches) { startLoop(node, index, next); return; }
      const animation = node.animate([{ transform: from }, { transform: target }],
        { duration: next ? 320 : 460, easing: "cubic-bezier(.22,1,.36,1)" });
      remember(node, animation);
      animation.onfinish = () => {
        if (disposed || animations.get(node) !== animation) return;
        animations.delete(node);
        animation.cancel();
        startLoop(node, index, next);
      };
    });
  };
  const unsubscribe = subscribe(next => {
    if (next === loading) return;
    const tween = loading !== undefined;
    if (loading === true && !next) {
      for (const model of models) { model.x = random(-.46, .46); model.y = random(-.46, .46); }
    }
    loading = next;
    render(next, tween);
  });
  const visibility = () => {
    for (const animation of [...animations.values(), ...dotAnimations.values()]) {
      if (document.hidden) animation.pause(); else animation.play();
    }
  };
  const resize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => render(loading ?? false, false));
  };
  const motionPreference = () => render(loading ?? false, false);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("resize", resize);
  media.addEventListener("change", motionPreference);
  return () => {
    disposed = true;
    unsubscribe();
    cancelAnimationFrame(resizeFrame);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("resize", resize);
    media.removeEventListener("change", motionPreference);
    for (const animation of [...animations.values(), ...dotAnimations.values()]) animation.cancel();
    animations.clear();
    dotAnimations.clear();
  };
}
