const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "../assets/simulation.js"), "utf8");
const stepsSource = source.slice(source.indexOf("// Small diagrams"), source.indexOf("// The same eight tiles"));
const mergeSource = source.slice(source.indexOf("// The same eight tiles"), source.indexOf("// Live document locks"));
const presenceSource = source.slice(source.indexOf("// Live document locks"));

class Target {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  emit(type, data = {}) { this.listeners.get(type)?.forEach((callback) => callback(data)); }
  dispatchEvent(event) { this.emit(event.type, event); }
}

class Element extends Target {
  attributes = new Map();
  dataset = {};
  hidden = false;
  classes = new Set();
  classList = {
    add: (...names) => names.forEach((name) => this.classes.add(name)),
    remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
  };
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  matches() { return true; }
}

test("step loops pause and resume offscreen, in hidden tabs, and with reduced motion", () => {
  const diagram = new Element();
  const document = new Target();
  document.hidden = false;
  document.querySelectorAll = () => [diagram];
  const preference = new Target();
  preference.matches = false;
  let onIntersection;
  vm.runInNewContext(stepsSource, {
    document,
    window: { IntersectionObserver: true, matchMedia: () => preference },
    IntersectionObserver: class { constructor(callback) { onIntersection = callback; } observe() {} },
  });
  const visible = (inView) => onIntersection([{ target: diagram, isIntersecting: inView, intersectionRatio: inView ? 1 : 0 }]);
  visible(true);
  assert.ok(diagram.classes.has("has-motion"));
  assert.ok(diagram.classes.has("is-playing"));
  visible(false);
  assert.ok(diagram.classes.has("has-motion")); // Keep the CSS animation instance to preserve its position.
  assert.ok(!diagram.classes.has("is-playing"));
  visible(true);
  assert.ok(diagram.classes.has("is-playing"));
  document.hidden = true; document.emit("visibilitychange");
  assert.ok(!diagram.classes.has("is-playing"));
  document.hidden = false; document.emit("visibilitychange");
  assert.ok(diagram.classes.has("is-playing"));
  preference.matches = true; preference.emit("change");
  assert.ok(!diagram.classes.has("is-playing"));
  preference.matches = false; preference.emit("change");
  assert.ok(diagram.classes.has("is-playing"));
});

function mergeDemo(reduced = false) {
  let now = 0;
  let serial = 0;
  let onIntersection;
  const jobs = new Map();
  const schedule = (callback, delay, frame = false) => {
    const id = ++serial;
    jobs.set(id, { callback, at: now + delay, frame });
    return id;
  };
  const advance = (duration) => {
    const until = now + duration;
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      const [id, job] = next;
      jobs.delete(id);
      now = job.at;
      job.callback(now);
    }
    now = until;
  };
  const figure = new Element();
  const canvas = new Element();
  const svg = new Element();
  const assembly = new Element();
  const outline = new Element();
  const readouts = ["scattered", "merged"].map((state) => {
    const element = new Element(); element.dataset.mergeState = state; return element;
  });
  const tiles = Array.from({ length: 8 }, () => {
    const element = new Element();
    element.shape = new Element(); element.querySelector = () => element.shape;
    return element;
  });
  figure.querySelector = () => canvas;
  figure.querySelectorAll = () => readouts;
  canvas.querySelector = () => svg;
  svg.querySelector = (selector) => selector === ".merge-assembly" ? assembly : outline;
  svg.querySelectorAll = () => tiles;
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ matrixTransform() { return { x: this.x, y: this.y }; } });
  const document = new Target();
  document.hidden = false;
  document.getElementById = () => figure;
  const preference = new Target(); preference.matches = reduced;
  const window = new Target();
  window.matchMedia = () => preference;
  window.IntersectionObserver = true;
  window.setTimeout = (callback, delay) => schedule(callback, delay);
  vm.runInNewContext(mergeSource, {
    window, document,
    performance: { now: () => now },
    requestAnimationFrame: (callback) => schedule(callback, 16, true),
    cancelAnimationFrame: (id) => jobs.delete(id),
    clearTimeout: (id) => jobs.delete(id),
    IntersectionObserver: class { constructor(callback) { onIntersection = callback; } observe() {} },
  });
  return {
    figure, canvas, tiles, outline, assembly, readouts, advance,
    view: (visible) => onIntersection([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]),
    hidden: (hidden) => { document.hidden = hidden; document.emit("visibilitychange"); },
    reduce: (matches) => { preference.matches = matches; preference.emit("change"); },
    frames: () => [...jobs.values()].filter((job) => job.frame).length,
  };
}

test("eight existing squares gather for five seconds, pack in place, and scatter with the keyboard", () => {
  const demo = mergeDemo();
  const originalTiles = [...demo.tiles];
  demo.view(true);
  demo.advance(4000);
  assert.equal(demo.figure.dataset.phase, "gathering");
  demo.advance(1800);
  assert.equal(demo.figure.dataset.phase, "merged");
  assert.deepEqual(demo.tiles, originalTiles);
  assert.equal(demo.tiles[0].getAttribute("transform"), "translate(270.00 126.00)");
  assert.equal(demo.tiles[7].getAttribute("transform"), "translate(510.00 206.00)");
  assert.equal(demo.outline.getAttribute("opacity"), "1");
  assert.equal(demo.frames(), 0);
  demo.canvas.emit("click", { detail: 0 });
  demo.advance(800);
  assert.equal(demo.figure.dataset.phase, "scattered");
  assert.equal(demo.tiles[0].getAttribute("transform"), "translate(222.00 110.00)");
  demo.advance(9000);
  assert.equal(demo.figure.dataset.phase, "scattered");
  demo.advance(1200);
  assert.equal(demo.figure.dataset.phase, "gathering");
  demo.advance(5600);
  assert.equal(demo.figure.dataset.phase, "merged");
});

