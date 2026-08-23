const scratchCards = document.querySelectorAll(".scratch-card");
const instructionsEl = document.querySelector(".scratch-instructions");
const successEl = document.querySelector(".scratch-success");

const revealThreshold = 0.15; // 15%
const brushRadius = 16;

const revealState = { date: false, month: false, year: false };

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch (err) {
    // Web Audio unsupported/blocked — chime is a nice-to-have, fail silently.
  }
}

function fireConfetti() {
  const pinks = ["#E87AA3", "#F3A6C0", "#D95F8A", "#F7C4D5", "#B8336A"];
  const burst = document.createDocumentFragment();

  for (let i = 0; i < 140; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--left", `${Math.random() * 100}%`);
    piece.style.setProperty("--drift", `${Math.random() * 220 - 110}px`);
    piece.style.setProperty("--rotation", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 500}ms`);
    piece.style.setProperty("--size", `${5 + Math.random() * 6}px`);
    piece.style.backgroundColor = pinks[i % pinks.length];
    burst.appendChild(piece);
  }

  document.body.appendChild(burst);
  window.setTimeout(() => {
    document.querySelectorAll(".confetti-piece").forEach((piece) => piece.remove());
  }, 3000);
}

function initScratchCard(cardEl) {
  const canvas = cardEl.querySelector(".scratch-card-canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cardKey = cardEl.dataset.card;
  const cardValue = canvas.dataset.value;

  let isScratching = false;
  let hasRevealed = false;
  let revealCheckPending = false;
  let originalOpaqueMask = null;
  let originalOpaquePixels = 0;

  function drawGoldFace() {
    if (!context) return;

    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));

    canvas.width = width;
    canvas.height = height;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const w = bounds.width;
    const h = bounds.height;

    const gradient = context.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#B5952F");
    gradient.addColorStop(0.3, "#D4AF37");
    gradient.addColorStop(0.5, "#FFF3B0");
    gradient.addColorStop(0.7, "#D4AF37");
    gradient.addColorStop(1, "#B5952F");
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);

    context.strokeStyle = "rgba(255, 255, 255, 0.25)";
    context.lineWidth = 1;
    for (let x = -h; x < w; x += 8) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + h, h);
      context.stroke();
    }

    context.strokeStyle = "#FFFFFF";
    context.lineWidth = 1.5;
    context.strokeRect(4, 4, w - 8, h - 8);
    context.strokeStyle = "rgba(184, 150, 90, 0.3)";
    context.lineWidth = 0.5;
    context.strokeRect(7, 7, w - 14, h - 14);

    context.fillStyle = "#2B1D14";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 8px Montserrat, sans-serif";
    context.fillText("SCRATCH", w / 2, h / 3);
    if (cardValue) {
      context.font = "bold 13px Cinzel, serif";
      context.fillText(cardValue, w / 2, h * 0.6);
    }
    context.font = "italic 7px 'Playfair Display', serif";
    context.fillText("reveal me", w / 2, h * 0.82);

    const pixels = context.getImageData(0, 0, width, height).data;
    originalOpaqueMask = new Uint8Array(width * height);
    originalOpaquePixels = 0;

    for (let pixel = 0, alphaIndex = 3; alphaIndex < pixels.length; pixel++, alphaIndex += 4) {
      if (pixels[alphaIndex] > 0) {
        originalOpaqueMask[pixel] = 1;
        originalOpaquePixels++;
      }
    }
  }

  function getPointerPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    const sourceEvent = event.touches?.[0] || event;

    return {
      x: sourceEvent.clientX - bounds.left,
      y: sourceEvent.clientY - bounds.top,
    };
  }

  function eraseAt(event) {
    if (!context) return;

    const { x, y } = getPointerPosition(event);

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, brushRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function checkRevealProgress() {
    if (hasRevealed || revealCheckPending || !context || !originalOpaqueMask) return;

    revealCheckPending = true;

    window.setTimeout(() => {
      revealCheckPending = false;
      if (hasRevealed) return;

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let erasedPixels = 0;

      for (let pixel = 0, alphaIndex = 3; alphaIndex < pixels.length; pixel++, alphaIndex += 4) {
        if (originalOpaqueMask[pixel] && pixels[alphaIndex] === 0) {
          erasedPixels++;
        }
      }

      if (erasedPixels / originalOpaquePixels >= revealThreshold) {
        hasRevealed = true;
        cardEl.classList.add("revealed");
        canvas.classList.add("revealed");
        isScratching = false;
        canvas.classList.remove("scratching");
        playChime();
        handleCardRevealed(cardKey);
      }
    }, 100);
  }

  function startScratching(event) {
    if (hasRevealed) return;

    isScratching = true;
    canvas.classList.add("scratching");
    event.preventDefault();
    eraseAt(event);
    checkRevealProgress();
  }

  function continueScratching(event) {
    if (!isScratching || hasRevealed) return;

    event.preventDefault();
    eraseAt(event);
    checkRevealProgress();
  }

  function stopScratching() {
    isScratching = false;
    canvas.classList.remove("scratching");
  }

  canvas.addEventListener("mousedown", startScratching);
  canvas.addEventListener("mousemove", continueScratching);
  canvas.addEventListener("mouseup", stopScratching);
  canvas.addEventListener("mouseleave", stopScratching);
  canvas.addEventListener("touchstart", startScratching, { passive: false });
  canvas.addEventListener("touchmove", continueScratching, { passive: false });
  canvas.addEventListener("touchend", stopScratching);
  canvas.addEventListener("touchcancel", stopScratching);

  window.addEventListener("load", drawGoldFace);
  window.addEventListener("resize", () => {
    if (!hasRevealed) drawGoldFace();
  });
}

function handleCardRevealed(key) {
  revealState[key] = true;

  if (revealState.date && revealState.month && revealState.year) {
    window.setTimeout(() => {
      showSuccess();
      fireConfetti();
    }, 300);
  }
}

function showSuccess() {
  if (!instructionsEl || !successEl) return;

  instructionsEl.style.opacity = "0";
  window.setTimeout(() => {
    instructionsEl.hidden = true;
    successEl.hidden = false;
    successEl.style.opacity = "0";
    requestAnimationFrame(() => {
      successEl.style.opacity = "1";
    });
  }, 400);
}

scratchCards.forEach(initScratchCard);

function startFallingFlowers() {
  const layer = document.createElement("div");
  layer.className = "falling-flowers";
  layer.setAttribute("aria-hidden", "true");

  const flowers = ["&#127801;", "&#127800;"];

  for (let i = 0; i < 34; i++) {
    const flower = document.createElement("span");
    flower.className = `falling-flower ${i % 2 === 0 ? "flower-red" : "flower-pink"}`;
    flower.innerHTML = flowers[i % flowers.length];
    flower.style.setProperty("--left", `${Math.random() * 100}%`);
    flower.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);
    flower.style.setProperty("--rotation", `${Math.random() * 720 - 360}deg`);
    flower.style.setProperty("--duration", `${9 + Math.random() * 7}s`);
    flower.style.setProperty("--delay", `${Math.random() * -15}s`);
    flower.style.setProperty("--size", `${0.8 + Math.random() * 0.75}rem`);
    layer.appendChild(flower);
  }

  document.body.appendChild(layer);
}

startFallingFlowers();

/* =========================================================
   ENVELOPE → INTRO VIDEO → SECOND VIDEO → WEBSITE FLOW
   ========================================================= */

const introOverlay = document.getElementById("introOverlay");
const envelopeButton = document.getElementById("envelopeButton");
const introVideo = document.getElementById("introVideo");
const weddingMusic = document.getElementById("weddingMusic");
const musicButton = document.getElementById("musicButton");

if (introOverlay && envelopeButton && introVideo) {
  envelopeButton.addEventListener("click", async () => {
    envelopeButton.style.transition = "opacity .4s ease, transform .4s ease";
    envelopeButton.style.opacity = "0";
    envelopeButton.style.transform = "scale(0.9)";
    envelopeButton.style.pointerEvents = "none";

    if (weddingMusic) {
      weddingMusic.volume = 0.7;
      weddingMusic.muted = false;
      weddingMusic.load();
      if (musicButton) musicButton.hidden = false;
      weddingMusic.play().then(() => {
        if (musicButton) musicButton.hidden = true;
      }).catch(() => {
        if (musicButton) musicButton.hidden = false;
      });
    }

    const revealVideo = () => introVideo.classList.remove("hidden");

    // Only reveal the video once it actually has a decoded frame ready.
    // (Previously we called introVideo.load() here, which reset the
    // element's buffer and forced a black frame while it re-decoded.)
    if (introVideo.readyState >= 2) {
      revealVideo();
    } else {
      introVideo.addEventListener("canplay", revealVideo, { once: true });
    }

    try {
      introVideo.muted = false;
      await introVideo.play();
    } catch {
      introVideo.muted = true;
      await introVideo.play();
    }
  });

  if (musicButton && weddingMusic) {
    musicButton.addEventListener("click", () => {
      weddingMusic.muted = false;
      weddingMusic.play().then(() => { musicButton.hidden = true; }).catch(() => {});
    });
  }

  introVideo.addEventListener("ended", () => {
    introOverlay.classList.add("hide");
    window.setTimeout(() => {
      introOverlay.style.display = "none";
    }, 700);
  });
}

/* =========================================================
   WEDDING COUNTDOWN
   ========================================================= */
(function initCountdown() {
  const daysEl = document.getElementById("cdDays");
  const hoursEl = document.getElementById("cdHours");
  const minutesEl = document.getElementById("cdMinutes");
  const secondsEl = document.getElementById("cdSeconds");
  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  // Set this to your actual ceremony date & time (local time)
  const weddingDate = new Date("2026-10-14T20:00:00");

  function pad(num) {
    return String(num).padStart(2, "0");
  }

  function updateCountdown() {
    const diff = weddingDate - new Date();

    if (diff <= 0) {
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = pad(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();

/* =========================================================
   PHOTO MEMORIES CAROUSEL
   ========================================================= */
(function initGlimpseCarousel() {
  // Replace these with your own wedding photo file paths
  const glimpsePhotos = [
    "memory-1.jpeg",
    "memory-2.jpeg",
    "memory-3.jpeg",
    "memory-4.jpeg",
    "memory-5.jpeg",
    "memory-6.jpeg"
  ];

  const stage = document.getElementById("cardStage");
  const dotsWrap = document.getElementById("glimpseDots");
  if (!stage || !dotsWrap) return;

  glimpsePhotos.forEach((src, i) => {
    const card = document.createElement("div");
    card.className = "polaroid" + (i === 0 ? " active" : "");
    card.innerHTML = `<img src="${src}" alt="Wedding memory ${i + 1}">`;
    stage.appendChild(card);

    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active");
    dotsWrap.appendChild(dot);
  });

  const cards = stage.querySelectorAll(".polaroid");
  const dots = dotsWrap.querySelectorAll("span");
  let current = 0;
  const INTERVAL_MS = 2600;

  function showSlide(index) {
    cards[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = index;
    cards[current].classList.add("active");
    dots[current].classList.add("active");
  }

  setInterval(() => {
    showSlide((current + 1) % cards.length);
  }, INTERVAL_MS);
})();