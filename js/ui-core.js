/* LIFT UI core: helpers, data access, navigation and rendering, shared components.
   Every string that can come from data goes through esc() before it reaches innerHTML. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fmt = L.fmt, mmss = L.mmss;
const kgs = v => fmt(v) + ' kg';
const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const plural = (n, a, b) => `${n} ${n === 1 ? a : (b || a + 's')}`;
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dShort = s => { const d = L.parseDate(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const dLong = s => { const d = L.parseDate(s); return `${DAYL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}`; };
const dDay = s => { const d = L.parseDate(s); return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const hhmm = ts => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const today = () => L.localDate();

/* ---------- data access (cached; caches drop when the store changes) ---------- */
const D = {
  _st: null, _ex: new Map(), _w: null, _prs: null,
  settings() { return this._st || (this._st = L.mergeSettings(Store.one('settings'))); },
  saveSettings(patch) { const s = Object.assign({}, this.settings(), patch); Store.setOne('settings', s); this._st = s; return s; },
  ex(id) {
    if (this._ex.has(id)) return this._ex.get(id);
    const e = L.resolveExercise(id, Store.all('exercises'), Store.all('exprefs')) || {id, name: 'Unknown exercise', logType: 'barbell', variant: 'olympic', primary: 'core', secondary: [], rest: 120, missing: true};
    /* a weight stack with no step chosen yet: learn it from what was logged (cables at 6.25, 8.75 mean 2.5 kg steps) */
    if (e.logType === 'machine' && e.variant !== 'plates' && e.step == null) {
      const ws = []; for (const w of this.workouts()) for (const it of w.items) if (it.exId === id) for (const x of it.sets) if (x.done && x.kg) ws.push(+x.kg);
      const inf = L.inferStep(ws); if (inf && inf < 5) { e.step = inf; e.stepLearned = true; }
    }
    this._ex.set(id, e); return e;
  },
  library() { const c = Store.all('exercises').filter(e => !e.hidden); return c.map(e => this.ex(e.id)).concat(L.EX.map(e => this.ex(e.id))); },
  workouts() { return this._w || (this._w = Store.all('workouts').slice().sort((a, b) => -L.byDate(a, b))); },
  prs() { return this._prs || (this._prs = L.computePRs(this.workouts(), id => this.ex(id))); },
  session() { return Store.one('session', null); },
  saveSession(s) { Store.setOne('session', s); },
  meta() { return Store.one('meta', {}) || {}; },
  setMeta(patch) { const m = Object.assign({}, Store.one('meta', {}) || {}, patch); Store.setOne('meta', m); },
  weighins() { return Store.all('weighins').slice().sort((a, b) => a.date < b.date ? -1 : 1); },
  latestBw() { const w = this.weighins(); return w.length ? w[w.length - 1].kg : this.settings().bw; },
  templates() { return Store.all('templates').slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || (a.order || 0) - (b.order || 0)); },
  /* every logged set of one exercise, newest workout first */
  historyOf(exId) {
    const out = [];
    for (const w of this.workouts()) for (const it of w.items) if (it.exId === exId) { const sets = it.sets.filter(s => s.done); if (sets.length) out.push({w, it, sets}); }
    return out;
  },
  lastOf(exId) { return this.historyOf(exId)[0] || null; },
};
Store.onChange(what => {
  if (what === 'settings' || what === 'all' || what === 'external') D._st = null;
  if (['exercises', 'exprefs', 'all', 'external'].includes(what)) { D._ex.clear(); D._prs = null; }
  if (['workouts', 'all', 'external'].includes(what)) { D._w = null; D._prs = null; }
  if (what && what.error) toast('Could not save on this phone. Storage may be full: export a backup now.', {ms: 8000});
});

