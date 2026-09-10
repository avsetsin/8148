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

  if (!svg || !picker || !fill || !currentThresholdLine || !thresholdLine || !thresholdLabel || !thresholdValue || !balanceLabel || !flight) return;

  const TOP_Y = 96;
  const BOTTOM_Y = 521;
  const MAX_BALANCE = 2300;
  const MAX_THRESHOLD = 2048;
  const MIN_THRESHOLD = 32;
  const GROWTH_RATE = 0.06;
  const SWEEP_INTERVAL = 0.8;
  const BALANCE_LABEL_INTERVAL = 300;
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let balance = 32;
  let threshold = MAX_THRESHOLD;
  let elapsedSinceSweep = 0;
  let lastFrame = null;
  let lastDisplayedBalance = "";
  let nextBalanceLabelUpdate = 0;
  let animationFrame = 0;
  let inView = !("IntersectionObserver" in window);
  let running = false;
  let activePointer = null;
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

  function setThreshold(value) {
    const nextThreshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value)));
    if (nextThreshold === threshold) return;
    threshold = nextThreshold;
    syncCommittedThreshold();
    drawThreshold(threshold);
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
    currentThresholdLine.setAttribute("d", thresholdPath(threshold));
    currentThresholdLine.setAttribute("visibility", "visible");
    drawThreshold(value);
  }

  function endCandidate() {
    currentThresholdLine.setAttribute("visibility", "hidden");
    drawThreshold(threshold);
  }

  function spawnCoin(excess) {
    const startY = ethToY(threshold);
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
    balance = Math.min(balance * Math.exp(GROWTH_RATE * delta), MAX_BALANCE);
    elapsedSinceSweep += delta;
    let swept = false;

    if (elapsedSinceSweep >= SWEEP_INTERVAL) {
      elapsedSinceSweep %= SWEEP_INTERVAL;
      if (balance > threshold) {
        const excess = balance - threshold;
        balance = threshold;
        spawnCoin(excess);
        swept = true;
      }
    }

    drawBalance(timestamp, swept);
    updateCoins(delta);
    animationFrame = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reducedMotion.matches || !inView || document.hidden || !document.hasFocus()) return;
    running = true;
    lastFrame = null;
    animationFrame = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
  }

  function syncMotionPreference() {
    if (reducedMotion.matches) stop();
    else start();
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
    if (event.pointerType === "touch") return;
    showCandidate(valueFromPointer(event));
  });

  picker.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    activePointer = null;
    endCandidate();
  });

  picker.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
    if (event.pointerType === "touch") showCandidate(valueFromPointer(event));
  });

  picker.addEventListener("pointerup", (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - activePointer.x, event.clientY - activePointer.y);
    const pointerType = activePointer.type;
    activePointer = null;

    if (distance <= 8) {
      setThreshold(valueFromPointer(event));
      if (pointerType !== "touch") picker.focus({ preventScroll: true });
    }

    if (pointerType === "touch") {
      endCandidate();
    }
  });

  picker.addEventListener("pointercancel", () => {
    activePointer = null;
    endCandidate();
  });

  picker.addEventListener("keydown", (event) => {
    const changes = {
      ArrowUp: threshold + 1,
      ArrowRight: threshold + 1,
      ArrowDown: threshold - 1,
      ArrowLeft: threshold - 1,
      PageUp: threshold + 32,
      PageDown: threshold - 32,
      Home: MIN_THRESHOLD,
      End: MAX_THRESHOLD,
    };

    if (!(event.key in changes)) return;
    event.preventDefault();
    endCandidate();
    setThreshold(changes[event.key]);
  });

  picker.addEventListener("blur", endCandidate);

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
