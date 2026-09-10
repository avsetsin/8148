(() => {
  const mobileMenu = document.querySelector(".mobile-menu");

  if (mobileMenu) {
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        const destination = document.querySelector(link.hash);
        requestAnimationFrame(() => {
          mobileMenu.removeAttribute("open");
          const heading = destination?.querySelector("h2, h3");
          if (!heading) return;
          heading.setAttribute("tabindex", "-1");
          heading.focus({ preventScroll: true });
          heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
        });
      });
    });

    mobileMenu.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenu.open) {
        mobileMenu.open = false;
        mobileMenu.querySelector("summary")?.focus();
      }
    });
  }

  const svg = document.getElementById("sim");
  const picker = svg?.closest(".simulation-viewport");
  const fill = document.getElementById("fill");
  const currentThresholdLine = document.getElementById("thrCurrent");
  const thresholdLine = document.getElementById("thr");
  const thresholdLabel = document.getElementById("thrLabel");
  const thresholdValue = document.getElementById("thrValue");
  const balanceLabel = document.getElementById("balLabel");
  const flight = document.getElementById("flight");
  const thresholdWarning = document.getElementById("thresholdWarning");
  const thresholdWarningClose = document.getElementById("thresholdWarningClose");
  const warningThresholdValue = document.getElementById("warningThresholdValue");

  if (!svg || !picker || !fill || !currentThresholdLine || !thresholdLine || !thresholdLabel || !thresholdValue || !balanceLabel || !flight || !thresholdWarning || !thresholdWarningClose || !warningThresholdValue) return;

  const TOP_Y = 96;
  const BOTTOM_Y = 521;
  const MAX_BALANCE = 2300;
  const MAX_THRESHOLD = 2048;
  const MIN_THRESHOLD = 32;
  const GROWTH_RATE = 0.06;
  const SWEEP_INTERVAL = 0.8;
  const PARTIAL_WITHDRAWAL_DURATION = 0.8;
  const BALANCE_LABEL_INTERVAL = 300;
  const WARNING_EXIT_DURATION = 340;
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let balance = 32;
  let threshold = MAX_THRESHOLD;
  let elapsedSinceSweep = 0;
  let lastFrame = null;
  let lastDisplayedBalance = "";
  let nextBalanceLabelUpdate = 0;
  let animationFrame = 0;
  let warningTransitionTimer = 0;
  let warningDismissFrame = 0;
  let inView = !("IntersectionObserver" in window);
  let running = false;
  let slashed = false;
  let activePointer = null;
  let thresholdTransition = null;
  const coins = [];

  const ethToY = (eth) => BOTTOM_Y - (eth / MAX_BALANCE) * (BOTTOM_Y - TOP_Y);
  const yToEth = (y) => ((BOTTOM_Y - y) / (BOTTOM_Y - TOP_Y)) * MAX_BALANCE;
  const formatEth = (value) => numberFormat.format(value);

  function thresholdPath(value) {
    const y = ethToY(value);
    return `M28 ${y} C 190 ${y - 4}, 430 ${y + 4}, 612 ${y - 2}`;
  }

  function drawThreshold(value) {
    const y = ethToY(value);
    thresholdLine.setAttribute("d", thresholdPath(value));
    thresholdLabel.setAttribute("y", String(Math.max(y - 60, 28)));
    thresholdValue.textContent = `${formatEth(value)} ETH`;
  }

  function syncCommittedThreshold() {
    currentThresholdLine.setAttribute("d", thresholdPath(threshold));
    picker.setAttribute("aria-valuenow", String(threshold));
    picker.setAttribute("aria-valuetext", `${formatEth(threshold)} ETH`);
  }

  function drawBalance(timestamp, forceLabelUpdate = false) {
    const y = ethToY(balance);
    fill.setAttribute("y", String(y));
    fill.setAttribute("height", String(BOTTOM_Y - y));

    if (!forceLabelUpdate && timestamp < nextBalanceLabelUpdate) return;

    balanceLabel.setAttribute("y", String(Math.max(y - 10, 70)));
    nextBalanceLabelUpdate = timestamp + BALANCE_LABEL_INTERVAL;

    const displayedBalance = `${formatEth(Math.floor(balance))} ETH`;
    if (displayedBalance !== lastDisplayedBalance) {
      balanceLabel.textContent = displayedBalance;
      lastDisplayedBalance = displayedBalance;
    }
  }

  function hideThresholdWarning() {
    if (thresholdWarning.hidden || thresholdWarning.classList.contains("is-leaving")) return;
    cancelAnimationFrame(warningDismissFrame);
    document.removeEventListener("click", handlePageClick);
    thresholdWarning.classList.remove("is-visible", "is-processing", "is-complete");
    thresholdWarning.classList.add("is-leaving");
    clearTimeout(warningTransitionTimer);
    warningTransitionTimer = window.setTimeout(() => {
      if (thresholdWarning.classList.contains("is-visible")) return;
      thresholdWarning.hidden = true;
      thresholdWarning.classList.remove("is-leaving");
    }, WARNING_EXIT_DURATION);
  }

  function handlePageClick(event) {
    if (thresholdWarning.contains(event.target)) return;
    hideThresholdWarning();
  }

  function showThresholdWarning(value) {
    clearTimeout(warningTransitionTimer);
    cancelAnimationFrame(warningDismissFrame);
    document.removeEventListener("click", handlePageClick);
    warningThresholdValue.textContent = `${formatEth(value)} ETH`;
    thresholdWarning.hidden = false;
    thresholdWarning.classList.remove("is-visible", "is-leaving", "is-complete");
    thresholdWarning.getBoundingClientRect();
    thresholdWarning.classList.add("is-visible", "is-processing");
    warningDismissFrame = requestAnimationFrame(() => {
      document.addEventListener("click", handlePageClick);
    });
  }

  function completeThresholdWarning() {
    if (thresholdWarning.hidden || thresholdWarning.classList.contains("is-leaving")) return;
    thresholdWarning.classList.remove("is-processing");
    thresholdWarning.classList.add("is-complete");
  }

  function commitThreshold(value) {
    threshold = value;
    syncCommittedThreshold();
    currentThresholdLine.setAttribute("visibility", "hidden");
    drawThreshold(threshold);
  }

  function completePartialWithdrawal() {
    if (!thresholdTransition) return;
    const nextThreshold = thresholdTransition.target;
    balance = nextThreshold;
    thresholdTransition = null;
    commitThreshold(nextThreshold);
    completeThresholdWarning();
  }

  function setThreshold(value) {
    if (slashed || thresholdTransition) return;
    const nextThreshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value)));
    if (nextThreshold === threshold) {
      endCandidate();
      return;
    }

    if (nextThreshold < balance) {
      showThresholdWarning(nextThreshold);

      if (reducedMotion.matches) {
        balance = nextThreshold;
        elapsedSinceSweep = 0;
        drawBalance(performance.now(), true);
        commitThreshold(nextThreshold);
        completeThresholdWarning();
        return;
      }

      thresholdTransition = { target: nextThreshold, startBalance: balance, elapsed: 0 };
      elapsedSinceSweep = 0;
      currentThresholdLine.setAttribute("d", thresholdPath(threshold));
      currentThresholdLine.setAttribute("visibility", "visible");
      drawThreshold(nextThreshold);
      spawnCoin(balance - nextThreshold, balance);
      start();
      return;
    }

    if (!thresholdWarning.hidden) hideThresholdWarning();
    commitThreshold(nextThreshold);
  }

  function valueFromPointer(event) {
    const matrix = svg.getScreenCTM();
    let y;

    if (matrix) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      y = point.matrixTransform(matrix.inverse()).y;
    } else {
      const bounds = svg.getBoundingClientRect();
      y = ((event.clientY - bounds.top) * 580) / bounds.height;
    }

    return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(yToEth(y))));
  }

  function showCandidate(value) {
    if (slashed) return;
    currentThresholdLine.setAttribute("d", thresholdPath(threshold));
    currentThresholdLine.setAttribute("visibility", "visible");
    drawThreshold(value);
  }

  function endCandidate() {
    currentThresholdLine.setAttribute("visibility", "hidden");
    drawThreshold(threshold);
  }

  function spawnCoin(excess, sourceBalance = threshold) {
    const startY = ethToY(sourceBalance);
    const element = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    const radius = 5 + Math.min(8, excess / 40);
    element.classList.add("flight-coin");
    element.setAttribute("rx", String(radius));
    element.setAttribute("ry", String(radius * 0.92));
    flight.appendChild(element);
    coins.push({ element, progress: 0, startY, controlY: Math.max(startY - 130, 56) });
  }

  function updateCoins(delta) {
    for (let index = coins.length - 1; index >= 0; index -= 1) {
      const coin = coins[index];
      coin.progress += delta / 0.8;

      if (coin.progress >= 1) {
        coin.element.remove();
        coins.splice(index, 1);
        continue;
      }

      const progress = coin.progress;
      const remaining = 1 - progress;
      coin.element.setAttribute("cx", String(remaining * remaining * 150 + 2 * remaining * progress * 340 + progress * progress * 520));
      coin.element.setAttribute("cy", String(remaining * remaining * coin.startY + 2 * remaining * progress * coin.controlY + progress * progress * 244));
    }
  }

  function frame(timestamp) {
    if (!running) return;
    if (lastFrame === null) lastFrame = timestamp;

    const delta = Math.min((timestamp - lastFrame) / 1000, 0.1);
    lastFrame = timestamp;
    let swept = false;

    if (thresholdTransition) {
      thresholdTransition.elapsed += delta;
      const progress = Math.min(thresholdTransition.elapsed / PARTIAL_WITHDRAWAL_DURATION, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      balance = thresholdTransition.startBalance + (thresholdTransition.target - thresholdTransition.startBalance) * easedProgress;

      if (progress >= 1) {
        completePartialWithdrawal();
        swept = true;
      }
    } else {
      balance = Math.min(balance * Math.exp(GROWTH_RATE * delta), MAX_BALANCE);
      elapsedSinceSweep += delta;

      if (elapsedSinceSweep >= SWEEP_INTERVAL) {
        elapsedSinceSweep %= SWEEP_INTERVAL;
        if (balance > threshold) {
          const excess = balance - threshold;
          balance = threshold;
          spawnCoin(excess);
          swept = true;
        }
      }
    }

    drawBalance(timestamp, swept);
    updateCoins(delta);
    animationFrame = requestAnimationFrame(frame);
  }

  function start() {
    if (slashed || running || reducedMotion.matches || !inView || document.hidden || !document.hasFocus()) return;
    running = true;
    lastFrame = null;
    animationFrame = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
  }

  function syncMotionPreference() {
    if (slashed) return;
    if (reducedMotion.matches) {
      stop();
      coins.forEach((coin) => coin.element.remove());
      coins.length = 0;
      if (thresholdTransition) {
        completePartialWithdrawal();
        drawBalance(performance.now(), true);
      }
    } else {
      start();
    }
  }

  picker.classList.add("is-interactive");
  picker.setAttribute("role", "slider");
  picker.setAttribute("tabindex", "0");
  picker.setAttribute("aria-label", "Sweep threshold");
  picker.setAttribute("aria-orientation", "vertical");
  picker.setAttribute("aria-valuemin", String(MIN_THRESHOLD));
  picker.setAttribute("aria-valuemax", String(MAX_THRESHOLD));
  picker.setAttribute("aria-describedby", "simulation-help");

  picker.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || thresholdTransition) return;
    showCandidate(valueFromPointer(event));
  });

  picker.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    activePointer = null;
    if (!thresholdTransition) endCandidate();
  });

  picker.addEventListener("pointerdown", (event) => {
    if (slashed || thresholdTransition || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, type: event.pointerType };
  });

  picker.addEventListener("pointerup", (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - activePointer.x, event.clientY - activePointer.y);
    const duration = event.timeStamp - activePointer.time;
    const pointerType = activePointer.type;
    const tapDistance = pointerType === "touch" ? 12 : 8;
    activePointer = null;

    if (distance <= tapDistance && (pointerType !== "touch" || duration <= 600)) {
      setThreshold(valueFromPointer(event));
      if (pointerType !== "touch") picker.focus({ preventScroll: true });
    }

    if (pointerType === "touch" && !thresholdTransition) {
      endCandidate();
    }
  });

  picker.addEventListener("pointercancel", () => {
    activePointer = null;
    if (!thresholdTransition) endCandidate();
  });

  picker.addEventListener("keydown", (event) => {
    if (slashed) return;
    const selectedThreshold = thresholdTransition?.target ?? threshold;
    const changes = {
      ArrowUp: selectedThreshold + 1,
      ArrowRight: selectedThreshold + 1,
      ArrowDown: selectedThreshold - 1,
      ArrowLeft: selectedThreshold - 1,
      PageUp: selectedThreshold + 32,
      PageDown: selectedThreshold - 32,
      Home: MIN_THRESHOLD,
      End: MAX_THRESHOLD,
    };

    if (!(event.key in changes)) return;
    event.preventDefault();
    if (thresholdTransition) return;
    endCandidate();
    setThreshold(changes[event.key]);
  });

  picker.addEventListener("blur", () => {
    if (!thresholdTransition) endCandidate();
  });

  window.addEventListener("eip8148:slash", () => {
    if (slashed) return;
    slashed = true;
    stop();
    activePointer = null;
    thresholdTransition = null;
    coins.forEach((coin) => coin.element.remove());
    coins.length = 0;
    cancelAnimationFrame(warningDismissFrame);
    clearTimeout(warningTransitionTimer);
    document.removeEventListener("click", handlePageClick);
    thresholdWarning.hidden = true;
    thresholdWarning.classList.remove("is-visible", "is-leaving", "is-processing", "is-complete");
    endCandidate();
    drawBalance(performance.now(), true);
    fill.setAttribute("fill", "#FFC9C9");
    picker.classList.remove("is-interactive");
    picker.classList.add("is-slashed");
    picker.setAttribute("aria-disabled", "true");
    picker.setAttribute("aria-describedby", "slashingNotice");
    document.getElementById("slashingNotice").hidden = false;
  });

  thresholdWarningClose.addEventListener("click", hideThresholdWarning);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !thresholdWarning.hidden) hideThresholdWarning();
  });

  document.getElementById("staticBits")?.remove();
  balanceLabel.setAttribute("visibility", "visible");
  syncCommittedThreshold();
  drawThreshold(threshold);
  drawBalance(performance.now(), true);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    }, { threshold: 0.05 });
    observer.observe(svg);
  } else {
    start();
  }

  reducedMotion.addEventListener?.("change", syncMotionPreference);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("blur", stop);
  window.addEventListener("focus", start);
  syncMotionPreference();
})();