/* ---------- state and navigation (the Android back gesture closes sheets and goes back) ---------- */
const S = {view: 'home', p: {}, sheet: null, sp: {}};
const VIEWS = {}, SHEETS = {}, A = {}, IN = {}, STEP = {}, STRIP = {};
function nav(view, p = {}, {replace = false} = {}) {
  /* leaving from an open sheet: replace the sheet's history entry so Back does not reopen it */
  if (history.state && history.state.s) replace = true;
  S.view = view; S.p = p; S.sheet = null; S.sp = {};
  const st = {v: view, p};
  replace ? history.replaceState(st, '') : history.pushState(st, '');
  render(); window.scrollTo(0, 0);
}
function openSheet(name, sp = {}) {
  const replace = !!S.sheet;
  S.sheet = name; S.sp = sp;
  const st = {v: S.view, p: S.p, s: name, sp};
  replace ? history.replaceState(st, '') : history.pushState(st, '');
  renderSheet(true);
}
function closeSheet() { if (S.sheet) { if (history.state && history.state.s) history.back(); else { S.sheet = null; renderSheet(); render(); } } }
window.addEventListener('popstate', e => {
  const st = e.state || {v: defaultView(), p: {}};
  const sameView = st.v === S.view && JSON.stringify(st.p || {}) === JSON.stringify(S.p);
  const hadSheet = !!S.sheet;
  S.view = st.v; S.p = st.p || {}; S.sheet = st.s || null; S.sp = st.sp || {};
  /* closing a sheet redraws the screen under it too, so changes made in the sheet show at once */
  if (sameView) { renderSheet(); if (hadSheet && !S.sheet) render(); } else { render(); window.scrollTo(0, 0); }
});
function defaultView() { return Store.one('meta', {}) && (Store.one('meta', {}) || {}).setup ? 'log' : 'welcome'; }

/* ---------- render ---------- */
const view = document.getElementById('view'), dock = document.getElementById('dock'), layer = document.getElementById('layer');
function render() {
  const v = VIEWS[S.view] || VIEWS.log;
  let html;
  try { html = v.render(S.p || {}); }
  catch (err) { console.error(err); html = `<div class="card empty" style="margin-top:40px"><b>Something went wrong on this screen.</b><p class="lede">${esc(err.message)}</p><button class="btn" style="margin-top:14px" data-act="go" data-v="log">Back to Log</button></div>`; }
  view.innerHTML = html;
  view.classList.toggle('nodock', !v.dock);
  /* the Log screen keeps sideways swipes for itself (next / previous exercise); the browser only scrolls it up and down */
  view.classList.toggle('logv', S.view === 'log' && !!D.session());
  renderDock(v.dock);
  if (v.bind) try { v.bind(view); } catch (err) { console.error(err); }
  bindStrips(view);
  renderSheet();
  tick();
}
function renderSheet(fresh) {
  if (!S.sheet || !SHEETS[S.sheet]) { layer.classList.remove('open'); layer.innerHTML = ''; return; }
  const old = $('.sheet', layer), top = old && !fresh ? old.scrollTop : 0;
  const sh = SHEETS[S.sheet];
  let html;
  try { html = sh.render(S.sp || {}); } catch (err) { console.error(err); html = `<p class="lede">${esc(err.message)}</p>`; }
  layer.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet ${sh.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(sh.title || S.sheet)}"><button class="grab" data-grab aria-label="Close"></button>${html}</div>`;
  layer.classList.add('open');
  const el = $('.sheet', layer);
  if (!fresh) el.scrollTop = top;
  if (sh.bind) try { sh.bind(el); } catch (err) { console.error(err); }
  bindStrips(el);
  if (fresh && !sh.noFocus) { const f = $('[autofocus]', el); if (f) setTimeout(() => f.focus(), 60); }
}

