/* LIFT motion: hooks around nav/render/sheets so the 20 motion rules work with innerHTML re-renders.
   Loaded last. Does nothing when the phone asks for reduced motion. */
(function () {
'use strict';
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const calm = () => mq.matches;
const raf = f => requestAnimationFrame(() => requestAnimationFrame(f));

/* ---------- 1 + 3 + 6 · stagger a new screen in ---------- */
function enter() {
  if (calm()) return;
  view.classList.remove('enter');
  [...view.children].forEach((c, i) => {
    c.style.setProperty('--i', Math.min(i, 8));
    const rows = c.matches('.list') ? c.children : c.querySelectorAll(':scope .list > .row, :scope .list > button.row, :scope .m');
    [...rows].forEach((r, j) => { r.style.setProperty('--r', Math.min(j, 10)); r.style.setProperty('--d', Math.min(i, 8) * 40 + 'ms'); });
  });
  void view.offsetWidth;
  view.classList.add('enter');
  clearTimeout(enter.t); enter.t = setTimeout(() => view.classList.remove('enter'), 1000);
}

/* ---------- 5 + 9 + 20 · one pill per group that slides between options ---------- */
const GROUPS = '.tab, .seg, .chips, .chipz';
let pending = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.tab>button, .seg>button, .chips>.chip, .chipz>button');
  if (!b || calm()) return;
  const g = b.parentElement, on = g.querySelector(':scope > .on');
  if (!on || on === b) return;
  const all = [...document.querySelectorAll(GROUPS)];
  pending = {idx: all.indexOf(g), dock: !!g.closest('#dock'), from: on.getBoundingClientRect(), t: Date.now()};
}, true);
function flipPill() {
  if (!pending || Date.now() - pending.t > 1500) { pending = null; return; }
  const p = pending, all = [...document.querySelectorAll(GROUPS)];
  const g = p.dock ? document.querySelector('#dock .tab') : all[p.idx];
  const on = g && g.querySelector(':scope > .on');
  if (!on) return;
  pending = null;
  const to = on.getBoundingClientRect(), gr = g.getBoundingClientRect(), cs = getComputedStyle(on);
  if (Math.abs(to.left - p.from.left) < 1 && Math.abs(to.top - p.from.top) < 1) return;
  /* dark chips: labels would vanish over a sliding dark pill, so the new chip fills in place instead */
  if (g.matches('.chips, .chipz')) { on.classList.add('chip-in'); setTimeout(() => on.classList.remove('chip-in'), 260); return; }
  const ghost = document.createElement('i');
  ghost.className = 'pill-ghost';
  Object.assign(ghost.style, {left: (to.left - gr.left) + 'px', top: (to.top - gr.top) + 'px', width: to.width + 'px', height: to.height + 'px',
    background: cs.backgroundColor, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow, transformOrigin: '0 0'});
  g.appendChild(ghost); on.classList.add('flip-hide');
  const dx = p.from.left - to.left, dy = p.from.top - to.top, sx = p.from.width / to.width;
  const midX = dx / 2 - (to.width * 0.06), stretch = ((sx + 1) / 2) * 1.12;
  ghost.animate([
    {transform: `translate(${dx}px,${dy}px) scaleX(${sx})`},
    {transform: `translate(${midX}px,${dy / 2}px) scaleX(${stretch})`, offset: 0.5},
    {transform: 'none'}
  ], {duration: 280, easing: 'cubic-bezier(.65,0,.35,1)'}).onfinish = () => { ghost.remove(); on.classList.remove('flip-hide'); };
}