test("offscreen and hidden time do not consume the wait or gathering duration", () => {
  const demo = mergeDemo();
  demo.view(true); demo.advance(3000);
  demo.view(false); demo.advance(20000);
  assert.equal(demo.figure.dataset.phase, "gathering");
  assert.equal(demo.frames(), 0);
  demo.view(true); demo.advance(2800);
  assert.equal(demo.figure.dataset.phase, "merged");
  demo.canvas.emit("click", { detail: 0 }); demo.advance(800);
  demo.hidden(true); demo.advance(20000);
  assert.equal(demo.figure.dataset.phase, "scattered");
  demo.hidden(false); demo.advance(9000);
  assert.equal(demo.figure.dataset.phase, "scattered");
  demo.advance(1200);
  assert.equal(demo.figure.dataset.phase, "gathering");
});

test("only hovering or clicking the large validator activates the interaction", () => {
  const demo = mergeDemo();
  demo.view(true); demo.advance(5800);
  demo.canvas.emit("pointermove", { pointerType: "mouse", clientX: 20, clientY: 20 });
  assert.equal(demo.frames(), 0);
  demo.canvas.emit("click", { detail: 1, clientX: 20, clientY: 20 });
  assert.equal(demo.figure.dataset.phase, "merged");
  demo.canvas.emit("pointermove", { pointerType: "mouse", clientX: 430, clientY: 206 });
  demo.advance(100);
  assert.ok(demo.assembly.getAttribute("transform"));
  demo.canvas.emit("pointerleave");
  assert.equal(demo.frames(), 0);
  assert.equal(demo.assembly.getAttribute("transform"), null);
  demo.canvas.emit("click", { detail: 1, clientX: 430, clientY: 206 });
  assert.equal(demo.figure.dataset.phase, "scattering");
});

test("reduced motion keeps the interaction without tremble or travel", () => {
  const demo = mergeDemo(true);
  demo.view(true);
  assert.equal(demo.figure.dataset.phase, "merged");
  assert.equal(demo.frames(), 0);
  demo.canvas.emit("click", { detail: 0 });
  assert.equal(demo.figure.dataset.phase, "scattered");
  demo.advance(10000);
  assert.equal(demo.figure.dataset.phase, "merged");
  assert.equal(demo.frames(), 0);
  const moving = mergeDemo();
  moving.view(true); moving.advance(2000); moving.reduce(true);
  assert.equal(moving.figure.dataset.phase, "merged");
  assert.equal(moving.frames(), 0);
});

function tabWorld() {
  const held = new Set();
  const channels = new Set();
  const messages = [];
  let serial = 0;
  class Channel extends Target {
    constructor() { super(); channels.add(this); }
    postMessage(data) {
      for (const peer of channels) {
        if (peer !== this) messages.push(() => peer.emit("message", { data }));
      }
    }
    close() { channels.delete(this); }
  }
  const drain = async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
      messages.splice(0).forEach((deliver) => deliver());
    }
  };
  function open() {
    const window = new Target();
    const document = new Target();
    window.top = window;
    window.BroadcastChannel = Channel;
    let slashes = 0;
    window.addEventListener("eip8148:slash", () => { slashes += 1; });
    vm.runInNewContext(presenceSource, {
      window, document, BroadcastChannel: Channel, Event,
      crypto: { randomUUID: () => `tab-${++serial}` },
      navigator: { locks: {
        request: async (name, callback) => {
          held.add(name);
          try { await callback(); } finally { held.delete(name); }
        },
        query: async () => ({ held: [...held].map((name) => ({ name })) }),
      } },
    });
    return {
      slashes: () => slashes,
      close: () => window.emit("pagehide"),
      restore: () => window.emit("pageshow", { persisted: true }),
    };
  }
  return { open, drain, held };
}

test("two live tabs slash each other, including a new pair after the first tab closes", async () => {
  const world = tabWorld();
  const first = world.open(); await world.drain();
  assert.equal(first.slashes(), 0);
  const second = world.open(); await world.drain();
  assert.ok(first.slashes() > 0);
  assert.ok(second.slashes() > 0);
  first.close(); await world.drain();
  const third = world.open(); await world.drain();
  assert.ok(third.slashes() > 0);
  second.close(); third.close(); await world.drain();
  assert.equal(world.held.size, 0);
});

test("closing and reopening alone never slashes, even with queued messages from a closed tab", async () => {
  const world = tabWorld();
  const first = world.open(); await world.drain();
  const transient = world.open();
  transient.close(); // Its hello is queued, but its document is no longer live.
  await world.drain();
  assert.equal(first.slashes(), 0);
  assert.equal(transient.slashes(), 0);
  first.close(); await world.drain();
  for (let index = 0; index < 10; index += 1) {
    const reopened = world.open(); await world.drain();
    assert.equal(reopened.slashes(), 0);
    reopened.close(); await world.drain();
  }
  assert.equal(world.held.size, 0);
});

test("back/forward restoration registers a fresh live presence", async () => {
  const world = tabWorld();
  const first = world.open(); await world.drain();
  first.close(); await world.drain();
  first.restore(); await world.drain();
  assert.equal(first.slashes(), 0);
  const second = world.open(); await world.drain();
  assert.ok(first.slashes() > 0);
  assert.ok(second.slashes() > 0);
  first.close(); second.close(); await world.drain();
});