/* ---------- dock: 4 tabs + the round button ---------- */
const TAB_OF = {log: 'log', history: 'history', detail: 'history', progress: 'progress', stats: 'stats'};
function renderDock(show) {
  if (!show) { dock.innerHTML = ''; return; }
  const on = TAB_OF[S.view];
  const tabs = [['log', 'log', 'Log'], ['history', 'hist', 'History'], ['progress', 'prog', 'Progress'], ['stats', 'stats', 'Stats']];
  const sess = D.session();
  dock.innerHTML = `<div class="in"><div class="tab" role="tablist">${tabs.map(([v, i, l]) => `<button role="tab" aria-selected="${on === v}" class="${on === v ? 'on' : ''}" data-act="tab" data-v="${v}">${ic(i)}${l}</button>`).join('')}</div>${sess ? `<button class="restb" id="restb" data-act="openRest" aria-label="Rest timer"></button>` : `<button class="fab" data-act="startSheet" aria-label="Start a workout">${ic('plus')}</button>`}</div>`;
}

/* ---------- toast ---------- */
let toastT = null;
function toast(msg, {action = null, ms = 3200, pr = false} = {}) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${pr ? `<b class="pr">PR</b> ` : ''}${esc(msg)}</span>${action ? `<button data-act="toastAct">${esc(action.label)}</button>` : ''}`;
  t.classList.add('show'); t._act = action && action.fn;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
A.toastAct = () => { const t = document.getElementById('toast'); const fn = t._act; t.classList.remove('show'); fn && fn(); };

/* ---------- haptics and sound ---------- */
let ac = null;
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; }
function bell() {
  if (!D.settings().sound) return;
  const c = audio(); if (!c) return;
  try { [[880, 0], [1175, .18], [1568, .36]].forEach(([f, t]) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.value = f; const s = c.currentTime + t; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.3, s + .02); g.gain.exponentialRampToValueAtTime(.001, s + .9); o.start(s); o.stop(s + .95); }); } catch (e) {}
}
const vib = p => { try { if (D.settings().haptics && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
const vibAlarm = p => { try { if (D.settings().vibrate && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
document.addEventListener('pointerdown', () => audio(), {once: true});

/* ---------- events: clicks, inputs, steppers with hold-to-repeat ---------- */
document.addEventListener('click', e => {
  /* steppers move on pointerdown (hold to repeat) and Enter; a click with no pointer behind it (VoiceOver, Voice Control, Switch Control) steps once */
  const sp = e.target.closest('[data-step]');
  if (sp && !sp.hasAttribute('data-act')) { if (e.detail === 0 && STEP[sp.dataset.step]) { STEP[sp.dataset.step](+sp.dataset.dir, Object.assign({}, sp.dataset), 1); vib(5); } return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  if (el.hasAttribute('data-step') && e.detail !== 0) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el.value, el.dataset, el); });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && IN[el.dataset.chg]) IN[el.dataset.chg](el, el.dataset); });
let holdT = null, holdI = null;
function stopHold() { clearTimeout(holdT); clearInterval(holdI); holdT = holdI = null; }
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-step]');
  if (!el || e.button > 0) return;
  e.preventDefault();
  const key = el.dataset.step, dir = +el.dataset.dir, ds = Object.assign({}, el.dataset);
  const go = n => { if (STEP[key]) { STEP[key](dir, ds, n); vib(5); } };
  go(1); stopHold();
  holdT = setTimeout(() => { let n = 1; holdI = setInterval(() => go(++n), 85); }, 420);
});
['pointerup', 'pointercancel', 'blur'].forEach(t => window.addEventListener(t, stopHold));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.sheet) closeSheet();
  const el = e.target.closest && e.target.closest('[data-step]');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); STEP[el.dataset.step] && STEP[el.dataset.step](+el.dataset.dir, el.dataset, 1); }
});
/* drag the grab handle down to close a sheet (mouse or touch) */
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grab]'); if (!g) return;
  const sh = g.closest('.sheet'), y0 = e.clientY; let dy = 0;
  g.setPointerCapture(e.pointerId);
  const mv = ev => { dy = Math.max(0, ev.clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
  const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); if (dy > 70 || dy < 4) { closeSheet(); return; } sh.classList.add('settle'); sh.style.transform = ''; setTimeout(() => sh.classList.remove('settle'), 220); };
  g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
});
A.closeSheet = () => closeSheet();
A.back = () => history.length > 1 ? history.back() : nav('log', {}, {replace: true});
A.go = d => nav(d.v, d.id ? {id: d.id} : {});
A.tab = d => { if (S.view === d.v && !S.sheet) { window.scrollTo({top: 0, behavior: 'smooth'}); return; } nav(d.v); };

/* ---------- swipe strip (scroll-snap; same caps, snap and notch everywhere) ---------- */
/* forId ties the strip to one set, so a late scroll event can never write into a different set */
function strip(key, values, cur, f = v => fmt(v), cls = '', label = 'value', forId = '') {
  let h = `<div class="notch" aria-hidden="true"></div><div class="strip ${cls}" data-strip="${key}" data-for="${esc(forId)}" role="listbox" aria-label="${esc(label)}">`;
  for (const v of values) { const on = Math.abs(v - cur) < 1e-9; h += `<button role="option" aria-selected="${on}" data-pick="${v}" class="${on ? 'on' : ''}" tabindex="${on ? 0 : -1}">${f(v)}</button>`; }
  return h + '</div>';
}
function bindStrips(root) {
  $$('[data-strip]', root).forEach(st => {
    const key = st.dataset.strip;
    /* measure on screen (not offsetLeft, whose origin depends on positioned ancestors) */
    const centre = r => r.left + r.width / 2;
    const on = $('.on', st) || $('button', st);
    if (on) st.scrollLeft += centre(on.getBoundingClientRect()) - centre(st.getBoundingClientRect());
    const init = on ? +on.dataset.pick : null;
    let cur = init, settle = null, armed = false;
    setTimeout(() => { armed = true; }, 80); /* ignore the scroll event caused by centring */
    const nearest = () => { const mid = centre(st.getBoundingClientRect()); let best = null, bd = 1e9; for (const b of st.children) { const d = Math.abs(centre(b.getBoundingClientRect()) - mid); if (d < bd) { bd = d; best = b; } } return best; };
    st.addEventListener('scroll', () => {
      /* a strip from a screen that was just replaced has no layout: ignore it */
      if (!armed || !st.isConnected || !st.clientWidth) return;
      const b = nearest(); if (!b) return;
      const v = +b.dataset.pick;
      if (v !== cur) { for (const x of st.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); } cur = v; vib(4); STRIP[key] && STRIP[key].live && STRIP[key].live(v, st); }
      clearTimeout(settle); settle = setTimeout(() => { if (st.isConnected && cur !== init && STRIP[key]) STRIP[key].set(cur, st); }, 140);
    }, {passive: true});
    st.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) b.scrollIntoView({behavior: 'smooth', inline: 'center', block: 'nearest'}); });
    st.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const b = nearest(); const n = e.key === 'ArrowLeft' ? b.previousElementSibling : b.nextElementSibling; if (n) { n.scrollIntoView({behavior: 'smooth', inline: 'center', block: 'nearest'}); n.focus({preventScroll: true}); } });
  });
}

/* ---------- small components ---------- */
const stepper = (lbl, val, key, ds = '') => `<div class="card st"><div style="min-width:0"><small>${lbl}</small><b>${val}</b></div><div class="pm"><button data-step="${key}" data-dir="-1" ${ds} aria-label="Less ${lbl.toLowerCase()}">−</button><button data-step="${key}" data-dir="1" ${ds} aria-label="More ${lbl.toLowerCase()}">+</button></div></div>`;
const sr = (t, right, sub = '', attrs = '') => { right = right.replace(/(class="tog"[^>]*aria-label=")([^"]*)(")/, (m, a, l, b) => /^[a-z]\w*$/.test(l) ? a + esc(String(t).replace(/<[^>]+>/g, '')) + b : m); return attrs ? `<button class="row" ${attrs}><div class="grow"><b class="t14">${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}</button>` : `<div class="row"><div class="grow"><b class="t14">${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`; };
const valc = v => `<span class="val">${v}${ic('chev', 'sm')}</span>`;
const tog = (key, on, label) => `<button class="tog" role="switch" aria-checked="${!!on}" aria-label="${esc(label || key)}" data-act="toggle" data-k="${key}"></button>`;
const segb = (act, opts, cur, extra = '') => `<div class="seg ${extra}" role="radiogroup">${opts.map(([v, l, dis]) => `<button role="radio" aria-checked="${String(v) === String(cur)}" class="${String(v) === String(cur) ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}" ${dis ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
function mrow(name, sets, range) {
  const max = 20, [a, b] = range || [0, 0];
  const st = !range ? 'ok' : sets < a ? 'under' : sets > b ? 'over' : 'ok';
  const v = Math.round(sets * 2) / 2;
  return `<div class="m"><span class="n">${esc(name)}</span><div class="tr">${range ? `<div class="band" style="left:${Math.min(a, max) / max * 100}%;width:${(Math.min(b, max) - Math.min(a, max)) / max * 100}%"></div>` : ''}<div class="fill" style="width:${Math.min(sets, max) / max * 100}%;background:var(--${st})"></div></div><span class="v" style="color:var(--${st})">${fmt(v)}</span></div>`;
}

/* ---------- drawings: bar, stack, plate-loaded machine (true-size Olympic plates) ---------- */
const PL = {25: [118, 22], 20: [118, 18], 15: [118, 15], 10: [118, 12], 5: [62, 11], 2.5: [54, 8], 2: [50, 7], 1.5: [47, 6], 1.25: [44, 6], 1: [44, 5], 0.5: [40, 4], 0.25: [36, 3]};
const shade = (hex, a) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + a)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
function plateRect(px, cy, k) {
  const c = L.PLATE_COLORS[k], [h, w] = PL[k];
  return `<rect x="${px}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${Math.min(4, w / 2)}" fill="${c}"/><rect x="${px + 1}" y="${cy - h / 2 + 3}" width="${Math.max(1, w * .35)}" height="${h - 6}" rx="1.5" fill="#fff" opacity=".28"/><rect x="${px + w - 2}" y="${cy - h / 2 + 2}" width="2" height="${h - 4}" fill="${shade(c, -60)}" opacity=".5"/>`;
}
function barSVG(total, bar, shape = 'olympic') {
  const st = D.settings(), W = 346, H = 128, cy = 64, mid = 173, col = 54;
  const {plates: ps} = L.splitPlates((total - bar) / 2, L.plateSet(st));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar loaded to ${fmt(total)} kg: ${ps.length ? ps.join(' + ') + ' per side' : 'empty bar'}">`;
  if (shape === 'ez') {
    const Lx = mid - col, R = mid + col, y = cy;
    const d = `M${Lx} ${y} H${Lx + 7} C${Lx + 13} ${y} ${Lx + 14} ${y + 11} ${Lx + 21} ${y + 11} C${Lx + 28} ${y + 11} ${Lx + 29} ${y - 9} ${Lx + 36} ${y - 9} C${Lx + 42} ${y - 9} ${Lx + 43} ${y - 3} ${Lx + 50} ${y - 3} H${R - 50} C${R - 43} ${y - 3} ${R - 42} ${y - 9} ${R - 36} ${y - 9} C${R - 29} ${y - 9} ${R - 28} ${y + 11} ${R - 21} ${y + 11} C${R - 14} ${y + 11} ${R - 13} ${y} ${R - 7} ${y} H${R}`;
    s += `<path d="${d}" fill="none" stroke="var(--rod)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.4" stroke-linecap="round" transform="translate(0 -1.8)"/>`;
  } else if (shape === 'trap') s += `<path d="M${mid - col} ${cy} L${mid - 30} ${cy - 34} L${mid + 30} ${cy - 34} L${mid + col} ${cy} L${mid + 30} ${cy + 34} L${mid - 30} ${cy + 34}Z" fill="none" stroke="var(--rod)" stroke-width="6" stroke-linejoin="round"/><path d="M${mid - 30} ${cy - 16} v32 M${mid + 30} ${cy - 16} v32" stroke="var(--sleeve)" stroke-width="8" stroke-linecap="round"/>`;
  else s += `<rect x="${mid - col}" y="${cy - 3}" width="${col * 2}" height="6" rx="3" fill="var(--rod)"/>`;
  if (shape === 'smith') s += `<rect x="34" y="4" width="6" height="${H - 8}" rx="3" fill="var(--frame)" opacity=".7"/><rect x="${W - 40}" y="4" width="6" height="${H - 8}" rx="3" fill="var(--frame)" opacity=".7"/>`;
  for (const side of [-1, 1]) {
    const cx = mid + side * col;
    s += `<rect x="${side < 0 ? cx - 10 : cx}" y="${cy - 11}" width="10" height="22" rx="3" fill="var(--sleeve)"/>`;
    let x = cx + side * 10;
    s += `<rect x="${side < 0 ? 6 : x}" y="${cy - 5}" width="${side < 0 ? x - 6 : W - 6 - x}" height="10" rx="4" fill="var(--sleeve)"/>`;
    for (const k of ps) { const w = PL[k][1]; s += plateRect(side < 0 ? x - w : x, cy, k); x += side * (w + 1); }
    if (ps.length) s += `<rect x="${side < 0 ? x - 7 : x}" y="${cy - 9}" width="7" height="18" rx="2" fill="#2b2e36"/>`;
  }
  return s + '</svg>';
}
function stackSVG(kg, step, n = 20) {
  const W = 346, H = 220, ph = Math.min(8.4, 168 / n), top = 22, x0 = 128, w = 90, pin = Math.max(1, Math.min(n, Math.round(kg / step))), lift = -10, gap = Math.min(1.4, ph * .17);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight stack, pin in plate ${pin}, ${fmt(kg)} kg"><rect x="${x0 - 14}" y="6" width="4" height="${H - 12}" rx="2" fill="var(--frame)"/><rect x="${x0 + w + 10}" y="6" width="4" height="${H - 12}" rx="2" fill="var(--frame)"/>`;
  s += `<rect x="${x0 + w / 2 - 2}" y="0" width="4" height="${top + lift}" fill="var(--chrome2)"/><rect x="${x0 + w / 2 - 4}" y="${top + lift - 6}" width="8" height="${pin * (ph + gap) + 6}" rx="2" fill="var(--chrome2)" opacity=".8"/>`;
  const every = n > 24 ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const on = i < pin, y = top + i * (ph + gap) + (on ? lift : 0);
    s += `<rect x="${x0}" y="${y}" width="${w}" height="${ph}" rx="2" fill="${on ? 'var(--stack-on)' : 'var(--stack)'}" opacity="${on ? 1 : .55}"/><rect x="${x0 + 2}" y="${y + 1}" width="${w - 4}" height="1.4" rx=".7" fill="#fff" opacity=".12"/>`;
    if ((i + 1) % every === 0) s += `<text x="${x0 + w + 22}" y="${y + ph - 1}" font-family="Manrope" font-weight="800" font-size="8.5" fill="var(--soft)">${fmt((i + 1) * step)}</text>`;
  }
  const py = top + (pin - 1) * (ph + gap) + lift + ph / 2;
  s += `<rect x="${x0 - 44}" y="${py - 2}" width="${44 + w / 2}" height="4" rx="2" fill="var(--chrome2)"/><circle cx="${x0 - 46}" cy="${py}" r="9" fill="#d7263d"/><text x="${x0 - 62}" y="${py + 4}" text-anchor="end" font-family="Manrope" font-weight="800" font-size="11" fill="var(--ink)">pin ${pin}</text>`;
  return s + '</svg>';
}
function machineSVG(perSide) {
  const W = 346, H = 150, cy = 78, {plates: ps} = L.splitPlates(perSide, L.plateSet(D.settings()));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ps.length ? ps.join(' + ') + ' kg per side' : 'No plates'}"><defs><linearGradient id="chromeH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#d9dee5"/><stop offset=".6" stop-color="#8b939f"/><stop offset="1" stop-color="#626975"/></linearGradient></defs><path d="M60 ${cy + 40} L286 ${cy + 40} L270 ${cy + 56} L76 ${cy + 56}Z" fill="var(--frame)" opacity=".55"/><rect x="128" y="${cy - 30}" width="90" height="70" rx="10" fill="var(--frame)" opacity=".8"/><rect x="134" y="${cy - 24}" width="78" height="30" rx="6" fill="#fff" opacity=".18"/>`;
  for (const side of [-1, 1]) {
    const base = side < 0 ? 128 : 218; let x = base;
    s += `<rect x="${side < 0 ? 40 : base}" y="${cy - 5}" width="${side < 0 ? base - 40 : W - 40 - base}" height="10" rx="4" fill="url(#chromeH)"/>`;
    x += side * 4;
    for (const k of ps) { const w = PL[k][1]; s += plateRect(side < 0 ? x - w : x, cy, k); x += side * (w + 1); }
  }
  return s + '</svg>';
}

