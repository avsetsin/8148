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
  const controls = document.getElementById("simulation-controls");
  const thresholdControl = document.getElementById("threshold-control");
  const thresholdOutput = document.getElementById("threshold-output");
  const toggle = document.getElementById("simulation-toggle");
  const fill = document.getElementById("fill");
  const thresholdLine = document.getElementById("thr");
  const thresholdLabel = document.getElementById("thrLabel");
  const balanceLabel = document.getElementById("balLabel");
  const hint = document.getElementById("hint");
  const flight = document.getElementById("flight");

  if (!svg || !controls || !thresholdControl || !thresholdOutput || !toggle || !fill || !thresholdLine || !thresholdLabel || !balanceLabel || !hint || !flight) return;

  const TOP_Y = 96;
  const BOTTOM_Y = 521;
  const MAX_BALANCE = 2300;
  const MAX_THRESHOLD = 2048;
  const MIN_THRESHOLD = 32;
  const GROWTH_RATE = 0.06;
  const SWEEP_INTERVAL = 0.8;
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  let balance = 32;
  let threshold = Number(thresholdControl.value);
  let elapsedSinceSweep = 0;
  let lastFrame = null;
  let lastDisplayedBalance = "";
  let lastControlMinimum = 0;
  let animationFrame = 0;
  let inView = !("IntersectionObserver" in window);
  let paused = false;
  let running = false;
  let pointerLocked = false;
  const coins = [];

  const ethToY = (eth) => BOTTOM_Y - (eth / MAX_BALANCE) * (BOTTOM_Y - TOP_Y);
  const yToEth = (y) => ((BOTTOM_Y - y) / (BOTTOM_Y - TOP_Y)) * MAX_BALANCE;
  const formatEth = (value) => numberFormat.format(value);

  function syncControlMinimum() {
    const minimumForBalance = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.ceil(balance)));
    const nextMinimum = Math.min(threshold, minimumForBalance);
    if (nextMinimum === lastControlMinimum) return;
    thresholdControl.min = String(nextMinimum);
    lastControlMinimum = nextMinimum;
  }

  function drawThreshold() {
    const y = ethToY(threshold);
    thresholdLine.setAttribute("d", `M28 ${y} C 190 ${y - 4}, 430 ${y + 4}, 612 ${y - 2}`);
    thresholdLabel.setAttribute("y", y > 466 ? y - 14 : y + 26);
    thresholdLabel.textContent = `your threshold — ${formatEth(threshold)} ETH`;
    thresholdControl.value = String(threshold);
    thresholdControl.setAttribute("aria-valuetext", `${formatEth(threshold)} ETH`);
    thresholdOutput.value = `${formatEth(threshold)} ETH`;
    syncControlMinimum();
  }

  function drawBalance() {
    const y = ethToY(balance);
    fill.setAttribute("y", String(y));
    fill.setAttribute("height", String(BOTTOM_Y - y));
    balanceLabel.setAttribute("y", String(Math.max(y - 10, 70)));

    const displayedBalance = `${formatEth(balance)} ETH`;
    if (displayedBalance !== lastDisplayedBalance) {
      balanceLabel.textContent = displayedBalance;
      lastDisplayedBalance = displayedBalance;
      syncControlMinimum();
    }
  }

  function setThreshold(value) {
    const minimumForBalance = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.ceil(balance)));
    const nextThreshold = Math.min(MAX_THRESHOLD, Math.max(minimumForBalance, Math.round(value)));
    if (nextThreshold === threshold) {
      thresholdControl.value = String(threshold);
      return;
    }
    threshold = nextThreshold;
    drawThreshold();
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

    if (elapsedSinceSweep >= SWEEP_INTERVAL) {
      elapsedSinceSweep %= SWEEP_INTERVAL;
      if (balance > threshold) {
        const excess = balance - threshold;
        balance = threshold;
        spawnCoin(excess);
      }
    }

    drawBalance();
    updateCoins(delta);
    animationFrame = requestAnimationFrame(frame);
  }

  function start() {
    if (running || paused || reducedMotion.matches || !inView || document.hidden) return;
    running = true;
    lastFrame = null;
    animationFrame = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
  }

  function syncMotionPreference() {
    toggle.hidden = reducedMotion.matches;
    if (reducedMotion.matches) stop();
    else start();
  }

  thresholdControl.addEventListener("input", () => setThreshold(Number(thresholdControl.value)));
  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.textContent = paused ? "Resume animation" : "Pause animation";
    if (paused) stop();
    else start();
  });

  if (finePointer.matches) {
    svg.classList.add("is-interactive");
    hint.setAttribute("visibility", "visible");
    svg.addEventListener("pointermove", (event) => {
      if (pointerLocked || event.pointerType === "touch") return;
      const bounds = svg.getBoundingClientRect();
      const y = ((event.clientY - bounds.top) * 580) / bounds.height;
      setThreshold(yToEth(y));
    });
    svg.addEventListener("click", () => {
      pointerLocked = !pointerLocked;
      hint.textContent = pointerLocked ? "click to unlock · use slider to adjust" : "move pointer · click to lock · use slider to adjust";
    });
  }

  document.getElementById("staticBits")?.remove();
  controls.hidden = false;
  balanceLabel.setAttribute("visibility", "visible");
  drawThreshold();
  drawBalance();

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
  syncMotionPreference();
})();