// Small diagrams loop while visible; pausing preserves their place in the cycle.
(() => {
  const diagrams = [...document.querySelectorAll("[data-story-motion]")];
  if (!diagrams.length || !("IntersectionObserver" in window)) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const records = new Map(diagrams.map((diagram) => [diagram, { diagram, inView: false }]));

  function sync(record) {
    const playing = record.inView && !document.hidden && !reducedMotion.matches;
    if (playing) record.diagram.classList.add("has-motion");
    record.diagram.classList.toggle("is-playing", playing);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const record = records.get(entry.target);
      record.inView = entry.isIntersecting && entry.intersectionRatio >= 0.3;
      sync(record);
    });
  }, { threshold: [0, 0.3] });
  diagrams.forEach((diagram) => observer.observe(diagram));
  document.addEventListener("visibilitychange", () => records.forEach(sync));
  reducedMotion.addEventListener?.("change", () => records.forEach(sync));
})();

// The same eight tiles pack into one validator, then scatter on interaction.
(() => {
  const figure = document.getElementById("consolidation");
  if (!figure) return;
  const canvas = figure.querySelector(".consolidation-canvas");
  const svg = canvas.querySelector("svg");
  const assembly = svg.querySelector(".merge-assembly");
  const outline = svg.querySelector(".merge-frame");
  const readouts = [...figure.querySelectorAll("[data-merge-state]")];
  const tiles = [...svg.querySelectorAll(".merge-tile")].map((element, index) => ({
    element,
    shape: element.querySelector("path"),
    looseX: 222 + (index % 4) * 112,
    looseY: 110 + Math.floor(index / 4) * 112,
    packedX: 270 + (index % 4) * 80,
    packedY: 126 + Math.floor(index / 4) * 80,
  }));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const GATHER_MS = 5000;
  const MERGE_MS = 550;
  const SCATTER_MS = 650;
  const WAIT_MS = 10000;
  let phase = "scattered";
  let inView = !("IntersectionObserver" in window);
  let started = false;
  let elapsed = 0;
  let lastFrame = null;
  let frameId = 0;
  let waitTimer = 0;
  let waitStarted = 0;
  let waitRemaining = WAIT_MS;
  let hovered = false;
  let focused = false;

  const active = () => inView && !document.hidden;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const easeBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  const looseShape = [2, 3, 23, 1, 53, 4, 78, 2, 80, 23, 77, 55, 79, 78, 54, 80, 27, 77, 2, 79, 0, 55, 3, 26, 2, 3];
  // Half a pixel of overlap keeps the packed tiles free of antialiasing seams.
  const packedShape = [0, 0, 26, 0, 54, 0, 80.5, 0, 80.5, 26, 80.5, 54, 80.5, 80.5, 54, 80.5, 26, 80.5, 0, 80.5, 0, 54, 0, 26, 0, 0];

  function draw(pack, jitter = 0) {
    const solid = Math.max(0, Math.min(1, pack));
    const shape = looseShape.map((value, index) => (value + (packedShape[index] - value) * solid).toFixed(2));
    const path = `M${shape.slice(0, 2).join(" ")}C${shape.slice(2, 8).join(" ")}C${shape.slice(8, 14).join(" ")}C${shape.slice(14, 20).join(" ")}C${shape.slice(20).join(" ")}Z`;
    tiles.forEach((tile, index) => {
      const seed = index * 2.31;
      const dx = Math.sin(elapsed * 0.073 + seed) * jitter;
      const dy = Math.sin(elapsed * 0.091 + seed * 1.7) * jitter * 0.65;
      const x = tile.looseX + (tile.packedX - tile.looseX) * pack + dx;
      const y = tile.looseY + (tile.packedY - tile.looseY) * pack + dy;
      tile.element.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      tile.shape.setAttribute("d", path);
      tile.shape.setAttribute("stroke-opacity", String(1 - solid));
    });
    outline.setAttribute("opacity", String(solid));
  }

  function setPhase(next) {
    phase = next;
    elapsed = 0;
    figure.dataset.phase = next;
    const merged = next === "merged";
    readouts.forEach((readout) => {
      readout.hidden = readout.dataset.mergeState !== (merged ? "merged" : "scattered");
    });
    canvas.setAttribute("aria-disabled", String(!merged));
    canvas.classList.toggle("is-hovered", merged && hovered);
    assembly.removeAttribute("transform");
  }

  function pause() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = null;
    if (waitTimer) {
      clearTimeout(waitTimer);
      waitTimer = 0;
      waitRemaining = Math.max(0, waitRemaining - (performance.now() - waitStarted));
    }
  }

  function gather() {
    if (reducedMotion.matches) {
      setPhase("merged");
      draw(1);
    } else {
      setPhase("gathering");
      resume();
    }
  }

  function frame(timestamp) {
    frameId = 0;
    if (!active()) return;
    if (lastFrame !== null) elapsed += Math.min(timestamp - lastFrame, 80);
    lastFrame = timestamp;

    if (phase === "gathering") {
      const progress = Math.min(elapsed / GATHER_MS, 1);
      draw(0, 0.25 + 4.25 * progress ** 2);
      if (progress === 1) setPhase("merging");
    } else if (phase === "merging") {
      const progress = Math.min(elapsed / MERGE_MS, 1);
      draw(easeOut(progress));
      if (progress === 1) setPhase("merged");
    } else if (phase === "scattering") {
      const progress = Math.min(elapsed / SCATTER_MS, 1);
      draw(1 - easeBack(progress));
      if (progress === 1) {
        setPhase("scattered");
        waitRemaining = WAIT_MS;
      }
    } else if (phase === "merged" && (hovered || focused)) {
      const shake = Math.sin(elapsed * 0.065) * 1.1;
      assembly.setAttribute("transform", `translate(${shake.toFixed(2)} 0) rotate(${(shake * 0.18).toFixed(2)} 430 206)`);
    }
    resume();
  }

  function resume() {
    if (!active()) return;
    if (!started) {
      started = true;
      gather();
      return;
    }
    if (phase === "scattered") {
      if (!waitTimer) {
        waitStarted = performance.now();
        waitTimer = window.setTimeout(() => {
          waitTimer = 0;
          gather();
        }, waitRemaining);
      }
      return;
    }
    if (reducedMotion.matches || (phase === "merged" && !hovered && !focused)) {
      lastFrame = null;
      return;
    }
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  function hitValidator(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return false;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return local.x >= 250 && local.x <= 610 && local.y >= 80 && local.y <= 290;
  }

  canvas.addEventListener("pointermove", (event) => {
    hovered = event.pointerType !== "touch" && hitValidator(event);
    canvas.classList.toggle("is-hovered", phase === "merged" && hovered);
    if (!hovered) assembly.removeAttribute("transform");
    resume();
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = false;
    canvas.classList.remove("is-hovered");
    assembly.removeAttribute("transform");
    if (phase === "merged" && !focused) pause();
  });
  canvas.addEventListener("focus", () => { focused = canvas.matches(":focus-visible"); resume(); });
  canvas.addEventListener("blur", () => {
    focused = false;
    if (phase === "merged" && !hovered) pause();
    assembly.removeAttribute("transform");
  });
  canvas.addEventListener("click", (event) => {
    if (phase !== "merged" || (event.detail !== 0 && !hitValidator(event))) return;
    pause();
    hovered = false;
    if (reducedMotion.matches) {
      setPhase("scattered");
      draw(0);
      waitRemaining = WAIT_MS;
    } else {
      setPhase("scattering");
    }
    resume();
  });

  figure.classList.add("is-interactive");
  canvas.disabled = false;
  setPhase("scattered");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.3;
      if (inView) resume();
      else pause();
    }, { threshold: [0, 0.3] });
    observer.observe(canvas);
  } else {
    resume();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });
  reducedMotion.addEventListener?.("change", () => {
    pause();
    if (reducedMotion.matches && phase !== "scattered") {
      setPhase("merged");
      draw(1);
    }
    resume();
  });
})();

