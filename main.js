(() => {
  const track = document.querySelector(".track");
  if (!track) return;

  const cards = [...track.querySelectorAll(".card")];
  const imgs = cards.map((c) => c.querySelector(".card-media img"));
  const medias = cards.map((c) => c.querySelector(".card-media"));
  const ticksEl = document.querySelector(".timeline-ticks");
  const timeline = document.querySelector(".timeline");
  const fill = document.querySelector(".timeline-fill");
  const currentEl = document.getElementById("current");
  const totalEl = document.getElementById("total");
  const [prevBtn, nextBtn] = document.querySelectorAll(".nav-btn");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  let centers = [];
  let step = 1;
  let active = -1;
  let ticking = false;

  /* ---------- timeline ticks ---------- */
  timeline.style.setProperty("--n", cards.length);
  totalEl.textContent = pad(cards.length);
  const ticks = cards.map((card, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = card.dataset.date || pad(i + 1);
    btn.setAttribute("aria-label", `Projekt ${i + 1}: ${card.querySelector("h2").textContent}`);
    btn.addEventListener("click", () => goTo(i));
    li.append(btn);
    ticksEl.append(li);
    return li;
  });

  /* ---------- measuring (only on resize, never per frame) ---------- */
  function measure() {
    centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
    step = cards.length > 1 ? centers[1] - centers[0] : 1;
    render();
  }

  /* ---------- per-frame visuals: transforms + one CSS var ---------- */
  function render() {
    ticking = false;
    const mid = track.scrollLeft + track.clientWidth / 2;
    for (let i = 0; i < cards.length; i++) {
      let p = (centers[i] - mid) / step; // -1 = left neighbour, 0 = center, 1 = right
      if (p > 2) p = 2; else if (p < -2) p = -2;
      const k = Math.min(Math.abs(p), 1);
      cards[i].style.transform = `scale(${(1 - k * 0.1).toFixed(4)})`;
      cards[i].style.setProperty("--k", k.toFixed(3));
      if (!reduceMotion) imgs[i].style.transform = `translate3d(${(p * -9).toFixed(2)}%,0,0)`;
    }
    const idx = Math.max(0, Math.min(cards.length - 1, Math.round((mid - centers[0]) / step)));
    const progress = cards.length > 1 ? (mid - centers[0]) / (centers[cards.length - 1] - centers[0]) : 0;
    fill.style.setProperty("--progress", Math.max(0, Math.min(1, progress)).toFixed(4));
    if (idx !== active) setActive(idx);
  }

  function setActive(idx) {
    if (active > -1) {
      cards[active].classList.remove("is-active");
      ticks[active].classList.remove("is-active");
      medias[active].style.removeProperty("--mx");
      medias[active].style.removeProperty("--my");
    }
    active = idx;
    cards[idx].classList.add("is-active");
    ticks[idx].classList.add("is-active");
    currentEl.textContent = pad(idx + 1);
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === cards.length - 1;
  }

  const schedule = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(render); }
  };

  function goTo(i, smooth = true) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    track.scrollTo({ left: centers[i] - track.clientWidth / 2, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  }

  track.addEventListener("scroll", schedule, { passive: true });
  new ResizeObserver(measure).observe(track);
  prevBtn.addEventListener("click", () => goTo(active - 1));
  nextBtn.addEventListener("click", () => goTo(active + 1));

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
  });

  /* ---------- click: side cards come to center instead of opening ---------- */
  let suppressClick = false;
  track.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
    if (!card) return;
    const i = cards.indexOf(card);
    if (i !== active) { e.preventDefault(); goTo(i); }
  }, true);

  /* ---------- mouse drag (touch + trackpad use native scrolling) ---------- */
  let drag = null;

  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, start: track.scrollLeft, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false, id: e.pointerId };
  });

  track.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
        track.setPointerCapture(e.pointerId);
        track.classList.add("is-dragging");
      }
      if (drag.moved) {
        track.scrollLeft = drag.start - dx;
        const dt = e.timeStamp - drag.lastT;
        if (dt > 0) drag.v = 0.8 * ((e.clientX - drag.lastX) / dt) + 0.2 * drag.v;
        drag.lastX = e.clientX;
        drag.lastT = e.timeStamp;
      }
      return;
    }
    // subtle hover parallax on the centered card (fine pointers only)
    if (e.pointerType !== "mouse" || reduceMotion || active < 0) return;
    const card = e.target.closest(".card");
    if (card !== cards[active]) return;
    const r = card.getBoundingClientRect();
    medias[active].style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) - 0.5) * -14}px`);
    medias[active].style.setProperty("--my", `${(((e.clientY - r.top) / r.height) - 0.5) * -10}px`);
  });

  track.addEventListener("pointerleave", () => {
    if (active > -1 && !drag) {
      medias[active].style.removeProperty("--mx");
      medias[active].style.removeProperty("--my");
    }
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    // fling: project the release velocity a little forward, then snap
    const recent = e.timeStamp - d.lastT < 80 ? d.v : 0;
    const projected = track.scrollLeft + track.clientWidth / 2 - recent * 180;
    let target = Math.round((projected - centers[0]) / step);
    target = Math.max(active - 2, Math.min(active + 2, target));
    goTo(target);
    const release = () => track.classList.remove("is-dragging");
    if ("onscrollend" in window) track.addEventListener("scrollend", release, { once: true });
    setTimeout(release, 700);
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("dragstart", (e) => e.preventDefault());

  measure();
})();