/* ---------- line chart (SVG, no library) ---------- */
function lineChart(pts, {lo, hi, unit = '', label = 'Chart', dashed = null, h = 150} = {}) {
  const W = 310, H = h;
  if (!pts.length) return '';
  const xs = pts.map(p => p.x), all = pts.map(p => p.y).concat(dashed ? dashed.map(p => p.y) : []);
  let mn = lo != null ? lo : Math.min(...all), mx = hi != null ? hi : Math.max(...all);
  if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
  const padv = (mx - mn) * .12; mn -= padv; mx += padv;
  const x0 = Math.min(...xs, ...(dashed || []).map(p => p.x)), x1 = Math.max(...xs, ...(dashed || []).map(p => p.x));
  const X = x => x1 === x0 ? W / 2 : 10 + (x - x0) / (x1 - x0) * (W - 20), Y = y => H - 12 - (y - mn) / (mx - mn) * (H - 24);
  const path = ps => ps.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const ticks = []; for (let i = 0; i < 4; i++) ticks.push(mn + (mx - mn) * (i + .5) / 4);
  const nice = v => Math.abs(mx - mn) > 20 ? Math.round(v) : +v.toFixed(1);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  s += ticks.map(v => `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--track)"/><text x="${W}" y="${Y(v) - 3}" text-anchor="end" font-size="9" font-weight="700" fill="var(--soft)">${fmt(nice(v))}</text>`).join('');
  const line = path(pts);
  if (pts.length > 1) s += `<path d="${line} L${X(pts[pts.length - 1].x)} ${H} L${X(pts[0].x)} ${H}Z" fill="var(--ink)" opacity=".06"/><path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (dashed && dashed.length > 1) s += `<path d="${path(dashed)}" fill="none" stroke="var(--soft)" stroke-width="2" stroke-dasharray="5 5" stroke-linejoin="round"/>`;
  pts.forEach((p, i) => { if (p.pr) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="var(--ok)" stroke="var(--paper)" stroke-width="1.5"/>`; else if (i === pts.length - 1 || pts.length < 14) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${i === pts.length - 1 ? 4.5 : 2.6}" fill="var(--ink)" ${i === pts.length - 1 ? 'stroke="var(--paper)" stroke-width="2"' : ''}/>`; });
  return s + '</svg>';
}
function axisLabels(x0, x1) {
  const a = new Date(x0), b = new Date(x1);
  const mid = [];
  const d = new Date(a.getFullYear(), a.getMonth() + 1, 1);
  while (d < b && mid.length < 3) { mid.push(MON[d.getMonth()]); d.setMonth(d.getMonth() + 1); }
  return `<div class="axis"><span>${a.getDate()} ${MON[a.getMonth()]}</span>${mid.map(m => `<span>${m}</span>`).join('')}<span>${b.getDate()} ${MON[b.getMonth()]}</span></div>`;
}

/* ---------- file download (backup) ---------- */
function download(name, text, type = 'application/json') {
  const b = new Blob([text], {type});
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function pickFile(accept, cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f); r.onerror = () => toast('Could not read that file.'); r.readAsText(f); };
  i.click();
}
