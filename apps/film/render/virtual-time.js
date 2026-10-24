// Injected before the film loads when rendering. Time stops: the clock, timers, animation frames and every CSS or
// Web Animations API animation only move when the renderer calls __advance(ms), so each frame is exactly 1/fps later
// than the last however long the screenshot took. The product's own motion (springs, fades, streaming text) plays
// as it does in the app, frame-perfect.
(() => {
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;
  const epoch = RealDate.UTC(2026, 9, 21, 7, 2, 0);
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  let frames = new Map();

  performance.now = () => now;
  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(epoch + now);
      else super(...args);
    }
    static now() {
      return epoch + now;
    }
  }
  window.Date = VirtualDate;

  const call = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (err) {
      console.error(err);
    }
  };
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);

  const tick = () => new Promise((resolve) => realSetTimeout(resolve, 0));
  const born = new WeakMap();
  const finished = new WeakSet();

  /** Every animation on the page, paused and set to how long it has existed in film time. */
  function syncAnimations() {
    for (const a of document.getAnimations()) {
      if (finished.has(a)) continue;
      if (!born.has(a)) born.set(a, now);
      const age = (now - born.get(a)) * (a.playbackRate || 1);
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(end) && age >= end) {
        finished.add(a);
        try {
          a.finish();
        } catch {
          a.cancel();
        }
        continue;
      }
      if (a.playState !== "paused") a.pause();
      a.currentTime = Math.max(0, age);
    }
  }

  window.__advance = async (ms) => {
    const target = now + ms;
    for (let guard = 0; guard < 20000; guard++) {
      let id = null;
      let due = null;
      for (const [k, t] of timers) if (t.at <= target && (!due || t.at < due.at)) [id, due] = [k, t];
      if (!due) break;
      now = Math.max(now, due.at);
      if (due.every) due.at += due.every;
      else timers.delete(id);
      call(due.fn, due.args);
      await Promise.resolve();
    }
    now = target;
    await tick();
    const run = frames;
    frames = new Map();
    for (const fn of run.values()) call(fn, [now]);
    await tick();
    await tick();
    syncAnimations();
    await tick();
    syncAnimations();
    return now;
  };
  window.__virtualTime = true;
})();