/* ---------- 5 · switch knob travels and stretches ---------- */
let togPrev = null;
document.addEventListener('pointerdown', e => { const t = e.target.closest('.tog'); togPrev = t ? {k: t.dataset.k, on: t.getAttribute('aria-checked') === 'true'} : null; }, true);
function flipToggle() {
  if (!togPrev || calm()) return;
  const t = document.querySelector(`.tog[data-k="${togPrev.k}"]`); const was = togPrev.on; togPrev = null;
  if (!t || (t.getAttribute('aria-checked') === 'true') === was) return;
  const a = was ? 21 : 3, b = was ? 3 : 21;
  try { t.animate([{left: a + 'px', width: '22px'}, {left: Math.min(a, b) + 'px', width: '25px', offset: 0.5}, {left: b + 'px', width: '22px'}],
    {duration: 220, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::after'}); } catch (e) {}
}

/* ---------- 18 · dock button swaps (+ ↔ rest timer) crossfade with blur ---------- */
function dockKey() { const b = dock.querySelector('.fab, .restb'); return b ? b.className.split(' ')[0] : ''; }

/* ---------- wrap render: run the post-render effects ---------- */
const _render = render;
render = function () {
  const before = dockKey(), oldBtn = dock.querySelector('.fab, .restb');
  const oldRect = oldBtn && oldBtn.getBoundingClientRect(), oldHTML = oldBtn && oldBtn.outerHTML;
  _render.apply(this, arguments);
  flipPill(); flipToggle();
  const after = dockKey();
  if (!calm() && before && after && before !== after) {
    const nb = dock.querySelector('.fab, .restb'), wrap = dock.querySelector('.in');
    nb.classList.add('swap-in');
    const t = document.createElement('div'); t.innerHTML = oldHTML; const ob = t.firstChild;
    const wr = wrap.getBoundingClientRect();
    ob.classList.add('swap-out'); ob.removeAttribute('id'); Object.assign(ob.style, {left: (oldRect.left - wr.left) + 'px', top: (oldRect.top - wr.top) + 'px'});
    wrap.style.position = 'relative'; wrap.appendChild(ob);
    setTimeout(() => ob.remove(), 200);
  }
};

/* ---------- 16 · screen changes overlap (view transition) and then stagger in ---------- */
const _nav = nav;
nav = function () {
  const args = arguments;
  const go = () => { _nav.apply(this, args); enter(); };
  if (document.startViewTransition && !calm()) document.startViewTransition(go); else go();
};
window.addEventListener('popstate', () => { if (!S.sheet) enter(); });

/* ---------- 10 + 11 + 12 + 15 · sheets open from their trigger and leave towards it ---------- */
let lastX = null;
document.addEventListener('pointerdown', e => { if (!e.target.closest('#layer .sheet')) lastX = e.clientX; }, true);
const _renderSheet = renderSheet;
renderSheet = function (fresh) {
  const el = layer.querySelector('.sheet');
  if (!S.sheet && el && !calm()) {
    if (layer._leaving) return;
    layer._leaving = true; layer.classList.add('leaving');
    el.classList.add('leave'); const sc = layer.querySelector('.scrim'); sc && sc.classList.add('leave');
    setTimeout(() => { layer._leaving = false; layer.classList.remove('leaving'); _renderSheet(fresh); }, 240);
    return;
  }
  if (S.sheet && layer._leaving) { layer._leaving = false; layer.classList.remove('leaving'); fresh = true; }
  _renderSheet.apply(this, arguments);
  flipPill(); flipToggle();
  if (fresh && !calm()) {
    const s = layer.querySelector('.sheet'), sc = layer.querySelector('.scrim');
    if (s) {
      const r = s.getBoundingClientRect();
      if (lastX != null) s.style.setProperty('--ox', Math.max(0, Math.min(r.width, lastX - r.left)) + 'px');
      s.classList.add('enter'); sc && sc.classList.add('enter');
      setTimeout(() => { s.classList.remove('enter'); sc && sc.classList.remove('enter'); }, 320);
    }
  }
};

/* ---------- 7 + 8 + 17 · logging a set: arc, pulse, green fill ---------- */
const logSet = A.logSet;
if (logSet) A.logSet = (d, el, e) => {
  const from = el && el.getBoundingClientRect();
  logSet(d, el, e);
  if (calm() || !from) return;
  raf(() => {
    const cur = document.querySelector('.sets2 .cur');
    const done = cur ? cur.previousElementSibling : [...document.querySelectorAll('.sets2 button:not(.n)')].pop();
    const b = document.querySelector('.logb');
    if (b) { b.classList.remove('ok'); void b.offsetWidth; b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 700);
      [...b.children].forEach(c => c.classList.add('swap-in')); }
    if (!done) return;
    const to = done.getBoundingClientRect();
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
    const dot = document.createElement('i'); dot.className = 'arc-dot'; document.body.appendChild(dot);
    const lift = Math.max(60, Math.abs(x1 - x0) * 0.4);
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - lift;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      pts.push({transform: `translate(${x}px,${y}px) scale(${1 - t * 0.3})`}); }
    dot.animate(pts, {duration: 420, easing: 'cubic-bezier(.65,0,.35,1)'}).onfinish = () => {
      dot.remove(); const d2 = document.querySelector('.sets2 .cur') ? document.querySelector('.sets2 .cur').previousElementSibling : done;
      if (d2) { d2.classList.remove('pulse'); void d2.offsetWidth; d2.classList.add('pulse'); }
    };
  });
};

/* ---------- 14 + 19 · steppers: nudge on a tap, nothing while held, rubber band at a limit ---------- */
const valOf = (key, dir) => { const b = document.querySelector(`[data-step="${key}"][data-dir="${dir}"]`); const c = b && b.closest('.st, .repsc, .card, .row'); return c && c.querySelector('b'); };
Object.keys(STEP).forEach(key => {
  const fn = STEP[key];
  STEP[key] = function (dir, ds, n) {
    if (n > 1) document.documentElement.classList.add('holding');
    const v0 = valOf(key, dir), t0 = v0 && v0.textContent;
    const r = fn.apply(this, arguments);
    if (calm() || n > 1) return r;
    const v1 = valOf(key, dir);
    if (!v1) return r;
    const cls = v1.textContent === t0 ? (dir < 0 ? 'rubber-l' : 'rubber-r') : 'bump';
    v1.classList.remove('bump', 'rubber-l', 'rubber-r'); void v1.offsetWidth; v1.classList.add(cls);
    return r;
  };
});
['pointerup', 'pointercancel', 'blur'].forEach(t => window.addEventListener(t, () => document.documentElement.classList.remove('holding')));

/* first paint also staggers in */
enter();
})();
