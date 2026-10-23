(() => {
  const root = document.documentElement;
  const body = document.body;
  const main = document.getElementById('main');
  const shot = document.getElementById('shot');
  const sharp = document.getElementById('sharp');
  const soft = document.getElementById('soft');
  const glint = document.getElementById('glint');
  const thumb = document.getElementById('thumb');
  const links = [...document.querySelectorAll('.tabs a')];
  const island = document.getElementById('island');
  const nowBtn = document.getElementById('now');
  const nowLabel = document.getElementById('nowLabel');
  const scenes = [...document.querySelectorAll('.scene')];
  const copies = scenes.map((s) => s.querySelector('.copy'));
  const sheet = document.getElementById('sheet');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const phoneSheet = matchMedia('(max-width: 899px)');

  // Split text into word spans; &nbsp; pairs stay together
  function words(el) {
    const parts = el.textContent.trim().split(/[ \n\t]+/);
    el.textContent = '';
    parts.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.style.setProperty('--i', i);
      s.textContent = w;
      el.append(s);
      if (i < parts.length - 1) el.append(' ');
    });
    return [...el.querySelectorAll('.w')];
  }
  document.querySelectorAll('[data-words]').forEach(words);
  const ledeWords = words(document.getElementById('lede'));

  // Split text into masked lines for the reveal. <br> forces a break; re-run on resize.
  const lineEls = [...document.querySelectorAll('[data-lines]')];
  lineEls.forEach((el) => { el.dataset.src = el.innerHTML; el.dataset.text = el.textContent.replace(/\s+/g, ' ').trim(); });
  function splitLines(el) {
    el.innerHTML = el.dataset.src;
    const segments = el.innerHTML.split(/<br\s*\/?>/i).map((h) => { const t = document.createElement('div'); t.innerHTML = h; return t.textContent.trim(); });
    el.textContent = '';
    const rows = [];
    segments.forEach((seg, si) => {
      const spans = seg.split(/\s+/).filter(Boolean).map((w) => {
        const s = document.createElement('span');
        s.textContent = w;
        el.append(s, ' ');
        return s;
      });
      let top = null;
      spans.forEach((s) => {
        if (s.offsetTop !== top) { rows.push([]); top = s.offsetTop; }
        rows[rows.length - 1].push(s.textContent);
      });
      if (si < segments.length - 1) el.append(document.createElement('br'));
    });
    el.textContent = '';
    rows.forEach((r, l) => {
      const ln = document.createElement('span');
      ln.className = 'ln';
      ln.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'ln-in';
      inner.style.setProperty('--l', l);
      inner.textContent = r.join(' ');
      ln.append(inner);
      el.append(ln);
    });
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = el.dataset.text; // screen readers get the sentence whole
    el.append(sr);
  }
  const splitAll = () => lineEls.forEach(splitLines);
  splitAll();
  document.fonts?.ready.then(splitAll);
  let splitT = 0;
  addEventListener('resize', () => { clearTimeout(splitT); splitT = setTimeout(splitAll, 150); });

  // PANTONE footers set letter by letter
  document.querySelectorAll('[data-chars]').forEach((el) => {
    const t = el.textContent;
    el.textContent = '';
    [...t].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--c', i);
      s.textContent = c;
      el.append(s);
    });
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = t;
    el.append(sr);
  });

  /* ─── Camera ────────────────────────────── */

  const COOL = [0.37, 0.37, 0.58, 0.47];
  const WARM = [0.50, 0.43, 0.63, 0.50];
  const BOX  = [0.25, 0.16, 0.70, 0.69];
  const SOFT = [0, 1, 1, 0];

  let W = 0, H = 0, img = null, keys = [], sceneH = 1, tabs = [], queued = false;

  function imageRect() {
    const ew = sharp.offsetWidth, eh = sharp.offsetHeight;
    const c = Math.max(ew / 1080, eh / 1217);
    const dw = 1080 * c, dh = 1217 * c;
    const [px, py] = getComputedStyle(sharp).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    return { x: sharp.offsetLeft + (ew - dw) * px, y: sharp.offsetTop + (eh - dh) * py, w: dw, h: dh };
  }
  function frame([x0, y0, x1, y1]) {
    const aw = (x1 - x0) * img.w, ah = (y1 - y0) * img.h;
    const s = Math.min(18, Math.max(W / aw, H / ah) * 1.04);
    return { cx: img.x + x0 * img.w + aw / 2, cy: img.y + y0 * img.h + ah / 2, s };
  }
  function measureTabs() { tabs = links.map((a) => ({ x: a.offsetLeft, w: a.offsetWidth })); }

  function layout() {
    W = innerWidth;
    H = innerHeight;
    sceneH = scenes[1].offsetTop || H;
    img = imageRect();
    const wide = { cx: W / 2, cy: H / 2, s: 1 };
    const close = W / H < 1 ? { cx: W / 2, cy: H * 0.55, s: 1.12 } : wide;
    keys = [wide, frame(COOL), frame(WARM), close];
    Object.assign(glint.style, {
      left: img.x + BOX[0] * img.w + 'px',
      top: img.y + BOX[1] * img.h + 'px',
      width: (BOX[2] - BOX[0]) * img.w + 'px',
      height: (BOX[3] - BOX[1]) * img.h + 'px',
    });
    measureTabs();
    railH = railTrack.clientHeight;
    // Ticket punch-outs sit on the perforation
    const pf = document.getElementById('passFoot');
    if (pf) document.getElementById('passIn').style.setProperty('--notch', pf.offsetTop + 'px');
    render();
  }

  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const smooth = (a, b, t) => { t = clamp01((t - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const progress = () => Math.min(scenes.length - 1, Math.max(0, scrollY / sceneH));

  const rail = document.getElementById('rail');
  const railTrack = document.getElementById('railTrack');
  const railThumb = document.getElementById('railThumb');

  let active = -1, railH = 0, lastQ = -1, lastW = 0;
  function render() {
    queued = false;
    const p = progress();
    const i = Math.min(scenes.length - 2, Math.floor(p));
    const f = p - i;

    // Custom scrollbar
    railThumb.style.transform = `translate3d(0, ${(p / (scenes.length - 1)) * railH * 0.75}px, 0)`;

    // Island thumb rides with the scroll
    const a = tabs[i], b = tabs[i + 1];
    if (a) {
      thumb.style.transform = `translate3d(${lerp(a.x, b.x, f)}px, 0, 0)`;
      const wNow = Math.round(lerp(a.w, b.w, f));
      if (wNow !== lastW) { lastW = wNow; thumb.style.width = wNow + 'px'; }
    }
    const now = Math.round(p);
    if (now !== active) {
      active = now;
      links.forEach((l, n) => {
        l.classList.toggle('on', n === now);
        if (n === now) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
      nowLabel.textContent = links[now].textContent;
      nowLabel.classList.remove('swap'); nowLabel.offsetWidth; nowLabel.classList.add('swap');
    }

    // The about line lights up word by word as you arrive
    const q = reduced ? 1 : Math.round(smooth(0.25, 0.95, p) * 200) / 200;
    if (q !== lastQ) {
      lastQ = q;
      const n = ledeWords.length;
      ledeWords.forEach((w, k) => { w.style.opacity = (0.16 + 0.84 * clamp01(q * (n + 2) - k)).toFixed(3); });
    }

    if (reduced) {
      shot.style.transform = 'none';
      soft.style.opacity = SOFT[now] ? 0.85 : 0;
      return;
    }

    const t = smooth(0, 1, f);
    const ka = keys[i], kb = keys[i + 1];
    const s = Math.exp(lerp(Math.log(ka.s), Math.log(kb.s), t));
    const cx = lerp(ka.cx, kb.cx, t), cy = lerp(ka.cy, kb.cy, t);
    shot.style.transform = `translate3d(${W / 2 - s * cx}px, ${H / 2 - s * cy}px, 0) scale(${s})`;
    const o = lerp(SOFT[i], SOFT[i + 1], smooth(0.12, 0.7, f));
    soft.style.opacity = o;
    soft.style.visibility = o < 0.005 ? 'hidden' : 'visible';
    sharp.style.visibility = o > 0.995 ? 'hidden' : 'visible';

    // Each scene lifts away as you leave it, and returns when you scroll back
    copies.forEach((c, k) => {
      const d = p - k;
      if (d > 0.001 && k < scenes.length - 1) {
        c.style.opacity = 1 - smooth(0, 0.6, d);
        c.style.transform = `translate3d(0, ${-d * 70}px, 0) scale(${1 - d * 0.04})`;
      } else if (c.style.opacity !== '') {
        c.style.opacity = '';
        c.style.transform = '';
      }
    });
  }

  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  layout();

  /* ─── Page reveal → opening shot ───────── */

  const reveal = document.getElementById('reveal');
  const loaded = (im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }));
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function start() {
    root.classList.remove('locked');
    body.classList.remove('intro');
    scenes[0].classList.add('in');
    layout();
    target = Math.max(0, Math.min(scenes.length - 1, Math.round(progress())));
    setTimeout(() => body.classList.add('glint-go'), reduced ? 0 : 1300);
  }

  requestAnimationFrame(() => reveal.classList.add('go'));
  Promise.all([loaded(sharp), loaded(soft), document.fonts?.ready, delay(reduced ? 200 : 1900)])
    .then(() => {
      reveal.classList.add('out');
      setTimeout(start, reduced ? 0 : 520);
      setTimeout(() => reveal.remove(), reduced ? 400 : 1400);
    });

  /* ─── Scroll: one gesture, one glide ──────
     Wheels and trackpads move one scene per gesture on a critically damped spring
     (response 0.8s). New input retargets the spring and keeps its velocity, so it
     can be redirected mid-glide without a jolt. Touch keeps native momentum and CSS
     snap. Anything else that moves the page settles on the nearest scene. */

  const coarse = matchMedia('(pointer: coarse)').matches;
  const OMEGA = (2 * Math.PI) / 0.8;
  const spring = { y: 0, v: 0, to: 0, on: false, last: 0 };
  let target = 0;
  const clampScene = (k) => Math.max(0, Math.min(scenes.length - 1, k));

  function springStep(now) {
    if (!spring.on) return;
    const dt = Math.min(0.05, (now - spring.last) / 1000);
    spring.last = now;
    const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
    for (let k = 0; k < steps; k++) {
      const acc = -OMEGA * OMEGA * (spring.y - spring.to) - 2 * OMEGA * spring.v;
      spring.v += acc * h;
      spring.y += spring.v * h;
    }
    if (Math.abs(spring.y - spring.to) < 0.4 && Math.abs(spring.v) < 6) {
      spring.y = spring.to;
      spring.on = false;
    }
    scrollTo(0, spring.y);
    if (spring.on) requestAnimationFrame(springStep);
    else root.style.scrollSnapType = '';
  }
  function glide(k) {
    target = clampScene(k);
    const to = target * sceneH;
    if (reduced) { scrollTo(0, to); return; }
    if (!spring.on) {
      spring.y = scrollY;
      spring.v = 0;
      spring.on = true;
      spring.last = performance.now();
      root.style.scrollSnapType = 'none';
      requestAnimationFrame(springStep);
    }
    spring.to = to;
  }
  function stopGlide() {
    if (!spring.on) return;
    spring.on = false;
    root.style.scrollSnapType = '';
  }
  const scrollLocked = () => sheet.open || root.classList.contains('locked');

  // Wheel / trackpad: detect gestures, ignore the inertia tail
  if (!coarse) {
    let wheelLast = 0, lastMag = 0, acc = 0, armed = true;
    addEventListener('wheel', (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      e.preventDefault();
      if (scrollLocked()) return;
      const now = performance.now();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      const mag = Math.abs(dy);
      const fresh = now - wheelLast > 170 || (mag > lastMag * 1.7 && mag > 14);
      wheelLast = now;
      lastMag = mag;
      if (fresh) { armed = true; acc = 0; }
      if (!armed) return;
      acc += dy;
      if (Math.abs(acc) > 22) {
        armed = false;
        acc = 0;
        glide(target + Math.sign(dy));
      }
    }, { passive: false });
  }
  addEventListener('touchstart', stopGlide, { passive: true });

  // Keyboard
  addEventListener('keydown', (e) => {
    if (scrollLocked() || e.altKey || e.metaKey || e.ctrlKey) return;
    const el = e.target instanceof Element ? e.target : document.body;
    if (el.closest('input, select, textarea, [contenteditable]')) return;
    const k = e.key;
    let to = null;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey && !el.closest('button, a'))) to = target + 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) to = target - 1;
    else if (k === 'Home') to = 0;
    else if (k === 'End') to = scenes.length - 1;
    if (to === null) return;
    e.preventDefault();
    glide(to);
  });

  // In-page links glide instead of jumping
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const k = scenes.findIndex((s) => '#' + s.id === a.getAttribute('href'));
    if (k < 0) return;
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    glide(k);
  });

  // Whatever else moved the page (find-in-page, touch on a laptop), settle on a scene
  const settle = () => {
    if (spring.on || railDrag || scrollLocked()) return;
    const k = Math.round(progress());
    target = k;
    if (!coarse && Math.abs(scrollY - k * sceneH) > 1) glide(k);
  };
  if ('onscrollend' in window) addEventListener('scrollend', settle);
  else { let st = 0; addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(settle, 160); }, { passive: true }); }

  addEventListener('resize', () => { if (!spring.on) scrollTo(0, target * sceneH); });

  /* ─── Custom scrollbar ─────────────────── */

  railTrack.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => glide(+b.dataset.to)));

  let railDrag = null;
  railThumb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stopGlide();
    railDrag = { id: e.pointerId, grab: e.clientY - railThumb.getBoundingClientRect().top, top: railTrack.getBoundingClientRect().top, range: railH * 0.75 };
    railThumb.setPointerCapture(e.pointerId);
    rail.classList.add('dragging');
    root.style.scrollSnapType = 'none';
  });
  railThumb.addEventListener('pointermove', (e) => {
    if (!railDrag || e.pointerId !== railDrag.id) return;
    const frac = clamp01((e.clientY - railDrag.top - railDrag.grab) / railDrag.range);
    scrollTo(0, frac * (scenes.length - 1) * sceneH);
  });
  const railEnd = () => {
    if (!railDrag) return;
    railDrag = null;
    rail.classList.remove('dragging');
    root.style.scrollSnapType = '';
    glide(Math.round(progress()));
  };
  railThumb.addEventListener('pointerup', railEnd);
  railThumb.addEventListener('pointercancel', railEnd);
  railTrack.addEventListener('pointerdown', (e) => {
    if (e.target !== railTrack) return;
    const r = railTrack.getBoundingClientRect();
    glide(Math.round(clamp01((e.clientY - r.top) / r.height) * (scenes.length - 1)));
  });

  // Start where the URL points
  target = clampScene(Math.round(progress()));

  /* ─── Island (phones: open / close the sections) ─── */

  let openedAt = 0;
  function setIsland(open) {
    island.classList.toggle('open', open);
    nowBtn.setAttribute('aria-expanded', String(open));
    if (open) { openedAt = scrollY; measureTabs(); render(); }
  }
  nowBtn.addEventListener('click', () => setIsland(!island.classList.contains('open')));
  links.forEach((l) => l.addEventListener('click', () => setTimeout(() => setIsland(false), 250)));
  addEventListener('scroll', () => {
    if (island.classList.contains('open') && Math.abs(scrollY - openedAt) > 60) setIsland(false);
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    if (island.classList.contains('open') && !island.contains(e.target)) setIsland(false);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && island.classList.contains('open')) { setIsland(false); nowBtn.focus(); } });
  island.addEventListener('transitionend', (e) => { if (e.target.classList.contains('tabs')) { measureTabs(); render(); } });

  /* ─── Reveals: once per scene ───────────── */

  scenes.forEach((s) => s.querySelectorAll('[data-r]').forEach((el, n) => el.style.setProperty('--n', n)));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      if (e.target.id === 'join') startCountdown();
    });
  }, { threshold: 0.4 });
  scenes.slice(1).forEach((s) => io.observe(s));

  /* ─── Programming panes ─────────────────── */

  const panes = [...document.querySelectorAll('.pane')];
  const segs = [...document.querySelectorAll('.tl-seg')];
  function openPane(pane, opening) {
    panes.forEach((o, k) => {
      const on = o === pane ? opening : false;
      o.classList.toggle('is-open', on);
      o.querySelector('.pane-head').setAttribute('aria-expanded', String(on));
      segs[k]?.classList.toggle('is-on', on);
    });
  }
  segs.forEach((seg) => seg.addEventListener('click', () => openPane(panes[+seg.dataset.pane], true)));
  panes.forEach((pane) => {
    const head = pane.querySelector('.pane-head');
    head.addEventListener('click', () => {
      const opening = !pane.classList.contains('is-open');
      if (!opening && !phoneSheet.matches) return; // on wide screens one pane always stays open
      openPane(pane, opening);
    });
    if (finePointer) {
      pane.addEventListener('pointermove', (e) => {
        const r = pane.getBoundingClientRect();
        pane.style.setProperty('--px', `${e.clientX - r.left}px`);
        pane.style.setProperty('--py', `${e.clientY - r.top}px`);
      });
    }
  });

  /* ─── Pass: tilts toward the cursor, light follows ─── */

  const pass = document.getElementById('pass');
  const passIn = document.getElementById('passIn');
  if (finePointer && !reduced) {
    const tgt = { rx: 0, ry: 0 }, cur = { rx: 0, ry: 0 };
    let raf = 0;
    const step = () => {
      cur.rx += (tgt.rx - cur.rx) * 0.12;
      cur.ry += (tgt.ry - cur.ry) * 0.12;
      passIn.style.setProperty('--rx', cur.rx.toFixed(2) + 'deg');
      passIn.style.setProperty('--ry', cur.ry.toFixed(2) + 'deg');
      raf = Math.abs(tgt.rx - cur.rx) + Math.abs(tgt.ry - cur.ry) > 0.01 ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    pass.addEventListener('pointermove', (e) => {
      const r = passIn.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      tgt.rx = (0.5 - y) * 7;
      tgt.ry = (x - 0.5) * 9;
      passIn.style.setProperty('--gx', `${x * 100}%`);
      passIn.style.setProperty('--gy', `${y * 100}%`);
      kick();
    });
    pass.addEventListener('pointerleave', () => { tgt.rx = 0; tgt.ry = 0; kick(); });
  }

  /* ─── Countdown with rolling digits ─────── */

  const EVENT = Date.UTC(2026, 11, 3, 16, 0, 0); // 11:00 AM EST
  const odos = [...document.querySelectorAll('.odo')];
  const countdown = document.getElementById('countdown');
  function setOdo(el, value) {
    const str = String(value).padStart(2, '0');
    if (el.children.length !== str.length) {
      el.textContent = '';
      for (let k = 0; k < str.length; k++) {
        const reel = document.createElement('span');
        reel.className = 'reel';
        reel.style.setProperty('--dl', `${k * 90}ms`);
        for (let d = 0; d <= 9; d++) { const s = document.createElement('span'); s.textContent = d; reel.append(s); }
        el.append(reel);
      }
      el.offsetWidth;
    }
    [...el.children].forEach((reel, k) => reel.style.setProperty('--d', str[k]));
  }
  function tick() {
    const ms = Math.max(0, EVENT - Date.now());
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    const vals = { d, h, m };
    odos.forEach((el) => setOdo(el, vals[el.dataset.unit]));
    countdown.setAttribute('aria-label', `${d} days, ${h} hours and ${m} minutes to go`);
  }
  odos.forEach((el) => setOdo(el, 0));
  let ticking = false;
  function startCountdown() {
    if (ticking) return;
    ticking = true;
    setTimeout(tick, reduced ? 0 : 500);
    setInterval(tick, 20000);
  }

  /* ─── RSVP sheet ────────────────────────── */

  const stepsWrap = sheet.querySelector('.steps');
  const steps = [...sheet.querySelectorAll('.step')];
  const order = ['phone', 'code', 'ticket', 'done'];
  const count = sheet.querySelector('[data-count]');
  const countWrap = sheet.querySelector('.count');
  const state = { phone: '', done: false, at: 'phone' };
  let opener = null;
  const buzz = (p) => { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(p); };

  function show(name) {
    stepsWrap.classList.toggle('back', order.indexOf(name) < order.indexOf(state.at));
    state.at = name;
    steps.forEach((s) => s.classList.toggle('is-active', s.dataset.step === name));
    const at = order.indexOf(name);
    countWrap.style.visibility = at > 2 ? 'hidden' : 'visible';
    count.textContent = Math.min(at + 1, 3);
    const activeStep = sheet.querySelector(`.step[data-step="${name}"]`);
    const field = activeStep.querySelector('input[type=tel], #code');
    setTimeout(() => (field || activeStep.querySelector('.sheet-title')).focus({ preventScroll: true }), 60);
  }

  function open(e) {
    opener = e.currentTarget;
    if (!state.done) show('phone');
    if (opener.dataset.ticket) {
      const pick = sheet.querySelector(`input[name="ticket"][value="${opener.dataset.ticket}"]`);
      if (pick) pick.checked = true;
    }
    setIsland(false);
    main.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
    root.classList.add('locked');
    body.classList.add('sheet-open');
    sheet.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('is-in')));
  }
  function close() {
    if (!sheet.open) return;
    sheet.classList.remove('is-in', 'dragging');
    sheet.style.transform = '';
    body.classList.remove('sheet-open');
    setTimeout(() => {
      sheet.close();
      root.classList.remove('locked');
      opener?.focus({ preventScroll: true });
    }, reduced ? 0 : 320);
  }

  document.querySelectorAll('[data-rsvp]').forEach((b) => b.addEventListener('click', open));
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  sheet.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show(b.dataset.back)));

  // Drag down to dismiss (phone sheet): 1:1 tracking, rubber-band upward, projected flick
  const rubber = (x, d, c = 0.55) => (x * d * c) / (d + c * Math.abs(x));
  const project = (v, r = 0.998) => (v / 1000) * r / (1 - r);
  let drag = null;
  function dragStart(e) {
    if (!phoneSheet.matches || e.target.closest('button, a, input, select')) return;
    drag = { y0: e.clientY, dy: 0, hist: [[e.timeStamp, e.clientY]], id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  }
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const raw = e.clientY - drag.y0;
    drag.dy = raw < 0 ? rubber(raw, sheet.offsetHeight) : raw;
    sheet.style.transform = `translateY(${drag.dy}px)`;
    drag.hist.push([e.timeStamp, e.clientY]);
    if (drag.hist.length > 5) drag.hist.shift();
  }
  function dragEnd() {
    if (!drag) return;
    const [t0, y0] = drag.hist[0], [t1, y1] = drag.hist[drag.hist.length - 1];
    const v = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
    const landing = drag.dy + project(v);
    sheet.classList.remove('dragging');
    if (landing > sheet.offsetHeight * 0.45 && drag.dy > 0) close();
    else sheet.style.transform = '';
    drag = null;
  }
  [document.getElementById('grab'), sheet.querySelector('.sheet-head')].forEach((el) => {
    el.addEventListener('pointerdown', dragStart);
    el.addEventListener('pointermove', dragMove);
    el.addEventListener('pointerup', dragEnd);
    el.addEventListener('pointercancel', dragEnd);
  });

  const wait = (btn, ms) => new Promise((done) => {
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
    setTimeout(() => { btn.removeAttribute('aria-busy'); btn.disabled = false; done(); }, reduced ? 0 : ms);
  });
  const digits = (v) => v.replace(/\D/g, '');

  // Phone
  const fPhone = sheet.querySelector('[data-step="phone"]');
  const phone = fPhone.querySelector('#phone');
  const phoneBtn = fPhone.querySelector('.pill');
  phone.addEventListener('input', () => {
    phoneBtn.disabled = digits(phone.value).length < 7;
    fPhone.querySelector('.err').textContent = '';
  });
  fPhone.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (digits(phone.value).length < 7) {
      fPhone.querySelector('.err').textContent = 'Enter a full mobile number, including the area code.';
      return;
    }
    state.phone = fPhone.querySelector('#cc').value + ' ' + phone.value.trim();
    await wait(phoneBtn, 700);
    sheet.querySelector('[data-phone-out]').textContent = state.phone;
    show('code');
  });

  // Code
  const fCode = sheet.querySelector('[data-step="code"]');
  const otp = document.getElementById('otp');
  const code = document.getElementById('code');
  const cells = [...otp.querySelectorAll('span')];
  const codeBtn = fCode.querySelector('.pill');
  let prevLen = 0;
  function paint() {
    const v = code.value;
    cells.forEach((c, k) => {
      c.dataset.d = v[k] || '';
      c.classList.toggle('cur', k === Math.min(v.length, 3) && v.length < 4);
      if (k === v.length - 1 && v.length > prevLen) { c.classList.remove('f'); c.offsetWidth; c.classList.add('f'); }
    });
    prevLen = v.length;
  }
  code.addEventListener('focus', () => otp.classList.add('focus'));
  code.addEventListener('blur', () => otp.classList.remove('focus'));
  code.addEventListener('input', () => {
    code.value = digits(code.value).slice(0, 4);
    otp.classList.remove('bad');
    codeBtn.disabled = code.value.length < 4;
    fCode.querySelector('.err').textContent = '';
    paint();
    if (code.value.length === 4) fCode.requestSubmit();
  });
  otp.addEventListener('animationend', () => otp.classList.remove('shake'));
  fCode.addEventListener('submit', async (e) => {
    e.preventDefault();
    await wait(codeBtn, 500);
    if (code.value !== '1234') {
      fCode.querySelector('.err').textContent = 'That code doesn’t match. For this demo, use 1234.';
      otp.classList.add('bad', 'shake');
      buzz([20, 40, 20]);
      code.value = '';
      paint();
      code.focus();
      return;
    }
    show('ticket');
  });
  paint();

  // Ticket
  const fTicket = sheet.querySelector('[data-step="ticket"]');
  fTicket.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ticket = new FormData(fTicket).get('ticket');
    await wait(fTicket.querySelector('.pill'), 700);
    sheet.querySelector('[data-done-copy]').textContent =
      (ticket === 'workshop' ? 'General admission and the 2:00 PM workshop. ' : 'General admission. ') +
      `We’ll text the address to ${state.phone} before the day.`;
    state.done = true;
    show('done');
    buzz(12);
  });

  // Calendar file
  const downloadICS = () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pantone//Beyond the Color//EN',
      'BEGIN:VEVENT',
      'UID:beyond-the-color-2026@pantone',
      'DTSTAMP:20261022T000000Z',
      'DTSTART:20261203T160000Z',
      'DTEND:20261203T230000Z',
      'SUMMARY:The Pantone Color of the Year 2027 Experience: Beyond the Color',
      'LOCATION:Miami\\, Florida',
      'DESCRIPTION:Address shared by text before the day.',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'beyond-the-color.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  document.querySelectorAll('[data-ics]').forEach((b) => b.addEventListener('click', downloadICS));
})();