// Live document locks prevent stale messages from slashing a later, lone tab.
// Nothing is persisted: closing, navigating away, or crashing releases the lock.
(() => {
  if (window.top !== window || !window.BroadcastChannel || !navigator.locks?.request || !navigator.locks?.query) return;
  const prefix = "eip8148:live-validator:";
  const id = crypto.randomUUID();
  let channel = null;
  let releaseLock = null;
  let generation = 0;

  function startPresence() {
    if (channel) return;
    const current = ++generation;
    const liveChannel = new BroadcastChannel("eip8148:validator-tabs");
    channel = liveChannel;

    async function checkPeer(peer, confirm = false) {
      try {
        const { held } = await navigator.locks.query();
        if (generation !== current || channel !== liveChannel) return;
        const names = new Set(held.map((lock) => lock.name));
        if (names.has(prefix + id) && names.has(prefix + peer)) {
          if (confirm) liveChannel.postMessage({ kind: "confirmed", id, to: peer });
          window.dispatchEvent(new Event("eip8148:slash"));
        }
      } catch { /* Unsupported or restricted coordination leaves the demo alone. */ }
    }

    liveChannel.addEventListener("message", ({ data }) => {
      if (generation !== current || channel !== liveChannel) return;
      if (!data || typeof data.id !== "string" || data.id === id) return;
      if (data.kind === "hello") {
        liveChannel.postMessage({ kind: "present", id, to: data.id });
      } else if (data.kind === "present" && data.to === id) {
        checkPeer(data.id, true);
      } else if (data.kind === "confirmed" && data.to === id) {
        checkPeer(data.id);
      }
    });

    navigator.locks.request(prefix + id, () => {
      if (generation !== current) return;
      return new Promise((resolve) => {
        releaseLock = resolve;
        liveChannel.postMessage({ kind: "hello", id });
      });
    }).catch(() => {
      if (generation === current) stopPresence();
    });
  }

  function stopPresence() {
    generation += 1;
    channel?.close();
    channel = null;
    releaseLock?.();
    releaseLock = null;
  }

  window.addEventListener("pagehide", stopPresence);
  window.addEventListener("pageshow", (event) => { if (event.persisted) startPresence(); });
  startPresence();
})();
