/* ══════════════════════════════════════════════════════
   SOUND LAB · CONSONANTS IN DETAIL — Stage 1 (Review)
   Designed by Rosney Hernández
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));

  /* ────────────────────────────────────────────────
     1 · GENERATIVE FIELD
     Seeded flow field. Particles ride a layered value-noise
     vector field; trails accumulate into slow drifting currents.
     ──────────────────────────────────────────────── */
  const Field = (function () {
    const cv = $('#field');
    if (!cv || reduced) return { start() {} };
    const ctx = cv.getContext('2d', { alpha: false });

    const SEED = 20260806;
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry32(SEED);

    // value-noise lattice
    const G = 256, lat = new Float32Array(G * G);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const fade = t => t * t * (3 - 2 * t);
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const i0 = (xi & 255), j0 = (yi & 255);
      const i1 = (i0 + 1) & 255, j1 = (j0 + 1) & 255;
      const a = lat[j0 * G + i0], b = lat[j0 * G + i1];
      const c = lat[j1 * G + i0], d = lat[j1 * G + i1];
      const u = fade(xf), v = fade(yf);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function flow(x, y, t) {
      const n = noise(x * 0.0016 + t, y * 0.0016) * 0.68
              + noise(x * 0.0049 - t * 0.6, y * 0.0049) * 0.24
              + noise(x * 0.0135, y * 0.0135 + t * 0.4) * 0.08;
      return n * Math.PI * 4;
    }

    const PALETTE = ['0,245,196', '200,80,240', '255,77,184'];
    let W = 0, H = 0, dpr = 1, parts = [], t = 0, raf = 0, visible = true;

    function makeParticles() {
      const count = Math.round(Math.min(190, Math.max(70, (W * H) / 12000)));
      parts = [];
      for (let i = 0; i < count; i++) {
        const roll = rnd();
        parts.push({
          x: rnd() * W, y: rnd() * H,
          life: rnd() * 240,
          span: 160 + rnd() * 260,
          sp: 0.18 + rnd() * 0.55,
          w: 0.35 + rnd() * 0.95,
          c: roll < 0.66 ? PALETTE[0] : (roll < 0.87 ? PALETTE[1] : PALETTE[2]),
          a: 0.05 + rnd() * 0.16
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050c12';
      ctx.fillRect(0, 0, W, H);
      makeParticles();
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      t += 0.00035;

      ctx.fillStyle = 'rgba(5,12,18,0.055)';
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const ang = flow(p.x, p.y, t);
        const nx = p.x + Math.cos(ang) * p.sp;
        const ny = p.y + Math.sin(ang) * p.sp;

        ctx.strokeStyle = 'rgba(' + p.c + ',' + p.a + ')';
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        p.x = nx; p.y = ny; p.life++;
        if (p.life > p.span || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
          p.x = rnd() * W; p.y = rnd() * H; p.life = 0;
        }
      }
    }

    let rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(resize, 180);
    });
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

    return {
      start() { resize(); if (!raf) frame(); }
    };
  })();
  Field.start();

  /* ────────────────────────────────────────────────
     2 · TOAST
     ──────────────────────────────────────────────── */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* ────────────────────────────────────────────────
     3 · VOICE ENGINE
     Web Speech API, ranked toward the most natural
     English voices installed on the device.
     ──────────────────────────────────────────────── */
  const Voice = (function () {
    const supported = 'speechSynthesis' in window;
    const sel  = $('#voiceSel');
    const rate = $('#rateSel');
    const out  = $('#rateOut');
    const note = $('#voiceNote');

    let voices = [], chosen = null, warned = false;

    // higher = better. Natural/neural engines first.
    function score(v) {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      if (!/^en/i.test(v.lang || '')) return -1;
      if (/natural|neural|enhanced|premium/.test(n)) s += 60;
      if (/google/.test(n)) s += 34;
      if (/aria|jenny|guy|ava|allison|samantha|siri|serena|daniel|libby|sonia/.test(n)) s += 26;
      if (/^en-us/i.test(v.lang)) s += 14;
      if (/^en-gb/i.test(v.lang)) s += 8;
      if (v.localService) s += 4;
      if (/compact|espeak|pico|robot/.test(n)) s -= 30;
      return s;
    }

    function label(v) {
      return (v.name || 'Voice').replace(/microsoft |google |\(natural\)/gi, '').trim() + ' · ' + v.lang;
    }

    function load() {
      if (!supported) return;
      voices = speechSynthesis.getVoices()
        .filter(v => /^en/i.test(v.lang || ''))
        .sort((a, b) => score(b) - score(a));
      if (!voices.length) return;

      sel.innerHTML = '';
      voices.forEach((v, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = label(v);
        sel.appendChild(o);
      });
      chosen = voices[0];
      sel.value = '0';
      if (note) {
        note.textContent = /natural|neural|google|enhanced/i.test(chosen.name || '')
          ? 'Tap any word to hear it.'
          : 'Tip: install a Natural/Enhanced English voice in your system settings for a smoother sound.';
      }
    }

    if (supported) {
      load();
      speechSynthesis.onvoiceschanged = load;
      sel.addEventListener('change', () => { chosen = voices[+sel.value] || chosen; });
      rate.addEventListener('input', () => { out.textContent = (+rate.value).toFixed(2) + '×'; });
      out.textContent = (+rate.value).toFixed(2) + '×';
    } else if (note) {
      note.textContent = 'This browser has no speech engine. Try Chrome, Edge or Safari.';
    }

    function say(text, opts) {
      opts = opts || {};
      if (!supported) {
        if (!warned) { toast('Audio is not available in this browser. Try Chrome, Edge or Safari.'); warned = true; }
        return Promise.resolve();
      }
      return new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(text);
        if (chosen) u.voice = chosen;
        u.lang  = (chosen && chosen.lang) || 'en-US';
        u.rate  = opts.rate || (rate ? +rate.value : 0.85);
        u.pitch = 1;
        u.onend = resolve;
        u.onerror = resolve;
        speechSynthesis.speak(u);
      });
    }

    function stop() { if (supported) speechSynthesis.cancel(); }
    const wait = ms => new Promise(r => setTimeout(r, ms));

    return { say, stop, wait };
  })();

  /* ────────────────────────────────────────────────
     4 · WORD & PAIR BUTTONS
     ──────────────────────────────────────────────── */
  function bindPlay(btn, sequence) {
    btn.addEventListener('click', async () => {
      Voice.stop();
      $$('.playing').forEach(b => b.classList.remove('playing'));
      btn.classList.add('playing');
      for (let i = 0; i < sequence.length; i++) {
        await Voice.say(sequence[i]);
        if (i < sequence.length - 1) await Voice.wait(340);
      }
      btn.classList.remove('playing');
    });
  }

  // single words
  $$('.word').forEach(btn => {
    const w = btn.dataset.say || btn.textContent.trim();
    btn.setAttribute('aria-label', 'Play the word ' + w);
    bindPlay(btn, [w]);
  });

  // minimal pairs, built from data-pairs="a|b, c|d"
  $$('.pairs').forEach(box => {
    const spec = box.dataset.pairs || '';
    spec.split(',').forEach(chunk => {
      const bits = chunk.trim().split('|').map(s => s.trim());
      if (bits.length !== 2 || !bits[0]) return;

      const row = document.createElement('div');
      row.className = 'pair-row';

      const a = document.createElement('button');
      a.className = 'pair-btn'; a.type = 'button'; a.textContent = bits[0];
      a.setAttribute('aria-label', 'Play the word ' + bits[0]);

      const vs = document.createElement('span');
      vs.className = 'pair-vs'; vs.textContent = 'vs';

      const b = document.createElement('button');
      b.className = 'pair-btn'; b.type = 'button'; b.textContent = bits[1];
      b.setAttribute('aria-label', 'Play the word ' + bits[1]);

      const both = document.createElement('button');
      both.className = 'pair-both'; both.type = 'button'; both.textContent = 'both';
      both.setAttribute('aria-label', 'Play ' + bits[0] + ' then ' + bits[1]);

      bindPlay(a, [bits[0]]);
      bindPlay(b, [bits[1]]);
      bindPlay(both, [bits[0], bits[1], bits[0], bits[1]]);

      row.appendChild(a); row.appendChild(vs); row.appendChild(b); row.appendChild(both);
      box.appendChild(row);
    });
  });

  /* ────────────────────────────────────────────────
     5 · SCROLL-LINKED ARTICULATOR
     ──────────────────────────────────────────────── */
  const units    = $$('.unit');
  const zoneDots = $$('.zones circle');
  const uLabel   = $('#articUnit');
  const sLabel   = $('#articSounds');
  const caption  = $('#articCaption');
  let currentUnit = null;

  function showUnit(unit) {
    if (!unit || unit === currentUnit) return;
    currentUnit = unit;

    units.forEach(u => u.classList.toggle('active', u === unit));

    const zones = (unit.dataset.zones || '').split(/\s+/).filter(Boolean);
    zoneDots.forEach(d => d.classList.toggle('on', zones.indexOf(d.dataset.zone) > -1));

    if (uLabel) uLabel.textContent = unit.dataset.unit || '';
    if (sLabel) sLabel.textContent = unit.dataset.sounds || '';
    if (caption) {
      caption.classList.add('fade');
      setTimeout(() => {
        caption.textContent = unit.dataset.caption || '';
        caption.classList.remove('fade');
      }, 220);
    }
  }

  if ('IntersectionObserver' in window && units.length) {
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target, e.intersectionRatio));
      let best = null, top = 0;
      seen.forEach((ratio, el) => { if (ratio > top) { top = ratio; best = el; } });
      if (best && top > 0.06) showUnit(best);
    }, { threshold: [0, 0.06, 0.25, 0.5, 0.75, 1], rootMargin: '-15% 0px -35% 0px' });
    units.forEach(u => io.observe(u));
  }
  showUnit(units[0]);

  /* ────────────────────────────────────────────────
     6 · SCROLL REVEALS
     ──────────────────────────────────────────────── */
  const revealables = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(el => el.classList.add('in'));
  } else {
    const ro = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(el => ro.observe(el));
  }

  /* ────────────────────────────────────────────────
     7 · SELF-CHECK METER  (session only, nothing stored)
     ──────────────────────────────────────────────── */
  (function meter() {
    const boxes = $$('.checklist input[type=checkbox]');
    const fg    = $('#meterFg');
    const count = $('#meterCount');
    const label = $('#meterLabel');
    if (!boxes.length || !fg) return;

    const C = 2 * Math.PI * 52;
    const STATES = [
      [0,  'Not ready yet',   'var(--pink)'],
      [4,  'Getting there',   'var(--purple)'],
      [8,  'Almost ready',    'var(--teal)'],
      [10, 'Ready for Stage 2', 'var(--teal)']
    ];

    function update() {
      const done = boxes.filter(b => b.checked).length;
      fg.style.strokeDashoffset = String(C - (done / boxes.length) * C);
      count.textContent = done;
      let state = STATES[0];
      STATES.forEach(s => { if (done >= s[0]) state = s; });
      label.textContent = state[1];
      fg.style.stroke = state[2];
      if (done === boxes.length) toast('Stage 1 complete. The activities are yours now.');
    }

    boxes.forEach(b => b.addEventListener('change', update));
    fg.style.strokeDasharray = String(C);
    update();
  })();

  /* ────────────────────────────────────────────────
     8 · HOUSEKEEPING
     ──────────────────────────────────────────────── */
  window.addEventListener('beforeunload', Voice.stop);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      Voice.stop();
      $$('.playing').forEach(b => b.classList.remove('playing'));
    }
  });
})();
