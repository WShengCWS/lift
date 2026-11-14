/* LIFT logging: the workout in progress, the 7 log screens, rest timer, overview, library, finish. */
'use strict';

/* ---------- defaults and planning ---------- */
const CDEF = {run: {sec: 1500, m: 5000, incline: 1}, walk: {sec: 1800, m: 3000, incline: 10}, bike: {sec: 1800, m: 12000, resistance: 8}, row: {sec: 1200, m: 5000}, ski: {sec: 900, m: 3000},
  stairs: {sec: 1200, floors: 60, level: 9}, elliptical: {sec: 1800, m: 4500, resistance: 6}, airbike: {sec: 600, cal: 120, level: 7}, rope: {sec: 600, jumps: 1500}, '': {sec: 1800, m: 0}};
const DIST_STEP = {run: 500, walk: 200, bike: 1000, elliptical: 500, row: 250, ski: 250, '': 500};
function blankSet(e, reps) {
  const st = D.settings(), s = {id: Store.uid('s'), type: 'working', done: false};
  switch (e.logType) {
    case 'barbell': s.kg = L.barFor(e, st); s.reps = reps || 8; break;
    case 'rack': s.kg = e.variant === 'kettlebell' ? L.snapWeight(e, st, 16) : e.variant === 'plate' ? 10 : L.snapWeight(e, st, 10); s.reps = reps || 10; break;
    case 'machine': { const m = L.machineFor(e, st); s.kg = m.kind === 'plates' ? (m.sled || 0) + 20 : 5 * L.stepFor(e, st); s.reps = reps || 10; break; }
    case 'bodyweight': s.mode = 'plain'; s.add = 0; s.reps = reps || 8; s.atype = 'band'; s.band = 'medium'; break;
    case 'band': s.band = (st.bands[1] || st.bands[0] || {}).id; s.reps = reps || 15; break;
    case 'timed': s.sec = 0; s.target = 60; s.add = 0; break;
    case 'cardio': Object.assign(s, CDEF[e.variant] || CDEF['']); break;
  }
  if (e.unilateral && ['barbell', 'rack', 'machine', 'bodyweight', 'band'].includes(e.logType)) { s.l = s.reps; s.r = s.reps; }
  if (e.distance) { s.m = 20; s.sec = 30; }
  return s;
}
const COPY = ['kg', 'reps', 'l', 'r', 'add', 'mode', 'atype', 'band', 'sec', 'target', 'm', 'floors', 'cal', 'jumps', 'incline', 'resistance', 'level'];
function copySet(from, e) { const s = blankSet(e); for (const k of COPY) if (from[k] != null) s[k] = from[k]; s.type = from.type === 'failure' ? 'working' : (from.type || 'working'); return s; }
function planSets(e, n, reps) {
  const last = D.settings().fillLast ? D.lastOf(e.id) : null;
  const src = last ? last.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop') : [];
  if (e.logType === 'cardio') n = 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = src[i] || src[src.length - 1];
    const s = f ? copySet(f, e) : blankSet(e, reps);
    if (reps && f && !e.unilateral && s.reps != null) s.reps = Math.max(s.reps, 1);
    s.type = 'working'; out.push(s);
  }
  return out;
}
function makeItem(exId, n = 3, reps = 0, link = false) { const e = D.ex(exId); return {uid: Store.uid('i'), exId, link, targetReps: reps || 0, sets: planSets(e, n, reps)}; }

/* ---------- session helpers ---------- */
const curItem = s => s.items.find(i => i.uid === s.cur) || s.items[0];
function curIdx(it) { if (it.si != null && it.sets[it.si] && !it.sets[it.si].done) return it.si; return it.sets.findIndex(x => !x.done); }
function groups(s) { const out = []; let g = []; s.items.forEach((it, i) => { g.push(it); if (!it.link || i === s.items.length - 1) { out.push(g); g = []; } }); return out; }
const groupOf = (s, it) => groups(s).find(g => g.includes(it)) || [it];
function groupLabels(s) { const lab = {}; let n = 0; for (const g of groups(s)) if (g.length > 1) { n++; g.forEach((it, i) => lab[it.uid] = String.fromCharCode(64 + n) + (i + 1)); } return lab; }
function elapsed(s) { const t = Math.max(0, Math.floor((Date.now() - s.start) / 1000)); const h = Math.floor(t / 3600); return h ? `${h}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : mmss(t); }
function nextItem(s, it) { const i = s.items.indexOf(it); return s.items.slice(i + 1).find(x => curIdx(x) >= 0) || s.items.slice(0, i).find(x => curIdx(x) >= 0) || null; }
function restFor(e, set) {
  const st = D.settings();
  if (set.type === 'warmup') return 0;
  if (e.logType === 'cardio') return 0;
  return st.restPerExercise ? (e.rest != null ? e.rest : st.rest) : st.rest;
}
function startWorkout({title = 'Workout', templateId = null, items = []}) {
  const s = {id: Store.uid('w'), title, templateId, date: today(), start: Date.now(), items: items.map(t => makeItem(t.exId, t.sets || 3, t.reps || 0, !!t.link)), rest: null, note: ''};
  s.cur = s.items.length ? s.items[0].uid : null;
  if (templateId) { const t = Store.get('templates', templateId); if (t) Store.put('templates', Object.assign({}, t, {lastUsed: Date.now()})); }
  D.saveSession(s); wake(); nav('log');
}
function sessionAsWorkout(s) { return {id: s.id, date: s.date, start: s.start, items: s.items.map(it => ({exId: it.exId, sets: it.sets.filter(x => x.done)}))}; }
function prTagsFor(s) { return L.computePRs(D.workouts().concat([sessionAsWorkout(s)]), id => D.ex(id)); }

/* ---------- labels ---------- */
function eqLabel(e) {
  const st = D.settings();
  switch (e.logType) {
    case 'barbell': return e.variant === 'smith' ? `Machine, Smith bar ${fmt(L.barFor(e, st))} kg` : e.variant === 'ez' ? `Barbell, EZ curl bar ${fmt(L.barFor(e, st))} kg` : e.variant === 'trap' ? `Barbell, trap bar ${fmt(L.barFor(e, st))} kg` : `Barbell, Olympic ${fmt(st.bar)} kg`;
    case 'rack': return e.variant === 'kettlebell' ? (e.pair ? 'Kettlebells, pair' : 'Kettlebell') : e.variant === 'plate' ? 'Single plate' : e.unilateral ? 'Dumbbell, one side at a time' : e.pair ? 'Dumbbells, pair' : 'Dumbbell';
    case 'machine': return e.variant === 'plates' ? 'Machine, plate-loaded' : (/cable|pulldown|pushdown|face pull|pallof|crunch|kickback|fly|row/i.test(e.name) && !/machine|pec deck/i.test(e.name) ? 'Cable, weight stack' : 'Machine, weight stack');
    case 'bodyweight': return 'Bodyweight';
    case 'band': return 'Resistance band';
    case 'timed': return 'Timed hold';
    case 'cardio': return 'Cardio, ' + (L.VARIANT_LABEL[e.variant] || 'time and distance');
  }
  return '';
}
function bandOf(id) { return D.settings().bands.find(b => b.id === id) || {id, name: 'Band', color: '#888', kg: 0}; }
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
function setShort(x, e) {
  if (!e) return '';
  if (e.logType === 'cardio') return Math.round((x.sec || 0) / 60) + ' min';
  if (e.logType === 'timed') return mmss(x.sec || 0) + (x.add ? ` +${fmt(x.add)}` : '');
  if (e.logType === 'band') return `${esc(bandOf(x.band).name)} × ${e.unilateral ? `${x.l || 0}/${x.r || 0}` : x.reps || 0}`;
  const reps = e.unilateral ? `${x.l || 0}/${x.r || 0}` : (x.reps || 0);
  if (e.distance) return `${fmt(x.kg)} × ${x.m || 0} m`;
  if (e.logType === 'bodyweight') return `${x.mode === 'plain' || !x.add ? 'BW' : signed(x.add)} × ${reps}`;
  return `${fmt(x.kg)} × ${reps}`;
}
function setLong(x, e) {
  if (!e) return '';
  if (e.logType === 'cardio') { const d = L.cardioDerived(e, x, D.latestBw()); const bits = [Math.round((x.sec || 0) / 60) + ' min']; if (x.m) bits.push(x.m >= 1000 && !['row', 'ski'].includes(e.variant) ? fmt(x.m / 1000) + ' km' : x.m + ' m'); if (x.floors) bits.push(x.floors + ' floors'); if (x.cal) bits.push(x.cal + ' cal'); if (x.jumps) bits.push(x.jumps + ' jumps'); if (d.pairs[0]) bits.push(d.pairs[0][1] + ' ' + d.pairs[0][0].toLowerCase().replace('pace ', '')); return bits.join(', '); }
  if (e.logType === 'timed') return mmss(x.sec || 0) + (x.add ? ` with ${fmt(x.add)} kg` : '');
  if (e.logType === 'band') return `${esc(bandOf(x.band).name)} band × ${e.unilateral ? `${x.l || 0} / ${x.r || 0}` : x.reps || 0}`;
  const reps = e.unilateral ? `${x.l || 0} / ${x.r || 0}` : (x.reps || 0);
  if (e.logType === 'bodyweight') return `${x.mode === 'assisted' ? `BW − ${fmt(Math.abs(x.add))} kg` : x.add ? `BW + ${fmt(x.add)} kg` : 'BW'} × ${reps}`;
  if (e.distance) return `${e.pair ? '2 × ' : ''}${fmt(x.kg)} kg × ${x.m || 0} m${x.sec ? ', ' + mmss(x.sec) : ''}`;
  return `${e.pair ? '2 × ' : ''}${fmt(x.kg)} kg × ${reps}`;
}
const typeLetter = t => t === 'warmup' ? 'W' : t === 'drop' ? 'D' : t === 'failure' ? 'F' : '';

/* ---------- the Log tab ---------- */
VIEWS.log = {dock: true, render(p) {
  const s = D.session();
  if (!s) return VIEWS.home.render(p);
  if (!s.items.length) return `${dayLine(s)}<div class="card empty" style="margin-top:24px"><div class="serif" style="font-size:34px;line-height:1.05">Empty workout.</div><p class="lede">Add the first exercise. Everything you log saves straight away.</p><button class="btn" style="margin-top:14px" data-act="library" data-m="add">${ic('plus', 'sm')}Add exercise</button><button class="btn2" style="margin-top:8px;width:100%" data-act="wopts">Workout options</button></div>`;
  const it = curItem(s), e = D.ex(it.exId), i = curIdx(it);
  return logScreen(s, it, e, i);
}, bind(el) { if (D.session()) bindLog(el); else VIEWS.home.bind && VIEWS.home.bind(el); }};
const dayLine = s => `<button class="dayb" data-act="overview" aria-label="Open workout overview">${esc(s.title)}, <span data-elapsed>${elapsed(s)}</span>${ic('down', 'xs')}</button>`;
function setPill(s, it, e, i) {
  const grp = groupOf(s, it);
  if (i < 0) return `Done, ${plural(it.sets.filter(x => x.done && x.type !== 'warmup').length, 'set')}`;
  const c = it.sets[i];
  if (e.logType === 'cardio') return 'Session';
  if (grp.length > 1) { const rounds = Math.max(...grp.map(g => g.sets.filter(x => x.type !== 'warmup').length)); const r = it.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop').indexOf(c) + 1; return `Round ${Math.max(1, r)} / ${rounds}`; }
  if (c.type === 'warmup') { const w = it.sets.filter(x => x.type === 'warmup'); return `Warm-up ${w.indexOf(c) + 1} / ${w.length}`; }
  if (c.type === 'drop') return 'Drop set';
  const work = it.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop');
  return `Set ${work.indexOf(c) + 1} / ${work.length}`;
}
function logHead(s, it, e, i) {
  return `<div class="hd loghd"><div style="min-width:0">${dayLine(s)}<button class="exh" data-act="exopts" aria-label="Options for ${esc(e.name)}"><h3>${esc(e.name)}</h3><span class="eqc">${esc(eqLabel(e))}</span></button>${e.note ? `<div class="pin">${ic('pin', 'xs')}<span>${esc(e.note)}</span></div>` : ''}</div><button class="pillx" data-act="overview">${setPill(s, it, e, i)}</button></div>`;
}
function supersetCard(s, it) {
  const grp = groupOf(s, it); if (grp.length < 2) return '';
  const lab = groupLabels(s), show = grp.slice(0, 3);
  const half = g => { const e = D.ex(g.uid === it.uid ? it.exId : g.exId), j = curIdx(g), c = j >= 0 ? g.sets[j] : g.sets[g.sets.length - 1]; return `<button class="ssh ${g === it ? 'on' : ''}" data-act="jump" data-uid="${g.uid}" aria-pressed="${g === it}"><span class="ss">${lab[g.uid]}</span><b>${esc(e.name)}</b><small>${c ? setShort(c, e) : ''}${g === it ? ', now' : j < 0 ? ', done' : ''}</small></button>`; };
  return show.length === 2 ? `<div class="card ssc">${half(show[0])}<span class="sslink" aria-hidden="true">${ic('link', 'sm')}</span>${half(show[1])}</div>` : `<div class="card ssc n3">${show.map(half).join('')}</div>`;
}
function lastTop(e) { const l = D.lastOf(e.id); if (!l) return null; const w = l.sets.filter(x => x.type !== 'warmup'); return w.length ? w : null; }
function lastText(e) { const w = lastTop(e); if (!w) return 'first time'; const top = w.reduce((a, b) => (+b.kg || 0) > (+a.kg || 0) ? b : a, w[0]); return 'last ' + setShort(top, e); }

function logScreen(s, it, e, i) {
  const st = D.settings();
  const done = i < 0, c = done ? Object.assign({}, it.sets[it.sets.length - 1] || blankSet(e)) : it.sets[i];
  let h = logHead(s, it, e, i) + supersetCard(s, it);
  const body = LOGTYPE[e.logType] || LOGTYPE.barbell;
  if (done) {
    /* every planned set is logged: a summary, not dead steppers */
    const real = it.sets.filter(x => x.done && x.type !== 'warmup'), prs = prTagsFor(s);
    const best = real.length ? real.reduce((a, b) => L.setVolume(b, e) > L.setVolume(a, e) ? b : a) : null;
    h += `<div class="bigw mid">${real.length}<em> ${real.length === 1 ? 'set' : 'sets'}</em></div><div class="subw">${best ? 'best ' + setShort(best, e) : 'warm-ups only'}${real.some(x => prs.has(x.id)) ? ', <span class="okm">PR</span>' : ''}</div>`;
  } else h += body(s, it, e, c, i);
  /* set type (Warm-up / Working / Drop / Failure); Working is preselected so it costs no taps */
  if (!done && ['barbell', 'rack', 'machine', 'bodyweight'].includes(e.logType) && !e.distance) {
    const canDrop = e.logType !== 'bodyweight' && it.sets.slice(0, i).some(x => x.done && x.type !== 'warmup');
    h += `<div class="seg wide stype" role="radiogroup" aria-label="Set type">${[['warmup', 'Warm-up'], ['working', 'Working'], ['drop', 'Drop'], ['failure', 'Failure']].map(([k, l]) => `<button role="radio" aria-checked="${c.type === k}" class="${c.type === k ? 'on' : ''}" data-act="stype" data-v="${k}" ${k === 'drop' && !canDrop && c.type !== 'drop' ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
  }
  if (!done && st.rpe && e.logType !== 'cardio') h += `<div class="chipz" style="justify-content:center" aria-label="RPE"><span class="lbl" style="align-self:center;margin-right:4px">RPE</span>${[6, 7, 8, 9, 10].map(v => `<button class="${c.rpe === v ? 'on' : ''}" data-act="rpe" data-v="${v}">${v}</button>`).join('')}</div>`;
  if (done) {
    const nx = nextItem(s, it);
    h += nx ? `<button class="logb" data-act="jump" data-uid="${nx.uid}">Next: ${esc(D.ex(nx.exId).name)}</button>` : `<button class="logb" data-act="finish">${ic('check')}Finish workout</button>`;
    const lastReal = it.sets.filter(x => x.done && x.type !== 'warmup').pop();
    const dropOk = lastReal && ['barbell', 'rack', 'machine'].includes(e.logType) && !e.distance;
    if (dropOk) h += `<div class="btns"><button class="btn2" data-act="addDrop">Drop set, ${fmt(L.dropWeight(e, lastReal.kg, st))} kg</button></div>`;
  } else h += logButton(s, it, e, c);
  if (!done && c.type === 'drop') h += `<div class="capx" style="margin-top:8px">No rest timer for a drop. Strip the plates and go.</div>`;
  if (!done) { const grp = groupOf(s, it); if (grp.length > 1) { const pos = grp.indexOf(it), nx = grp.slice(pos + 1).find(x => curIdx(x) >= 0); h += `<div class="capx" style="margin-top:8px">${nx ? `Then straight to ${groupLabels(s)[nx.uid]}, ${esc(D.ex(nx.exId).name)}. No rest in between.` : `Rest ${mmss(restFor(e, c))} starts after this set.`}</div>`; } }
  h += tiles(s, it, e, i);
  if (!done) h += `<button class="mapl" data-act="setNote" style="font-weight:700;color:var(--soft)">${c.note ? `${ic('note', 'xs')} ${esc(c.note)}` : 'Add a note to this set'}</button>`;
  /* always-visible way to add a movement mid-workout (owner request, 2026-11-09) */
  h += `<div class="exrow"><button class="btn2" data-act="library" data-m="add">${ic('plus', 'sm')}Add exercise</button><button class="btn2" data-act="overview">${ic('more', 'sm')}All exercises (${s.items.length})</button></div>`;
  return h;
}
function logButton(s, it, e, c) {
  if (e.logType === 'timed') {
    const run = s.hold && s.hold.setId === c.id;
    return run ? `<button class="logb" data-act="holdStop">${ic('stop', 'sm')}Stop and log: <span data-hold>${mmss((Date.now() - s.hold.start) / 1000)}</span></button>` : `<button class="logb" data-act="holdStart">${ic('timer')}Start hold</button>${c.sec ? `<div class="btns"><button class="btn2" data-act="logSet">${ic('check', 'sm')}Log ${mmss(c.sec)} as typed</button></div>` : ''}`;
  }
  if (e.logType === 'cardio') return `<button class="logb" data-act="logSet">${ic('check')}Log ${esc(e.name.toLowerCase())}, ${Math.round((c.sec || 0) / 60)} min</button>`;
  const verb = {warmup: 'Log warm-up', working: 'Log set', drop: 'Log drop', failure: 'Log failure set'}[c.type || 'working'];
  if (e.distance) return `<button class="logb" data-act="logSet">${ic('check')}Log carry: ${fmt(c.kg)} kg × ${c.m || 0} m</button>`;
  return `<button class="logb" data-act="logSet">${ic('check')}<span data-logtxt>${verb}: ${setShort(c, e)}</span></button>`;
}
function tiles(s, it, e, i) {
  if (e.logType === 'cardio') return '';
  const prs = prTagsFor(s);
  const tile = (x, j) => `<button class="${x.done ? '' : j === i ? 'cur' : 'n'} ${prs.has(x.id) ? 'pr' : ''}" data-act="tile" data-i="${j}" aria-label="${x.done ? 'Edit' : 'Go to'} set ${j + 1}${prs.has(x.id) ? ', personal record' : ''}${x.done ? '' : '. Press and hold to remove'}">${['drop', 'failure'].includes(x.type) ? `<i>${typeLetter(x.type)}</i>` : ''}${setShort(x, e)}</button>`;
  const warm = it.sets.map((x, j) => [x, j]).filter(([x]) => x.type === 'warmup'), work = it.sets.map((x, j) => [x, j]).filter(([x]) => x.type !== 'warmup');
  const plus = (act, lbl) => `<button class="add" data-act="${act}" aria-label="${lbl}">${ic('plus', 'sm')}</button>`;
  let h = '';
  if (warm.length) h += `<div class="rowlbl">Warm-up</div><div class="sets2 warm" data-tiles>${warm.map(([x, j]) => tile(x, j)).join('')}${plus('addWarmSet', 'Add a warm-up set')}</div>`;
  h += `${warm.length ? '<div class="rowlbl">Working sets</div>' : ''}<div class="sets2" data-tiles>${work.map(([x, j]) => tile(x, j)).join('')}${plus('addSet', 'Add a set')}</div>`;
  return h;
}
function bindLog(el) {
  $$('[data-tiles]', el).forEach(t => { const cur = $('.cur', t); t.scrollLeft = cur ? cur.offsetLeft - t.offsetLeft - t.clientWidth / 2 + cur.offsetWidth / 2 : t.scrollWidth; });
}

/* ---------- per-type bodies ---------- */
function hintsRow(s, it, e, c) {
  const st = D.settings(), out = [];
  const anyDone = it.sets.some(x => x.done), workDone = it.sets.some(x => x.done && x.type !== 'warmup');
  let pill = '';
  if (!workDone && !it.sugApplied && c.type === 'working') {
    const last = D.lastOf(e.id), sug = last ? L.suggestion(e, last.sets, it.targetReps, st) : null;
    if (sug && c.kg <= sug.from) out.push(`<button class="hint up" data-act="applySug" data-kg="${sug.kg}">${ic('up', 'sm')}Try ${fmt(sug.kg)} kg<small>+1 step</small></button>`);
  }
  if (['barbell', 'machine'].includes(e.logType) && st.warmups !== 'off' && !anyDone && !it.sets.some(x => x.type === 'warmup') && c.type !== 'warmup' && L.warmups(e, c.kg, st).length) out.push(`<button class="hint" data-act="addWarm">${ic('plus', 'sm')}Add warm-ups</button>`);
  if (c.type === 'drop') { const prev = it.sets.slice(0, it.sets.indexOf(c)).filter(x => x.done).pop(); if (prev) pill = `<div class="delta"><span class="n">${signed(c.kg - prev.kg)} kg, ${st.drop}% drop</span></div>`; }
  else if (!out.length && c.type !== 'warmup') {
    const w = lastTop(e);
    if (w) { const top = Math.max(...w.map(x => +x.kg || 0)), d = (+c.kg || 0) - top; pill = `<div class="delta"><span class="${d > 0 ? '' : 'n'}">${d === 0 ? 'same as last time' : `${signed(d)} kg vs last time`}</span></div>`; }
  }
  return pill + (out.length ? `<div class="hints">${out.join('')}</div>` : '');
}
const bigKg = kg => `<button class="bigw bigbtn" data-act="typeKg" data-big aria-label="${fmt(kg)} kg. Tap to type a weight">${fmt(kg)}<em> kg</em></button>`;
/* A6: "last 50 × 6" opens every set from last time */
const lastBtn = e => `<button class="lastb" data-act="lastPeek" aria-label="Show last session">${lastText(e)}</button>`;
function repsSteppers(e, c, lblW = 'Weight', wVal) {
  if (e.unilateral) return `<div class="steps">${stepper('Left', c.l || 0, 'cur', 'data-f="l"')}${stepper('Right', c.r || 0, 'cur', 'data-f="r"')}</div><div class="capx" style="margin-top:6px">${(c.l || 0) === (c.r || 0) ? 'Even on both sides' : `Right is ${Math.abs((c.l || 0) - (c.r || 0))} rep${Math.abs((c.l || 0) - (c.r || 0)) > 1 ? 's' : ''} ${(c.r || 0) < (c.l || 0) ? 'behind' : 'ahead'}`}</div>${wVal != null ? `<div class="steps one">${stepper(lblW, wVal, 'cur', 'data-f="kg"')}</div>` : ''}`;
  return `<div class="steps">${stepper(lblW, wVal, 'cur', 'data-f="kg"')}${stepper('Reps', c.reps || 0, 'cur', 'data-f="reps"')}</div>`;
}
function distanceBlock(c) {
  return `<div class="chipz" style="justify-content:center;margin-top:10px">${[20, 30, 40, 60, 80].map(m => `<button class="${m === c.m ? 'on' : ''}" data-act="setF" data-f="m" data-v="${m}">${m} m</button>`).join('')}</div><div class="steps">${stepper('Metres', c.m || 0, 'cur', 'data-f="m"')}${stepper('Seconds', c.sec || 0, 'cur', 'data-f="sec"')}</div>`;
}
const LOGTYPE = {
  barbell(s, it, e, c) {
    const st = D.settings(), bar = L.barFor(e, st), sp = L.splitPlates((c.kg - bar) / 2, L.plateSet(st));
    const prev = c.type === 'drop' ? it.sets.slice(0, it.sets.indexOf(c)).filter(x => x.done).pop() : null;
    const tail = prev ? `was ${L.splitPlates((prev.kg - bar) / 2, L.plateSet(st)).plates.join(' + ') || 'nothing'}` : `steps of ${fmt(L.stepFor(e, st))} kg`;
    return `${bigKg(c.kg)}<div class="subw">${lastBtn(e)}</div>${hintsRow(s, it, e, c)}<div class="card vis">${barSVG(c.kg, bar, e.variant)}<div class="capx">${prev ? '' : fmt(bar) + ' kg bar, '}per side ${sp.plates.join(' + ') || 'nothing'}${sp.rest ? ` <b style="color:var(--under)">· ${fmt(sp.rest)} short</b>` : ''}, ${tail}</div></div>${e.unilateral ? repsSteppers(e, c, 'Weight', fmt(c.kg)) : repsSteppers(e, c, 'Weight', fmt(c.kg))}`;
  },
  rack(s, it, e, c) {
    const st = D.settings();
    let vis;
    if (e.variant === 'kettlebell') vis = `<div class="notch" aria-hidden="true"></div><div class="strip" data-strip="kg" data-for="${esc(c.id)}" role="listbox" aria-label="Kettlebell">${st.kettlebells.slice().sort((a, b) => a - b).map(k => { const col = L.KB_COLORS[k] || '#555b67', lt = [4, 6, 10, 14, 16, 18, 22, 40].includes(k); return `<button role="option" data-pick="${k}" class="${k === c.kg ? 'on' : ''}" style="background:radial-gradient(circle at 38% 30%,#ffffff55,transparent 45%),${col};color:${lt ? '#222' : '#fff'}">${k}</button>`; }).join('')}</div><div class="capx">swipe the kettlebells your gym has</div>`;
    else if (e.variant === 'plate') vis = `<div class="plates">${[1.25, 2.5, 5, 10, 15, 20, 25].map(k => { const [hh] = PL[k]; const d = Math.max(26, hh * .36); return `<button data-act="setF" data-f="kg" data-v="${k}" class="${k === c.kg ? 'on' : ''}" aria-label="${k} kilogram plate"><span style="width:${d}px;height:${d}px;background:${L.PLATE_COLORS[k]};color:${[5, 1.25].includes(k) ? 'var(--plate-lt-ink)' : [15, 10].includes(k) ? 'var(--on-ok)' : 'var(--on-fill)'}">${fmt(k)}</span></button>`; }).join('')}</div><div class="capx">tap the plate you are holding</div>`;
    else vis = `${strip('kg', L.dumbbellRange(st), c.kg, v => fmt(v), '', 'Dumbbell weight', c.id)}<div class="capx">swipe the rack, ${fmt(st.dbMin)} to ${fmt(st.dbMax)} kg, every ${fmt(st.steps.dumbbell)} kg</div>`;
    const sub = e.pair ? `each hand, ${fmt(c.kg * 2)} kg total, ${lastBtn(e)}` : `${e.variant === 'plate' ? 'one plate' : e.variant === 'kettlebell' ? 'one kettlebell' : 'one dumbbell'}, ${lastBtn(e)}`;
    return `${bigKg(c.kg)}<div class="subw" data-sub>${sub}</div>${hintsRow(s, it, e, c)}<div class="card vis">${vis}</div>${e.distance ? distanceBlock(c) : repsSteppers(e, c, e.pair ? 'Weight each' : 'Weight', fmt(c.kg))}`;
  },
  machine(s, it, e, c) {
    const st = D.settings(), m = L.machineFor(e, st);
    if (m.kind === 'plates') {
      const per = Math.max(0, (c.kg - (m.sled || 0)) / 2), sp = L.splitPlates(per, L.plateSet(st));
      return `${bigKg(c.kg)}<div class="subw">${m.sled ? `sled ${fmt(m.sled)} kg + ${fmt(per)} per side` : `${fmt(per)} per side`}, ${lastBtn(e)}</div>${hintsRow(s, it, e, c)}<div class="card vis">${machineSVG(per)}<div class="capx">per side ${sp.plates.join(' + ') || 'nothing'}${e.seat ? `, ${esc(e.seat)}` : ''}</div></div>${repsSteppers(e, c, 'Weight', fmt(c.kg))}`;
    }
    const step = L.stepFor(e, st), n = Math.min(40, Math.max(m.plates || 20, Math.ceil(c.kg / step) + 2));
    const off = +((((+c.kg || 0) % step) + step) % step).toFixed(2) || step, top = Math.max(100, Math.ceil((c.kg * 1.6) / step) * step);
    return `${bigKg(c.kg)}<div class="subw">pin ${Math.round(c.kg / step)}${e.seat ? `, ${esc(e.seat)}` : ''}, ${lastBtn(e)}</div>${hintsRow(s, it, e, c)}<div class="card vis short">${stackSVG(c.kg, step, n)}${strip('kg', range(off, top, step), c.kg, v => fmt(v), 'small', 'Stack weight', c.id)}<div class="capx">swipe the stack, ${fmt(step)} kg steps${e.stepLearned ? ' (from your history)' : ''}. Change the step: tap the name</div></div>${repsSteppers(e, c, 'Weight', fmt(c.kg))}`;
  },
  bodyweight(s, it, e, c) {
    const st = D.settings(), bw = D.latestBw(), mode = c.mode || 'plain';
    const band = bandOf(c.band), assistM = st.machines.find(m => m.kind === 'assist') || {min: 5, max: 70, step: 5};
    const extra = mode === 'added' ? (c.add || 0) : mode === 'assisted' ? Math.abs(c.add || 0) : 0;
    const net = mode === 'assisted' ? bw - extra : bw + extra;
    const mid = mode === 'plain' ? '' : `<span class="op">${mode === 'added' ? '+' : '−'}</span><div class="eqt ${mode === 'assisted' ? 'help' : ''}"><small>${mode === 'added' ? 'Belt' : c.atype === 'band' ? esc(band.name.toUpperCase()) + ' BAND' : 'Assist'}</small><b data-extra>${fmt(extra)}</b></div>`;
    let picker = '';
    if (mode === 'added') picker = strip('add', range(0, 60, st.steps.bw), c.add || 0, v => v ? '+' + fmt(v) : '0', '', 'Added weight', c.id) + `<div class="capx" data-cap>belt plates: ${L.splitPlates(c.add || 0, L.plateSet(st)).plates.join(' + ') || 'none'}, steps of ${fmt(st.steps.bw)} kg</div>`;
    if (mode === 'assisted') picker = `<div class="seg wide" style="margin:6px 6px 0" role="radiogroup"><button class="${c.atype !== 'machine' ? 'on' : ''}" data-act="setF" data-f="atype" data-v="band">Band</button><button class="${c.atype === 'machine' ? 'on' : ''}" data-act="setF" data-f="atype" data-v="machine">Assist machine</button></div>` +
      (c.atype !== 'machine' ? `<div class="bands">${st.bands.map(b => `<button data-act="bwBand" data-id="${esc(b.id)}" class="${b.id === c.band ? 'on' : ''}"><i style="background:${esc(b.color)}"></i>${esc(b.name)}<small>≈ ${fmt(b.kg)} kg</small></button>`).join('')}</div><div class="capx">pick the band you used</div>` : strip('assist', range(assistM.min || 5, assistM.max || 70, assistM.step || 5), Math.abs(c.add || 0), v => '−' + fmt(v), '', 'Counterweight', c.id) + `<div class="capx">counterweight on the assist machine</div>`);
    const lastR = (() => { const w = lastTop(e); return w ? Math.max(...w.map(x => L.setReps(x, e))) : null; })();
    const reps = e.unilateral ? `<div class="steps">${stepper('Left', c.l || 0, 'cur', 'data-f="l"')}${stepper('Right', c.r || 0, 'cur', 'data-f="r"')}</div>` : `<div class="card repsc"><div><small>Reps</small><button class="last lastb" data-act="lastPeek">${lastR != null ? 'last ' + lastR : 'first time'}</button></div><button data-step="cur" data-f="reps" data-dir="-1" aria-label="Fewer reps">−</button><b>${c.reps || 0}</b><button data-step="cur" data-f="reps" data-dir="1" aria-label="More reps">+</button></div>`;
    return `<div class="seg wide" role="radiogroup" aria-label="How">${[['plain', 'Bodyweight'], ['added', '+ Weight'], ['assisted', 'Assisted']].map(([m, l]) => `<button role="radio" aria-checked="${mode === m}" class="${mode === m ? 'on' : ''}" data-act="bwMode" data-v="${m}">${l}</button>`).join('')}</div>
      <div class="card eq"><div class="eqt"><small>You</small><b>${fmt(bw)}</b></div>${mid}<span class="op">=</span><div class="eqt res"><small>Moved</small><b data-net>${fmt(net)}</b></div></div>
      ${mode === 'plain' ? `<div class="capx" style="margin-top:8px">Your bodyweight comes from the weekly weigh-in, ${kgs(bw)}</div>` : `<div class="card vis">${picker}</div>`}${reps}`;
  },
  band(s, it, e, c) {
    const st = D.settings(), b = bandOf(c.band);
    const lastR = (() => { const w = lastTop(e); return w ? 'last ' + setShort(w[0], e) : 'first time'; })();
    const reps = e.unilateral ? `<div class="steps">${stepper('Left', c.l || 0, 'cur', 'data-f="l"')}${stepper('Right', c.r || 0, 'cur', 'data-f="r"')}</div>` : `<div class="card repsc"><div><small>Reps</small><span class="last">${esc(lastR)}</span></div><button data-step="cur" data-f="reps" data-dir="-1" aria-label="Fewer reps">−</button><b>${c.reps || 0}</b><button data-step="cur" data-f="reps" data-dir="1" aria-label="More reps">+</button></div>`;
    return `<div class="bigw">${e.unilateral ? `${c.l || 0}/${c.r || 0}` : c.reps || 0}<em> reps</em></div><div class="subw">${esc(b.name)} band, ≈ ${fmt(b.kg)} kg</div><div class="card vis"><div class="bands">${st.bands.map(x => `<button data-act="setF" data-f="band" data-v="${esc(x.id)}" class="${x.id === c.band ? 'on' : ''}"><i style="background:${esc(x.color)}"></i>${esc(x.name)}<small>≈ ${fmt(x.kg)} kg</small></button>`).join('')}</div><div class="capx">band colours and strengths are set in Equipment</div></div>${reps}`;
  },
  timed(s, it, e, c) {
    const run = s.hold && s.hold.setId === c.id, sec = run ? (Date.now() - s.hold.start) / 1000 : (c.sec || 0), tg = c.target || 60, R = 92, C = 2 * Math.PI * R, f = Math.min(1, sec / tg);
    return `<div class="ringw"><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="${R}" fill="none" stroke="var(--track)" stroke-width="12"/><circle data-holdring cx="110" cy="110" r="${R}" fill="none" stroke="${f >= 1 ? 'var(--ok)' : 'var(--ink)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 110 110)"/></svg>
      <div class="ringc"><b class="serif" data-holdt>${mmss(sec)}</b><span>target ${mmss(tg)}, ${lastBtn(e)}</span></div></div>
      <div class="chipz" style="justify-content:center">${[30, 45, 60, 90, 120].map(t => `<button data-act="setF" data-f="target" data-v="${t}" class="${t === tg ? 'on' : ''}">${t < 60 ? t + ' s' : (t / 60) + ' min'}</button>`).join('')}</div>
      <div class="steps">${stepper('Seconds', c.sec || 0, 'cur', 'data-f="sec"')}${stepper('Added kg', fmt(c.add || 0), 'cur', 'data-f="add"')}</div>`;
  },
  cardio(s, it, e, c) {
    const F = L.cardioFields(e).fields, bw = D.latestBw(), d = L.cardioDerived(e, c, bw);
    const main = F.includes('distance') ? ['m', ['row', 'ski'].includes(e.variant) ? 'Metres' : 'km', ['row', 'ski'].includes(e.variant) ? (c.m || 0).toLocaleString('en-GB') : fmt((c.m || 0) / 1000)] : F.includes('floors') ? ['floors', 'Floors', c.floors || 0] : F.includes('calories') ? ['cal', 'Calories', c.cal || 0] : F.includes('jumps') ? ['jumps', 'Jumps', (c.jumps || 0).toLocaleString('en-GB')] : null;
    const sec2 = F.find(x => ['incline', 'resistance', 'level'].includes(x));
    const secLbl = {incline: 'INCLINE %', resistance: 'Resistance', level: 'Level'}[sec2];
    const tilesD = d.pairs.slice(0, 2).map(([l, v]) => `<div class="eqt"><small>${l}</small><b>${v}</b></div>`).join('');
    return `<div class="bigw">${Math.round((c.sec || 0) / 60)}<em> min</em></div><div class="subw">${main ? 'enter what the machine shows; the rest is worked out' : 'time in, the rest worked out'}</div>
      <div class="steps">${main ? stepper(main[1], main[2], 'cur', `data-f="${main[0]}"`) : ''}${sec2 ? stepper(secLbl, fmt(c[sec2] || 0), 'cur', `data-f="${sec2}"`) : ''}</div>
      <div class="card eq">${tilesD}<div class="eqt res"><small>kcal est.</small><b>${d.kcal}</b></div></div>
      <div class="steps">${stepper('Minutes', Math.round((c.sec || 0) / 60), 'cur', 'data-f="min"')}<div class="card st"><div><small>Feel</small><b style="font-size:20px;font-family:Manrope;font-weight:800">${esc(c.feel || '—')}</b></div><button class="btn2" style="flex:0 0 auto;height:40px;padding:0 14px" data-act="feel">Change</button></div></div>`;
  },
};
function range(a, b, step) { const o = []; for (let v = a; v <= b + 1e-9; v += step) o.push(+v.toFixed(2)); return o; }

/* ---------- editing the current set ---------- */
function withCur(fn, {redraw = true} = {}) {
  const s = D.session(); if (!s) return;
  const it = curItem(s); if (!it) return;
  let i = curIdx(it); if (i < 0) return;
  const e = D.ex(it.exId);
  fn(it.sets[i], e, it, s, i);
  D.saveSession(s);
  if (redraw) render();
}
function stepField(set, e, f, dir, n = 1) {
  const st = D.settings();
  const big = n > 8 ? 2 : 1;
  switch (f) {
    case 'kg': {
      if (e.logType === 'rack' && e.variant === 'kettlebell') { const ks = st.kettlebells.slice().sort((a, b) => a - b); const i = ks.indexOf(set.kg); set.kg = ks[Math.max(0, Math.min(ks.length - 1, (i < 0 ? 0 : i) + dir))]; break; }
      if (e.logType === 'rack' && e.variant === 'plate') { const ps = [1.25, 2.5, 5, 10, 15, 20, 25]; const i = ps.indexOf(set.kg); set.kg = ps[Math.max(0, Math.min(ps.length - 1, (i < 0 ? 3 : i) + dir))]; break; }
      const step = L.stepFor(e, st) * big; set.kg = L.snapWeight(e, st, (+set.kg || 0) + dir * step); break;
    }
    case 'reps': case 'l': case 'r': set[f] = Math.max(0, (+set[f] || 0) + dir * big); break;
    case 'add': set.add = Math.max(0, +((+set.add || 0) + dir * st.steps.bw).toFixed(2)); break;
    case 'sec': set.sec = Math.max(0, (+set.sec || 0) + dir * 5 * big); break;
    case 'min': set.sec = Math.max(60, Math.round((+set.sec || 0) / 60) * 60 + dir * 60 * big); break;
    case 'm': set.m = Math.max(0, (+set.m || 0) + dir * (e.logType === 'cardio' ? (DIST_STEP[e.variant] || 500) : 5) * big); break;
    case 'floors': set.floors = Math.max(0, (+set.floors || 0) + dir * 5); break;
    case 'cal': set.cal = Math.max(0, (+set.cal || 0) + dir * 10); break;
    case 'jumps': set.jumps = Math.max(0, (+set.jumps || 0) + dir * 100); break;
    case 'incline': set.incline = Math.max(0, +((+set.incline || 0) + dir * .5).toFixed(1)); break;
    case 'resistance': case 'level': set[f] = Math.max(0, (+set[f] || 0) + dir); break;
  }
}
/* a change to the current set carries forward to later planned sets that still had the same value */
function carry(it, i, f, before, after) {
  if (before === after) return;
  const c = it.sets[i];
  for (const x of it.sets.slice(i + 1)) if (!x.done && x.type === c.type && x[f] === before) x[f] = after;
}
const CARRY = ['kg', 'reps', 'l', 'r', 'add', 'band', 'mode', 'atype', 'sec', 'm', 'target'];
STEP.cur = (dir, ds, n) => withCur((c, e, it, s, i) => { const f = ds.f === 'min' ? 'sec' : ds.f, b = c[f]; stepField(c, e, ds.f, dir, n); if (CARRY.includes(f)) carry(it, i, f, b, c[f]); });
A.setF = d => withCur((c, e, it, s, i) => { const v = isNaN(+d.v) ? d.v : +d.v, b = c[d.f]; c[d.f] = v; if (CARRY.includes(d.f)) carry(it, i, d.f, b, v); });
/* strips on the Log screen write only into the set they were drawn for */
function stripSet(st, field, val) { const s = D.session(); if (!s) return; const it = curItem(s), i = it ? curIdx(it) : -1; if (i < 0 || it.sets[i].id !== st.dataset.for) return; const c = it.sets[i], b = c[field]; c[field] = val; carry(it, i, field, b, val); D.saveSession(s); render(); }
STRIP.kg = {live(v) { const b = $('[data-big]'); if (b) b.innerHTML = `${fmt(v)}<em> kg</em>`; const t = $('[data-logtxt]'); if (t) t.textContent = t.textContent.replace(/: [\d.]+ ×/, `: ${fmt(v)} ×`); }, set(v, st) { stripSet(st, 'kg', v); }};
STRIP.add = {live(v) { const bw = D.latestBw(); const x = $('[data-extra]'), n = $('[data-net]'); if (x) x.textContent = fmt(v); if (n) n.textContent = fmt(bw + v); }, set(v, st) { stripSet(st, 'add', v); }};
STRIP.assist = {live(v) { const bw = D.latestBw(); const x = $('[data-extra]'), n = $('[data-net]'); if (x) x.textContent = fmt(v); if (n) n.textContent = fmt(bw - v); }, set(v, st) { stripSet(st, 'add', -v); }};
A.bwMode = d => withCur((c, e, it, s, i) => { const bm = c.mode, ba = c.add; c.mode = d.v; if (d.v === 'plain') c.add = 0; else if (d.v === 'added') c.add = Math.max(0, c.add || 0) || 10; else { c.atype = c.atype || 'band'; c.add = -(c.atype === 'band' ? bandOf(c.band).kg : 25); } carry(it, i, 'mode', bm, c.mode); carry(it, i, 'add', ba, c.add); });
A.bwBand = d => withCur((c, e, it, s, i) => { const bb = c.band, ba = c.add; c.band = d.id; c.add = -bandOf(d.id).kg; carry(it, i, 'band', bb, c.band); carry(it, i, 'add', ba, c.add); });
A.rpe = d => withCur(c => { c.rpe = c.rpe === +d.v ? null : +d.v; });
A.feel = () => openSheet('pick', {key: 'feel'});
A.stype = d => withCur((c, e, it, s, i) => {
  const t = d.v;
  if (t === 'drop') {
    if (c.type === 'drop') return;
    const prev = it.sets.slice(0, i).filter(x => x.done && x.type !== 'warmup').pop(); if (!prev) return;
    const ds = Object.assign(copySet(prev, e), {type: 'drop', kg: L.dropWeight(e, prev.kg, D.settings()), inserted: true});
    it.sets.splice(i, 0, ds); it.si = i;
    s.rest = null; /* no rest timer for a drop */
  } else if (c.type === 'drop' && c.inserted) { it.sets.splice(i, 1); it.si = null; }
  else c.type = t;
});
A.applySug = d => withCur((c, e, it) => { const kg = +d.kg; it.sets.forEach(x => { if (!x.done && x.type === 'working' && (+x.kg || 0) < kg) x.kg = kg; }); it.sugApplied = true; });
A.addWarm = () => withCur((c, e, it, s, i) => { const w = L.warmups(e, c.kg, D.settings()).map(x => Object.assign(blankSet(e), x)); it.sets.splice(i, 0, ...w); it.si = i; });
A.tile = d => {
  if (Date.now() < LP_UNTIL) return;
  const s = D.session(), it = curItem(s), j = +d.i, x = it.sets[j];
  if (!x) return;
  if (x.done) openSheet('set', {where: 'session', uid: it.uid, id: x.id});
  else { it.si = j; D.saveSession(s); render(); }
};
A.setNote = () => { const s = D.session(), it = curItem(s), i = curIdx(it); if (i >= 0) openSheet('set', {where: 'session', uid: it.uid, id: it.sets[i].id, noteOnly: true}); };
A.addSet = () => {
  const s = D.session(), it = curItem(s), e = D.ex(it.exId), wasDone = curIdx(it) < 0;
  const last = it.sets.filter(x => x.type !== 'warmup').pop() || it.sets[it.sets.length - 1];
  const ns = last ? copySet(last, e) : blankSet(e); ns.type = 'working'; ns.extra = true;
  it.sets.push(ns); if (wasDone) it.si = it.sets.length - 1;
  D.saveSession(s); vib(8); render();
};
A.addWarmSet = () => {
  const s = D.session(), it = curItem(s), e = D.ex(it.exId), warm = it.sets.filter(x => x.type === 'warmup'), last = warm[warm.length - 1];
  const ns = last ? copySet(last, e) : blankSet(e); ns.type = 'warmup';
  it.sets.splice(it.sets.indexOf(last) + 1, 0, ns); D.saveSession(s); vib(8); render();
};
/* press and hold a planned set to remove it (logged sets are edited from their sheet) */
let LP_UNTIL = 0, lpT = null;
document.addEventListener('pointerdown', ev => {
  const b = ev.target.closest('.sets2 [data-act="tile"]'); if (!b) return;
  clearTimeout(lpT);
  lpT = setTimeout(() => {
    const s = D.session(); if (!s) return; const it = curItem(s), j = +b.dataset.i, x = it.sets[j];
    if (!x || x.done) return;
    LP_UNTIL = Date.now() + 700;
    const old = JSON.parse(JSON.stringify(s));
    it.sets.splice(j, 1); it.si = null; D.saveSession(s); vib(20); render();
    toast('Set removed', {action: {label: 'Undo', fn: () => { D.saveSession(old); render(); }}});
  }, 550);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, () => clearTimeout(lpT)));
A.addDrop = () => { const s = D.session(), it = curItem(s), e = D.ex(it.exId); const prev = it.sets.filter(x => x.done && x.type !== 'warmup').pop(); if (!prev) return; const ds = Object.assign(copySet(prev, e), {type: 'drop', kg: L.dropWeight(e, prev.kg, D.settings()), inserted: true, extra: true}); it.sets.push(ds); it.si = it.sets.length - 1; s.rest = null; D.saveSession(s); vib(10); render(); };
A.jump = d => { const s = D.session(); if (!s.items.find(x => x.uid === d.uid)) return; s.cur = d.uid; D.saveSession(s); if (S.sheet) closeSheet(); render(); window.scrollTo(0, 0); };

/* ---------- log a set ---------- */
A.logSet = () => {
  const s = D.session(); if (!s) return;
  const it = curItem(s), e = D.ex(it.exId), i = curIdx(it); if (i < 0) return;
  const c = it.sets[i];
  if (e.logType === 'cardio' ? !(c.sec > 0) : e.logType === 'timed' ? !(c.sec > 0) : !(L.setTotalReps(c, e) > 0)) { toast(e.logType === 'timed' ? 'Hold for a few seconds first, or type the time.' : 'Add the reps first.'); return; }
  const before = JSON.stringify(s); /* for Undo */
  c.done = true; c.ts = Date.now(); delete c.inserted;
  if (e.logType === 'bodyweight') c.bw = D.latestBw();
  if (e.logType === 'band' || (e.logType === 'bodyweight' && c.mode === 'assisted' && c.atype !== 'machine')) c.bandKg = bandOf(c.band).kg;
  it.si = null;
  /* where next: supersets go straight to the partner; rest starts after the last one in the group */
  const grp = groupOf(s, it);
  let rest = restFor(e, c);
  if (grp.length > 1) {
    const pos = grp.indexOf(it), nx = grp.slice(pos + 1).find(x => curIdx(x) >= 0);
    if (nx) { s.cur = nx.uid; rest = 0; }
    else { const first = grp.find(x => curIdx(x) >= 0); if (first) s.cur = first.uid; }
  }
  s.rest = rest > 0 ? {end: Date.now() + rest * 1000, total: rest, rang: false} : null;
  D.saveSession(s);
  vib([14, 40, 14]);
  const tags = prTagsFor(s).get(c.id);
  render(); window.scrollTo({top: 0, behavior: 'smooth'});
  const undo = {label: 'Undo', fn: () => { D.saveSession(JSON.parse(before)); render(); toast('Set un-logged'); }};
  if (tags && D.settings().prAlerts) { toast(`${e.name} ${setShort(c, e)}, ${L.PR_LABEL[tags[0]]}`, {pr: true, ms: 4200, action: undo}); vib([30, 60, 30, 60, 80]); }
  else toast(`Logged ${setShort(c, e)}`, {action: undo, ms: 3500});
};
A.holdStart = () => { const s = D.session(), it = curItem(s), i = curIdx(it); if (i < 0) return; s.hold = {setId: it.sets[i].id, start: Date.now(), rang: false}; D.saveSession(s); vib(20); render(); };
A.holdStop = () => { const s = D.session(); if (!s.hold) return; const it = curItem(s), i = curIdx(it); const sec = Math.round((Date.now() - s.hold.start) / 1000); s.hold = null; if (i >= 0) it.sets[i].sec = sec; D.saveSession(s); A.logSet(); };

/* ---------- timers: elapsed, rest bubble, rest screen, hold ---------- */
function tick() {
  const s = D.session(); if (!s) return;
  $$('[data-elapsed]').forEach(x => x.textContent = elapsed(s));
  const b = document.getElementById('restb');
  let r = s.rest; const now = Date.now();
  /* rest that ended over 10 minutes ago is stale: drop it quietly */
  if (r && now - r.end > 600e3) { s.rest = null; r = null; D.saveSession(s); }
  if (r && now >= r.end && !document.hidden && !ALARM.open) { r.rang = true; D.saveSession(s); showAlarm(now - r.end > 3000 ? (now - r.end) / 1000 : 0); }
  if (b) {
    if (r) { const left = (r.end - now) / 1000; b.className = 'restb ' + (left < 0 ? 'over' : 'run'); b.innerHTML = `${ic('timer', 'sm')}${left < 0 ? '+' + mmss(-left) : mmss(Math.ceil(left))}`; b.setAttribute('aria-label', left < 0 ? 'Rest over' : 'Rest ' + mmss(Math.ceil(left)) + ' left'); }
    else { b.className = 'restb idle'; b.innerHTML = `${ic('timer', 'sm')}<small>Rest</small>`; }
  }
  if (S.view === 'rest') updateRestView(s);
  if (s.hold) {
    const sec = (now - s.hold.start) / 1000, it = curItem(s), c = it && it.sets.find(x => x.id === s.hold.setId), tg = (c && c.target) || 60;
    $$('[data-holdt]').forEach(x => x.textContent = mmss(sec)); $$('[data-hold]').forEach(x => x.textContent = mmss(sec));
    const ring = $('[data-holdring]'); if (ring) { const C = 2 * Math.PI * 92; ring.setAttribute('stroke-dashoffset', C * (1 - Math.min(1, sec / tg))); ring.setAttribute('stroke', sec >= tg ? 'var(--ok)' : 'var(--ink)'); }
    if (sec >= tg && !s.hold.rang) { s.hold.rang = true; D.saveSession(s); bell(); vibAlarm([200, 100, 200]); }
  }
}
setInterval(tick, 500);
let wl = null;
async function wake() { try { if (!D.settings().keepAwake || !D.session() || !('wakeLock' in navigator) || wl) return; wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } catch (e) {} }
function unwake() { try { wl && wl.release(); } catch (e) {} wl = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  wake();
  /* a PWA cannot ring a locked phone; on return, tick() shows the alarm with "ended 0:40 ago" */
  tick();
});

/* ---------- rest timer screen ---------- */
A.openRest = () => nav('rest');
VIEWS.rest = {dock: false, render() {
  const s = D.session(); if (!s) return VIEWS.log.render({});
  const R = 110, C = 2 * Math.PI * R, r = s.rest;
  const it = curItem(s), e = it && D.ex(it.exId), i = it ? curIdx(it) : -1, nx = i >= 0 ? it.sets[i] : null;
  const st = D.settings();
  let plateTip = '';
  if (e && nx && e.logType === 'barbell') {
    const prev = it.sets.slice(0, i).filter(x => x.done).pop();
    if (prev && prev.kg !== nx.kg) { const d = (nx.kg - prev.kg) / 2; plateTip = `${d > 0 ? 'add' : 'take off'} ${fmt(Math.abs(d))} kg per side`; }
    else plateTip = `per side ${L.splitPlates((nx.kg - L.barFor(e, st)) / 2, L.plateSet(st)).plates.join(' + ') || 'nothing'}`;
  }
  const upNext = e && nx ? `<div class="card" style="margin-top:22px;padding:16px"><div class="lbl">Up next, ${esc(setPill(s, it, e, i).toLowerCase())}</div><div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><b style="font-size:17px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</b><b class="serif" style="font-size:34px;margin-left:auto;white-space:nowrap">${setShort(nx, e)}</b></div>${e.logType === 'barbell' ? `<div style="margin-top:6px">${barSVG(nx.kg, L.barFor(e, st), e.variant)}</div>` : ''}${plateTip ? `<div class="capx">${plateTip}</div>` : ''}</div>` : '';
  const body = r ? `<div class="ring"><svg viewBox="0 0 250 250" aria-hidden="true"><circle cx="125" cy="125" r="${R}" fill="none" stroke="var(--track)" stroke-width="12"/><circle data-ring cx="125" cy="125" r="${R}" fill="none" stroke="var(--ink)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
    <div class="c"><span class="lbl" data-rl>Rest</span><b class="serif" style="font-size:84px;line-height:1" data-rt>0:00</b><span style="font-size:13px;font-weight:700;color:var(--soft)">of ${mmss(r.total)}</span></div></div>
    <div class="btns" style="margin-top:26px"><button class="btn2" data-act="restAdj" data-v="-15">−15 s</button><button class="btn2" data-act="restAdj" data-v="30">+30 s</button><button class="btn2" data-act="restSkip">${ic('skip', 'sm')}Skip</button></div>`
    : `<div class="card empty" style="margin-top:40px"><div class="serif" style="font-size:34px">No rest running.</div><p class="lede">Rest starts by itself when you log a set. Start one by hand:</p><div class="chipz" style="justify-content:center">${[60, 90, 120, 150, 180, 240].map(v => `<button data-act="restStart" data-v="${v}">${mmss(v)}</button>`).join('')}</div></div>`;
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Close rest timer">${ic('down')}</button><button class="rb" data-act="toggle" data-k="sound" aria-label="Sound ${st.sound ? 'on' : 'off'}" style="${st.sound ? '' : 'opacity:.5'}">${ic('bell', 'sm')}</button></div>${body}${upNext}`;
}, bind() { const s = D.session(); if (s) updateRestView(s); }};
function updateRestView(s) {
  const r = s.rest, ring = $('[data-ring]'), t = $('[data-rt]'), l = $('[data-rl]'); if (!r || !ring || !t) return;
  const left = (r.end - Date.now()) / 1000, C = 2 * Math.PI * 110;
  ring.setAttribute('stroke-dashoffset', C * (1 - Math.max(0, Math.min(1, left / r.total))));
  ring.setAttribute('stroke', left < 0 ? 'var(--over)' : 'var(--ink)');
  t.textContent = left < 0 ? '+' + mmss(-left) : mmss(Math.ceil(left));
  t.style.color = left < 0 ? 'var(--over)' : '';
  if (l) l.textContent = left < 0 ? 'Rest over' : 'Rest';
}
A.restAdj = d => { const s = D.session(); if (!s.rest) return; s.rest.end += +d.v * 1000; s.rest.total = Math.max(5, s.rest.total + +d.v); if (s.rest.end > Date.now()) s.rest.rang = false; D.saveSession(s); tick(); };
A.restSkip = () => { const s = D.session(); s.rest = null; D.saveSession(s); history.length > 1 ? history.back() : nav('log'); };
A.restStart = d => { const s = D.session(); s.rest = {end: Date.now() + +d.v * 1000, total: +d.v, rang: false}; D.saveSession(s); render(); };

/* ---------- workout overview sheet ---------- */
A.overview = () => openSheet('overview');
SHEETS.overview = {cls: 'tall', title: 'Workout overview', render() {
  const s = D.session(); if (!s) return '';
  const lab = groupLabels(s), cur = curItem(s);
  let done = 0, total = 0, vol = 0;
  for (const it of s.items) { const e = D.ex(it.exId); for (const x of it.sets) { if (x.type === 'warmup') continue; if (!x.extra) total++; if (x.done) { done++; vol += L.setVolume(x, e); } } }
  const prs = prTagsFor(s);
  const rows = s.items.map((it, i) => {
    const e = D.ex(it.exId), dn = it.sets.filter(x => x.done && x.type !== 'warmup'), left = curIdx(it) < 0;
    const t = left && dn.length ? 'done' : it === cur ? 'cur' : 'next';
    const best = dn.length ? dn.reduce((a, b) => L.setVolume(b, e) > L.setVolume(a, e) ? b : a) : null;
    const plan = it.sets.filter(x => x.type !== 'warmup' && !x.done).length;
    const sub = t === 'cur' ? `now, ${dn.length ? `${dn.length} done, ${plan} to go` : `${plural(plan, 'set')}`}` : dn.length ? `${it === cur ? 'now, ' : ''}${plural(dn.length, 'set')}${best ? ', best ' + setShort(best, e) : ''}${plan ? `, ${plan} to go` : ''}` : `${plural(plan, lab[it.uid] ? 'round' : 'set')}, ${lastText(e)}`;
    const pr = it.sets.some(x => prs.has(x.id));
    return `<div class="ovr ${it === cur ? 'cur' : ''}" data-i="${i}"><span class="mk ${t}">${t === 'done' ? ic('check', 'xs') : ''}</span><button class="ovn" data-act="jump" data-uid="${it.uid}" aria-label="Go to ${esc(e.name)}"><b>${lab[it.uid] ? `<span class="ss">${lab[it.uid]}</span>` : ''}${esc(e.name)}</b><small>${sub}${pr ? ' <span class="tag">PR</span>' : ''}</small></button><span class="grip" data-grip role="button" tabindex="0" aria-label="Drag to reorder ${esc(e.name)}. Arrow keys move it.">${ic('grip', 'sm')}</span></div>` +
      (i < s.items.length - 1 ? `<div class="jn ${it.link ? 'on' : ''}"><button data-act="link" data-i="${i}" aria-pressed="${!!it.link}" aria-label="${it.link ? 'Unlink' : 'Link as superset:'} ${esc(e.name)} and ${esc(D.ex(s.items[i + 1].exId).name)}">${ic('link', 'xs')}</button></div>` : '');
  }).join('');
  return `<div class="hd"><div><h3 style="font-size:26px">${esc(s.title)}</h3><div class="ovtot"><span><span data-elapsed>${elapsed(s)}</span>, ${done} of ${total} sets, ${L.fmtThousands(vol)} kg</span></div></div><button class="rb" data-act="wopts" aria-label="Workout options">${ic('more')}</button></div>
    ${s.items.length ? `<div class="card ovl" style="margin-top:14px">${rows}</div><p class="lede" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:10px 4px 0">Tap ${ic('link', 'xs')} between two to make a superset. Drag ${ic('grip', 'xs')} to reorder.</p>` : `<p class="lede">No exercises yet.</p>`}
    <div style="margin-top:12px;display:flex"><button class="btn2" data-act="library" data-m="add">${ic('plus', 'sm')}Add exercise</button></div>
    <div style="margin-top:12px"><button class="btn" data-act="finish">${ic('check')}Finish workout</button></div>
    <p class="lede" style="text-align:center;margin-top:8px">Sets you didn't log are left out when you finish.</p>`;
}, bind(el) {
  const s = D.session(); if (!s) return;
  $$('[data-grip]', el).forEach(g => {
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); const row = g.closest('.ovr'), i = +row.dataset.i, y0 = e.clientY, h = row.offsetHeight;
      g.setPointerCapture(e.pointerId); row.classList.add('drag');
      const mv = ev => { row.style.transform = `translateY(${ev.clientY - y0}px)`; };
      const up = ev => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); moveItem(i, Math.round((ev.clientY - y0) / h)); };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
    g.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); moveItem(+g.closest('.ovr').dataset.i, e.key === 'ArrowUp' ? -1 : 1, true); } });
  });
}};
function moveItem(i, d, keepFocus) {
  const s = D.session(), L2 = s.items, j = Math.max(0, Math.min(L2.length - 1, i + d));
  if (j !== i) { if (i > 0) L2[i - 1].link = false; const [x] = L2.splice(i, 1); x.link = false; L2.splice(j, 0, x); if (j > 0) L2[j - 1].link = false; }
  if (L2.length) L2[L2.length - 1].link = false;
  D.saveSession(s); renderSheet(); render();
  if (keepFocus) { const g = $$('.sheet [data-grip]')[j]; g && g.focus(); }
}
A.link = d => { const s = D.session(), it = s.items[+d.i]; if (!it) return; it.link = !it.link; D.saveSession(s); vib(8); renderSheet(); render(); };

/* ---------- workout options ---------- */
A.wopts = () => openSheet('wopts');
SHEETS.wopts = {title: 'Workout options', render() {
  const s = D.session(); if (!s) return '';
  return `<div class="hd"><h3>Workout options</h3></div>
    <label class="card fld"><small>Name</small><input data-in="wtitle" value="${esc(s.title)}" maxlength="60" aria-label="Workout name"></label>
    <label class="card fld"><small>Note for this session</small><textarea data-in="wnote" rows="2" placeholder="How it felt, the gym, anything">${esc(s.note || '')}</textarea></label>
    <div class="card list" style="margin-top:10px">${sr('Save as template', ic('book', 'sm'), 'Keeps these exercises and set counts', 'data-act="sessToTpl"')}${sr('<span style="color:var(--over)">Discard workout</span>', ic('trash', 'sm'), 'Deletes everything logged in this session', 'data-act="discard"')}</div>
    <button class="btn" style="margin-top:14px" data-act="closeSheet">Done</button>`;
}};
IN.wtitle = v => { const s = D.session(); s.title = v.trim().slice(0, 60) || 'Workout'; D.saveSession(s); };
IN.wnote = v => { const s = D.session(); s.note = v.slice(0, 2000); D.saveSession(s); };
A.discard = () => openSheet('confirm', {title: 'Discard this workout?', body: 'Every set logged in this session is deleted. Saved workouts are not touched.', ok: 'Discard workout', act: 'discardYes', danger: 1});
A.discardYes = () => { Store.setOne('session', null); unwake(); S.sheet = null; nav('log', {}, {replace: true}); toast('Workout discarded'); };
A.sessToTpl = () => { const s = D.session(); saveTemplateFrom(s.title, s.items.map(it => ({exId: it.exId, sets: Math.max(1, it.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop').length), reps: (it.sets.find(x => x.type === 'working') || {}).reps || 0, link: !!it.link}))); };
function saveTemplateFrom(name, items) {
  /* never overwrite: a name already in use gets " (2)", " (3)" … */
  const taken = new Set(D.templates().map(t => t.name.toLowerCase()));
  let nm = String(name || 'Workout'), k = 1; while (taken.has(nm.toLowerCase())) nm = `${name} (${++k})`;
  const t = Store.put('templates', {id: Store.uid('tpl'), name: nm, items, lastUsed: Date.now()});
  toast(`Saved template "${t.name}"`);
}

/* ---------- exercise options (tap the exercise name) ---------- */
A.exopts = () => openSheet('exopts');
SHEETS.exopts = {title: 'Exercise options', render() {
  const s = D.session(); if (!s) return '';
  const it = curItem(s), e = D.ex(it.exId), st = D.settings();
  return `<div class="hd"><div style="min-width:0"><h3>${esc(e.name)}</h3><p>${esc(eqLabel(e))}, ${esc(e.primary)}</p></div></div>
    <label class="card fld"><small>Pinned note, shows every time</small><input data-in="exnote" value="${esc(e.note)}" maxlength="140" placeholder="Grip, cues, setup"></label>
    ${e.logType === 'machine' ? `<label class="card fld"><small>Seat and pad settings</small><input data-in="exseat" value="${esc(e.seat)}" maxlength="60" placeholder="seat 4, pad 2"></label>
    <div class="sec"><h5>Weight step on this machine</h5><span>${e.stepLearned ? 'from your history' : 'each tap of − / +'}</span></div>
    <div class="chipz">${[1, 1.25, 2.5, 5, 10].map(v => `<button class="${L.stepFor(e, st) === v ? 'on' : ''}" data-act="exstep" data-v="${v}">${fmt(v)} kg</button>`).join('')}</div>` : ''}
    <div class="sec"><h5>Rest after each set</h5><span>${st.restPerExercise ? 'this exercise' : 'same for all (Settings)'}</span></div>
    <div class="chipz">${[0, 30, 60, 90, 120, 150, 180, 240].map(v => `<button class="${(e.rest || 0) === v ? 'on' : ''}" data-act="exrest" data-v="${v}">${v ? mmss(v) : 'none'}</button>`).join('')}</div>
    <div class="card list" style="margin-top:12px">
      ${sr('Favourite', tog('fav', e.fav, 'Favourite').replace('data-act="toggle"', 'data-act="favCur"'), 'Shows first when you pick an exercise')}
      ${sr('Swap exercise', ic('swap', 'sm'), it.sets.some(x => x.done) ? 'Adds the new one after this' : 'Keeps the planned sets', 'data-act="library" data-m="swap"')}
      ${sr('Edit exercise', ic('edit', 'sm'), 'Type, muscles, one side at a time', `data-act="go" data-v="newex" data-id="${esc(e.id)}"`)}
      ${sr('See progress', ic('prog', 'sm'), '', `data-act="progressOf" data-id="${esc(e.id)}"`)}
      ${sr('<span style="color:var(--over)">Remove from workout</span>', ic('trash', 'sm'), it.sets.some(x => x.done) ? 'Logged sets are removed too' : '', 'data-act="removeItem"')}
    </div>`;
}};
function savePref(id, patch) { const p = Store.get('exprefs', id) || {id}; Store.put('exprefs', Object.assign({}, p, patch)); }
IN.exnote = v => { const s = D.session(), it = curItem(s); savePref(it.exId, {note: v.slice(0, 140)}); };
IN.exseat = v => { const s = D.session(), it = curItem(s); savePref(it.exId, {seat: v.slice(0, 60)}); };
A.exrest = d => { const s = D.session(), it = curItem(s); savePref(it.exId, {rest: +d.v}); renderSheet(); };
A.removeItem = () => { const s = D.session(), it = curItem(s), i = s.items.indexOf(it); const old = JSON.parse(JSON.stringify(s)); s.items.splice(i, 1); if (i > 0 && s.items[i - 1]) s.items[i - 1].link = s.items[i - 1].link && !!s.items[i]; s.cur = (s.items[i] || s.items[i - 1] || {}).uid || null; D.saveSession(s); closeSheet(); render(); toast('Exercise removed', {action: {label: 'Undo', fn: () => { D.saveSession(old); render(); }}}); };
A.progressOf = d => { PROG.ex = d.id; nav('progress'); };

/* ---------- set editor (session sets and saved workouts) ---------- */
let SETED = null;
function findSet(sp) {
  if (sp.where === 'session') { const s = D.session(); const it = s && s.items.find(x => x.uid === sp.uid); return it ? {it, set: it.sets.find(x => x.id === sp.id), owner: s} : null; }
  const w = Store.get('workouts', sp.wid); const it = w && w.items.find(x => x.uid === sp.uid); return it ? {it, set: it.sets.find(x => x.id === sp.id), owner: w} : null;
}
SHEETS.set = {title: 'Edit set', render(sp) {
  const f = findSet(sp); if (!f || !f.set) return '<p class="lede">That set is gone.</p>';
  if (!SETED || SETED.id !== f.set.id) SETED = JSON.parse(JSON.stringify(f.set));
  const x = SETED, e = D.ex(f.it.exId);
  if (sp.noteOnly) return `<div class="hd"><h3>Note for this set</h3></div><label class="card fld"><small>One-off note</small><input data-in="setnote" value="${esc(x.note || '')}" maxlength="200" placeholder="felt heavy, paused reps" autofocus></label><button class="btn" style="margin-top:14px" data-act="setSave">Save note</button>`;
  let fields = '';
  if (['barbell', 'rack', 'machine'].includes(e.logType)) fields = `<div class="steps">${stepper('Weight', fmt(x.kg), 'ed', 'data-f="kg"')}${e.unilateral ? stepper('Left', x.l || 0, 'ed', 'data-f="l"') : e.distance ? stepper('Metres', x.m || 0, 'ed', 'data-f="m"') : stepper('Reps', x.reps || 0, 'ed', 'data-f="reps"')}</div>${e.unilateral ? `<div class="steps one">${stepper('Right', x.r || 0, 'ed', 'data-f="r"')}</div>` : ''}`;
  else if (e.logType === 'bodyweight') fields = `<div class="steps">${stepper(x.mode === 'assisted' ? 'Assist kg' : 'Added kg', fmt(Math.abs(x.add || 0)), 'ed', 'data-f="addabs"')}${e.unilateral ? stepper('Left', x.l || 0, 'ed', 'data-f="l"') : stepper('Reps', x.reps || 0, 'ed', 'data-f="reps"')}</div>${e.unilateral ? `<div class="steps one">${stepper('Right', x.r || 0, 'ed', 'data-f="r"')}</div>` : ''}`;
  else if (e.logType === 'band') fields = `<div class="bands">${D.settings().bands.map(b => `<button data-act="edF" data-f="band" data-v="${esc(b.id)}" class="${b.id === x.band ? 'on' : ''}"><i style="background:${esc(b.color)}"></i>${esc(b.name)}</button>`).join('')}</div><div class="steps one">${stepper('Reps', x.reps || 0, 'ed', 'data-f="reps"')}</div>`;
  else if (e.logType === 'timed') fields = `<div class="steps">${stepper('Seconds', x.sec || 0, 'ed', 'data-f="sec"')}${stepper('Added kg', fmt(x.add || 0), 'ed', 'data-f="add"')}</div>`;
  else fields = `<div class="steps">${stepper('Minutes', Math.round((x.sec || 0) / 60), 'ed', 'data-f="min"')}${L.cardioFields(e).fields.includes('distance') ? stepper('Metres', x.m || 0, 'ed', 'data-f="m"') : ''}</div>`;
  const types = ['barbell', 'rack', 'machine', 'bodyweight'].includes(e.logType) ? `<div class="seg wide" role="radiogroup" aria-label="Set type">${[['warmup', 'Warm-up'], ['working', 'Working'], ['drop', 'Drop'], ['failure', 'Failure']].map(([k, l]) => `<button role="radio" aria-checked="${x.type === k}" class="${x.type === k ? 'on' : ''}" data-act="edF" data-f="type" data-v="${k}">${l}</button>`).join('')}</div>` : '';
  return `<div class="hd"><div><h3>${esc(e.name)}</h3><p>${f.set.done ? 'Logged ' + (f.set.ts ? hhmm(f.set.ts) : '') : 'Planned set'}</p></div></div>${fields}${types}
    <label class="card fld"><small>Note</small><input data-in="setnote" value="${esc(x.note || '')}" maxlength="200" placeholder="felt heavy, paused reps"></label>
    <button class="btn" style="margin-top:14px" data-act="setSave">${ic('check')}Save</button><div class="btns"><button class="btn2 danger" data-act="setDel">${ic('trash', 'sm')}Delete set</button></div>`;
}};
STEP.ed = (dir, ds, n) => { if (!SETED) return; const f = findSet(S.sp); const e = D.ex(f.it.exId); if (ds.f === 'addabs') { const sg = SETED.mode === 'assisted' ? -1 : 1; SETED.add = sg * Math.max(0, Math.abs(SETED.add || 0) + dir * D.settings().steps.bw); if (SETED.mode === 'plain' && SETED.add) SETED.mode = 'added'; } else stepField(SETED, e, ds.f, dir, n); renderSheet(); };
A.edF = d => { SETED[d.f] = d.v; renderSheet(); };
IN.setnote = v => { if (SETED) SETED.note = v.slice(0, 200); };
A.setSave = () => {
  const f = findSet(S.sp); if (!f || !SETED) return closeSheet();
  Object.assign(f.set, SETED, {id: f.set.id, done: f.set.done});
  if (S.sp.where === 'session') D.saveSession(f.owner); else Store.put('workouts', f.owner);
  SETED = null; closeSheet(); render();
};
A.setDel = () => {
  const f = findSet(S.sp); if (!f) return;
  const i = f.it.sets.indexOf(f.set); f.it.sets.splice(i, 1); f.it.si = null;
  if (S.sp.where === 'session') D.saveSession(f.owner); else { if (!f.it.sets.length) f.owner.items.splice(f.owner.items.indexOf(f.it), 1); Store.put('workouts', f.owner); }
  SETED = null; closeSheet(); render(); toast('Set deleted');
};

/* ---------- start a workout (round + button) ---------- */
A.startSheet = () => openSheet('start');
SHEETS.start = {title: 'Start a workout', render() {
  const tpls = D.templates(), last = D.workouts()[0];
  return `<div class="hd"><h3>Start a workout</h3><button class="rb" data-act="go" data-v="templates" aria-label="Manage templates">${ic('book', 'sm')}</button></div>
    ${tpls.map(t => `<div class="card" style="padding:14px 16px;margin-top:10px"><div class="hd"><div style="min-width:0"><b style="font-size:17px;font-weight:800">${esc(t.name)}</b><p style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.items.slice(0, 3).map(x => esc(D.ex(x.exId).name)).join(', ')}${t.items.length > 3 ? ` + ${t.items.length - 3}` : ''}</p></div><button class="btn" style="width:auto;height:44px;padding:0 18px;font-size:14px;flex:none" data-act="startTpl" data-id="${esc(t.id)}">${ic('play', 'sm')}Start</button></div></div>`).join('')}
    ${(() => { const favs = D.library().filter(e => e.fav).slice(0, 8); return favs.length ? `<div class="sec"><h5>Quick start</h5><span>your favourites</span></div><div class="chipz">${favs.map(e => `<button data-act="startFav" data-id="${esc(e.id)}">${ic('star', 'xs')} ${esc(e.name)}</button>`).join('')}</div>` : ''; })()}
    <div class="btns" style="margin-top:12px">${last ? `<button class="btn2" data-act="repeat" data-id="${esc(last.id)}">${ic('repeat', 'sm')}Repeat ${esc(last.title)}</button>` : ''}<button class="btn2" data-act="startEmpty">Empty workout</button></div>`;
}};
A.startTpl = d => { const t = Store.get('templates', d.id); if (!t) return; if (D.session()) return toast('Finish or discard the current workout first.'); S.sheet = null; startWorkout({title: t.name, templateId: t.id, items: t.items}); };
A.startEmpty = () => { if (D.session()) return toast('A workout is already running.'); S.sheet = null; startWorkout({title: 'Workout'}); };
A.repeat = d => {
  const w = Store.get('workouts', d.id); if (!w) return;
  if (D.session()) return toast('Finish or discard the current workout first.');
  S.sheet = null;
  const items = w.items.map(it => ({exId: it.exId, sets: Math.max(1, it.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop').length), reps: 0, link: !!it.link}));
  startWorkout({title: w.title, items});
  /* repeat means the same numbers: copy them */
  const s = D.session();
  s.items.forEach((it, k) => { const src = w.items[k].sets.filter(x => x.type !== 'warmup' && x.type !== 'drop'); const e = D.ex(it.exId); it.sets = src.map(x => { const c = copySet(x, e); c.type = 'working'; return c; }); if (!it.sets.length) it.sets = planSets(e, 3, 0); });
  D.saveSession(s); render();
};

/* ---------- exercise library sheet ---------- */
const GROUPS = [['All', null], ['Favourites', 'fav'], ['Chest', ['chest']], ['Back', ['back', 'traps']], ['Shoulders', ['shoulders']], ['Arms', ['biceps', 'triceps', 'forearms']], ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']], ['Core', ['core']], ['Cardio', ['cardio']]];
const TYPEICON = {barbell: 'bar', rack: 'db', machine: 'stack', bodyweight: 'user', band: 'band', timed: 'timer', cardio: 'prog'};
let LIB = {q: '', g: 'All'};
A.library = d => { LIB = {q: '', g: 'All'}; openSheet('library', {m: d.m || 'add', ref: d.ref || ''}); };
SHEETS.library = {cls: 'tall', title: 'Exercise library', noFocus: true, render(sp) {
  const n = D.library().length, cust = Store.all('exercises').filter(e => !e.hidden).length;
  const title = {add: 'Add exercise', swap: 'Swap exercise', tpl: 'Add to template', progress: 'Pick an exercise', compare: 'Compare with', map: 'Match to built-in'}[sp.m] || 'Exercises';
  return `<div class="hd"><h3>${title}</h3><span class="tag w" style="font-size:11px">${L.EX.length} built-in, ${cust} yours</span></div>
    <label class="card search">${ic('search', 'sm')}<input data-in="libq" value="${esc(LIB.q)}" placeholder="Search ${n} exercises" aria-label="Search exercises" type="search" enterkeyhint="search"></label>
    <div class="chips" role="group" aria-label="Muscle">${GROUPS.map(([g]) => `<button class="chip ${g === LIB.g ? 'on' : ''}" data-act="libg" data-v="${g}">${g}</button>`).join('')}</div>
    <div id="libbody">${libBody(sp)}</div>`;
}};
function libBody(sp) {
  const q = LIB.q.trim().toLowerCase(), g = (GROUPS.find(x => x[0] === LIB.g) || GROUPS[0])[1];
  let list = D.library().filter(e => (!g || (g === 'fav' ? e.fav : g.includes(e.primary))) && (!q || e.name.toLowerCase().includes(q) || e.primary.includes(q) || (L.TYPE_LABEL[e.logType] || '').toLowerCase().includes(q)));
  if (sp.m === 'progress' || sp.m === 'compare') { const used = new Set(); D.workouts().forEach(w => w.items.forEach(it => used.add(it.exId))); list = list.filter(e => used.has(e.id)); }
  const row = (e, act = 'libPick') => { const l = D.lastOf(e.id); const top = l ? l.sets.filter(x => x.type !== 'warmup').pop() : null; return `<div class="librow"><button class="row" data-act="${act}" ${act === 'go' ? 'data-v="newex"' : ''} data-id="${esc(e.id)}"><span class="addb" aria-hidden="true">${ic(TYPEICON[e.logType] || 'bar', 'sm')}</span><span class="grow"><b>${esc(e.name)}${e.custom ? ' <span class="tag w" style="font-size:10px">yours</span>' : ''}</b><small>${esc(L.TYPE_LABEL[e.logType])}${e.variant && L.VARIANT_LABEL[e.variant] ? ', ' + esc(L.VARIANT_LABEL[e.variant]) : ''}${e.unilateral ? ', one side' : ''}, ${top ? 'last ' + setShort(top, e) : 'never logged'}</small></span><span class="addb" aria-hidden="true">${ic(act === 'go' ? 'edit' : sp.m === 'progress' || sp.m === 'compare' ? 'chev' : 'plus', 'sm')}</span></button><button class="star ${e.fav ? 'on' : ''}" data-act="favTog" data-id="${esc(e.id)}" aria-pressed="${e.fav}" aria-label="${e.fav ? 'Remove from' : 'Add to'} favourites: ${esc(e.name)}">${ic('star', 'sm')}</button></div>`; };
  if (!list.length) return q ? `<div class="card empty" style="margin-top:12px"><b>No match for "${esc(LIB.q)}"</b><p class="lede">Create it once and it logs like any built-in exercise.</p><button class="btn" style="margin-top:12px" data-act="newexFrom" data-q="${esc(LIB.q)}">${ic('plus', 'sm')}Create "${esc(LIB.q)}"</button></div>` : `<p class="lede" style="margin-top:14px">Nothing logged yet.</p>`;
  let h = '';
  if (sp.m === 'progress' && !q && LIB.g === 'All') h += `<div class="card list" style="margin-top:12px"><button class="row" data-act="progBw"><span class="addb" aria-hidden="true">${ic('scale', 'sm')}</span><span class="grow"><b data-body>Bodyweight</b><small>weekly weigh-ins, ${D.weighins().length} so far</small></span>${ic('chev', 'sm')}</button></div>`;
  if (!q && LIB.g === 'All') {
    /* favourites first, then anything imported with an unclear muscle, then recent */
    const favs = list.filter(e => e.fav);
    if (favs.length) h += `<div class="sec"><h5>Favourites</h5><span>${favs.length}</span></div><div class="card list">${favs.map(e => row(e)).join('')}</div>`;
    const unclear = list.filter(e => e.custom && e.needsGroup);
    if (unclear.length && !['progress', 'compare'].includes(sp.m)) h += `<div class="sec"><h5>Needs a group</h5><span>tap to choose</span></div><div class="card list">${unclear.map(e => row(e, 'go')).join('')}</div>`;
  }
  if (!q && LIB.g === 'All' && !['progress', 'compare'].includes(sp.m)) {
    const seen = new Set(), recent = [];
    for (const w of D.workouts()) for (const it of w.items) if (!seen.has(it.exId) && recent.length < 6) { seen.add(it.exId); recent.push(D.ex(it.exId)); }
    if (recent.length) h += `<div class="sec"><h5>Recent</h5><span>last weight</span></div><div class="card list">${recent.map(e => row(e)).join('')}</div>`;
  }
  const by = {};
  const groupOfMuscle = m => (GROUPS.find(x => Array.isArray(x[1]) && x[1].includes(m)) || ['Other'])[0];
  list.forEach(e => { const k = groupOfMuscle(e.primary); (by[k] = by[k] || []).push(e); });
  const order = GROUPS.map(x => x[0]).concat('Other');
  const keys = Object.keys(by).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  h += keys.map(k => `<div class="sec"><h5>${esc(k)}</h5><span>${by[k].length}</span></div><div class="card list">${by[k].sort((a, b) => (b.fav - a.fav) || (b.custom ? 1 : 0) - (a.custom ? 1 : 0)).map(e => row(e)).join('')}</div>`).join('');
  h += `<button class="card row" style="margin-top:12px;padding:14px 16px" data-act="newexFrom" data-q=""><span class="addb">${ic('plus', 'sm')}</span><span class="grow"><b class="t14">Can't find it?</b><small>Create your own; it uses one of the 7 log types</small></span>${ic('chev', 'sm')}</button>`;
  return h;
}
IN.libq = v => { LIB.q = v; const b = document.getElementById('libbody'); if (b) b.innerHTML = libBody(S.sp); };
A.libg = d => { LIB.g = d.v; renderSheet(); };
A.newexFrom = d => { NEWEX = null; nav('newex', {name: d.q || '', from: S.sp.m || 'add'}); };
A.libPick = d => {
  const m = S.sp.m, id = d.id;
  if (m === 'add' || m === 'swap') {
    const s = D.session();
    if (!s) { closeSheet(); return; }
    const cur = curItem(s), i = cur ? s.items.indexOf(cur) : -1;
    if (m === 'swap' && cur && !cur.sets.some(x => x.done)) { const n = cur.sets.filter(x => x.type !== 'warmup').length || 3; Object.assign(cur, makeItem(id, n, cur.targetReps), {uid: cur.uid, link: cur.link}); }
    else { const it = makeItem(id, 3, 0); s.items.splice(i + 1, 0, it); s.cur = it.uid; }
    D.saveSession(s); S.sheet = null; history.state && history.state.s ? history.back() : renderSheet();
    setTimeout(() => { render(); window.scrollTo(0, 0); }, 30);
    return;
  }
  if (m === 'tpl') { TPL && TPL.items.push({exId: id, sets: 3, reps: 8, link: false}); closeSheet(); setTimeout(render, 30); return; }
  if (m === 'progress') { PROG.ex = id; PROG.cmp = null; closeSheet(); setTimeout(render, 30); return; }
  if (m === 'compare') { PROG.cmp = id; closeSheet(); setTimeout(render, 30); return; }
  if (m === 'map') { const x = IMP && IMP.plan && IMP.plan.exercises[+S.sp.ref]; if (x) { x.choice = 'map'; x.mapTo = id; x.match = {status: 'suggest', id}; } closeSheet(); setTimeout(render, 30); }
};

/* ---------- finish ---------- */
A.finish = () => {
  const s = D.session(); if (!s) return;
  if (!s.items.some(it => it.sets.some(x => x.done))) { toast('Log at least one set first, or discard the workout.', {action: {label: 'Discard', fn: A.discard}}); return; }
  S.sheet = null; nav('finish');
};
VIEWS.finish = {dock: false, render() {
  const s = D.session(); if (!s) return VIEWS.log.render({});
  const w = sessionAsWorkout(s), sum = L.workoutSummary(Object.assign({}, w, {end: Date.now()}), id => D.ex(id));
  const tags = prTagsFor(s), st = D.settings();
  const prs = [];
  for (const it of s.items) { const e = D.ex(it.exId); for (const x of it.sets) if (tags.has(x.id)) { const prevBest = (() => { const h = D.lastOf(e.id); return h ? h.sets.filter(L.isReal).reduce((a, b) => L.setWeight(b, e) > L.setWeight(a, e) ? b : a, h.sets.filter(L.isReal)[0]) : null; })(); prs.push({e, x, t: tags.get(x.id), prev: prevBest}); } }
  const skipped = s.items.reduce((n, it) => n + it.sets.filter(x => !x.done && !x.extra && x.type !== 'warmup').length, 0);
  const ms = L.muscleSets([w], id => D.ex(id));
  const hit = Object.entries(ms).filter(([m]) => m !== 'cardio').sort((a, b) => b[1] - a[1]);
  const first = s.title.trim() || 'Workout';
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back to logging">${ic('back')}</button>${prs.length ? `<span class="tag" style="font-size:12px;padding:5px 10px">${plural(prs.length, 'PR')}</span>` : ''}</div>
    <div class="fin"><p class="lbl" style="margin-top:18px">${esc(dLong(s.date))}</p><h3>${esc(first)}, done.</h3></div>
    <div class="stat3"><div class="card"><div class="lbl">Time</div><b class="serif">${sum.min}<small> min</small></b></div><div class="card"><div class="lbl">Sets</div><b class="serif">${sum.sets}</b></div><div class="card"><div class="lbl">Volume</div><b class="serif">${sum.vol >= 1000 ? fmt(+(sum.vol / 1000).toFixed(1)) + '<small> t</small>' : Math.round(sum.vol) + '<small> kg</small>'}</b></div></div>
    ${skipped ? `<p class="lede" style="margin-top:10px">${plural(skipped, 'planned set')} not logged ${skipped === 1 ? 'is' : 'are'} left out.</p>` : ''}
    ${prs.length ? `<div class="sec"><h5>Personal records</h5></div><div class="card list">${prs.map(p => `<div class="row"><div class="addb okm">${ic('trophy', 'sm')}</div><div class="grow"><b>${esc(p.e.name)} ${setShort(p.x, p.e)}</b><small>${L.PR_LABEL[p.t[0]]}${['barbell', 'rack', 'machine'].includes(p.e.logType) && p.x.reps ? `, est. 1RM ${fmt(L.roundTo(L.e1rm(p.x.kg, p.x.reps, st.formula), st.steps.round))} kg` : ''}</small></div></div>`).join('')}</div>` : ''}
    ${hit.length ? `<div class="sec"><h5>Muscles hit</h5><span>sets this session</span></div><div class="card list">${hit.slice(0, 8).map(([m, n]) => mrow(m, n, st.ranges[m])).join('')}</div>` : ''}
    <label class="card fld" style="margin-top:10px"><small>Note</small><textarea data-in="wnote" rows="2" placeholder="Add a note about this session…">${esc(s.note || '')}</textarea></label>
    <div style="margin-top:16px"><button class="btn" data-act="saveWorkout">${ic('check')}Save workout</button></div>
    <div class="btns"><button class="btn2" data-act="sessToTpl">${ic('book', 'sm')}Save as template</button><button class="btn2" data-act="back">Resume</button></div>`;
}};
A.saveWorkout = () => {
  const s = D.session(); if (!s) return;
  const items = s.items.map(it => ({uid: it.uid, exId: it.exId, link: !!it.link, sets: it.sets.filter(x => x.done).map(x => { const y = Object.assign({}, x); delete y.extra; delete y.inserted; return y; })})).filter(it => it.sets.length);
  const skipped = s.items.reduce((n, it) => n + it.sets.filter(x => !x.done && !x.extra && x.type !== 'warmup').length, 0);
  const lastTs = Math.max(s.start, ...s.items.flatMap(it => it.sets.filter(x => x.done).map(x => x.ts || 0)));
  const w = {id: s.id, date: s.date, title: s.title || 'Workout', note: s.note || '', start: s.start, end: Math.max(lastTs, Math.min(Date.now(), lastTs + 15 * 60000)), items, skipped, templateId: s.templateId || null, bw: D.latestBw()};
  Store.put('workouts', w);
  Store.setOne('session', null); unwake();
  nav('log', {}, {replace: true});
  toast(`Saved: ${w.title}`);
};

/* ---------- A1: this machine's weight step ---------- */
A.exstep = d => { const s = D.session(), it = curItem(s); savePref(it.exId, {step: +d.v}); D._ex.clear(); renderSheet(); render(); };

/* ---------- A2: type any weight ---------- */
let KGV = null;
A.typeKg = () => { const s = D.session(), it = s && curItem(s), i = it ? curIdx(it) : -1; if (i < 0) return; KGV = String(it.sets[i].kg ?? ''); openSheet('kg'); };
function kgNote(v) {
  const s = D.session(), it = curItem(s), e = D.ex(it.exId), st = D.settings(), kg = parseFloat(v);
  if (!(kg > 0)) return 'Type a weight in kg.';
  if (e.logType === 'barbell') { const bar = L.barFor(e, st); if (kg < bar) return `Lighter than the ${fmt(bar)} kg bar.`; const sp = L.splitPlates((kg - bar) / 2, L.plateSet(st)); return sp.rest ? `Your plates make ${fmt(kg - sp.rest * 2)} kg, not ${fmt(kg)}. Saved as typed.` : `Per side ${sp.plates.join(' + ') || 'nothing'}.`; }
  if (e.logType === 'rack' && e.variant === 'dumbbell' && !L.dumbbellRange(st).includes(kg)) return 'Not on your dumbbell rack (Equipment). Saved as typed.';
  return '';
}
SHEETS.kg = {title: 'Type a weight', render() {
  return `<div class="hd"><h3>Weight</h3></div><label class="card fld"><small>Kilograms</small><input data-in="kgv" type="number" inputmode="decimal" step="any" min="0" max="999" value="${esc(KGV)}" autofocus></label>
    <p class="lede" data-kgnote>${esc(kgNote(KGV))}</p><button class="btn" style="margin-top:14px" data-act="kgSave">${ic('check')}Use this weight</button>`;
}, bind(el) { const i = $('[data-in="kgv"]', el); if (i) setTimeout(() => i.select(), 80); i && i.addEventListener('keydown', ev => { if (ev.key === 'Enter') A.kgSave(); }); }};
IN.kgv = v => { KGV = v; const n = $('[data-kgnote]'); if (n) n.textContent = kgNote(v); };
A.kgSave = () => { const kg = +(+parseFloat(KGV)).toFixed(2); if (!(kg > 0 && kg < 1000)) return toast('Type a weight in kg.'); closeSheet(); setTimeout(() => withCur((c, e, it, s, i) => { const b = c.kg; c.kg = kg; carry(it, i, 'kg', b, kg); }), 30); };

/* ---------- A6: last time, every set ---------- */
A.lastPeek = () => openSheet('last');
SHEETS.last = {title: 'Last time', render() {
  const s = D.session(), it = curItem(s), e = D.ex(it.exId), h = D.historyOf(e.id).slice(0, 3);
  if (!h.length) return `<div class="hd"><h3>${esc(e.name)}</h3></div><p class="lede">First time logging this. Last time's sets show here from next session.</p>`;
  return `<div class="hd"><h3>${esc(e.name)}</h3></div>${h.map((x, k) => `<div class="sec"><h5>${k ? esc(dDay(x.w.date)) : 'Last time, ' + esc(dDay(x.w.date))}</h5><span>${esc(x.w.title)}</span></div><div class="card list">${x.sets.map(y => `<div class="set"><span class="no">${typeLetter(y.type) || ''}</span><span>${setLong(y, e)}</span><span class="nt">${esc(y.note || '')}</span></div>`).join('')}</div>`).join('')}`;
}};

/* ---------- A7: swipe left / right on the Log screen for the next / previous exercise ---------- */
(function () {
  let x0 = null, y0 = 0, t0 = 0;
  document.addEventListener('pointerdown', ev => {
    x0 = null;
    if (ev.pointerType === 'mouse' || S.view !== 'log' || S.sheet || !D.session()) return;
    if (ev.target.closest('[data-strip], .sets2, input, textarea, .seg, .ssc, .chips, .chipz, #dock')) return;
    x0 = ev.clientX; y0 = ev.clientY; t0 = Date.now();
  }, {passive: true});
  document.addEventListener('pointerup', ev => {
    if (x0 == null) return; const dx = ev.clientX - x0, dy = ev.clientY - y0; x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Date.now() - t0 > 600) return;
    const s = D.session(), k = s.items.indexOf(curItem(s)) + (dx < 0 ? 1 : -1), nx = s.items[k];
    if (!nx) { vib(4); return; }
    s.cur = nx.uid; D.saveSession(s); vib(8); render(); window.scrollTo(0, 0);
  }, {passive: true});
})();

/* ---------- B: rest over works like an alarm clock ---------- */
const ALARM = {open: false, ring: null, ringUntil: 0};
function alarmEl() { let el = document.getElementById('alarm'); if (!el) { el = document.createElement('div'); el.id = 'alarm'; document.body.appendChild(el); } return el; }
function showAlarm(ago) {
  const s = D.session(); if (!s) return;
  ALARM.open = true;
  const it = curItem(s), e = it && D.ex(it.exId), i = it ? curIdx(it) : -1, nx = i >= 0 ? it.sets[i] : null, st = D.settings();
  const next = e && nx ? `<div class="card alarm-next"><div class="lbl">Up next, ${esc(setPill(s, it, e, i).toLowerCase())}</div><div class="alarm-row"><b>${esc(e.name)}</b><b class="serif">${setShort(nx, e)}</b></div>${e.logType === 'barbell' ? `<div style="margin-top:6px">${barSVG(nx.kg, L.barFor(e, st), e.variant)}</div>` : ''}</div>` : (e ? `<div class="card alarm-next"><div class="lbl">Next</div><div class="alarm-row"><b>${esc(e.name)}</b></div></div>` : '');
  const el = alarmEl();
  el.innerHTML = `<div class="alarm" tabindex="-1" role="alertdialog" aria-modal="true" aria-labelledby="alarmT" aria-describedby="alarmD">
    <div class="alarm-in"><div class="alarm-ring" aria-hidden="true">${ic('bell')}</div>
    <h2 id="alarmT" class="alarm-h">Rest over</h2><p id="alarmD" class="lede alarm-ago">${ago ? `Ended ${mmss(ago)} ago.` : 'Time for the next set.'}</p>
    ${next}
    <div class="slide" data-slide><span class="slide-txt">Slide to lift</span><button class="knob" data-knob aria-label="Slide to lift. Or press and hold, or press Enter.">${ic('chev')}</button></div>
    <button class="btn2 alarm-snooze" data-act="alarmSnooze">${ic('timer', 'sm')}+30 s more rest</button></div></div>`;
  el.classList.add('open');
  bindSlide($('[data-slide]', el));
  /* ring: bell and buzz every 2.5 s until dismissed, for up to a minute */
  clearInterval(ALARM.ring); ALARM.ringUntil = Date.now() + 60000;
  const ring = () => { if (!ALARM.open || Date.now() > ALARM.ringUntil || document.hidden) return; bell(); vibAlarm([300, 120, 300]); };
  ring(); ALARM.ring = setInterval(ring, 2500);
  setTimeout(() => { const d = $('.alarm', el); d && d.focus({preventScroll: true}); }, 60); /* announce it; Tab reaches the knob */
}
function closeAlarm() { ALARM.open = false; clearInterval(ALARM.ring); try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} const el = alarmEl(); el.classList.remove('open'); el.innerHTML = ''; }
function dismissAlarm() {
  const s = D.session(); if (s) { s.rest = null; D.saveSession(s); }
  closeAlarm(); vib(20);
  if (S.view !== 'log') nav('log'); else { render(); window.scrollTo(0, 0); }
}
A.alarmSnooze = () => { const s = D.session(); if (s) { s.rest = {end: Date.now() + 30000, total: 30, rang: false}; D.saveSession(s); } closeAlarm(); tick(); toast('30 s more rest'); };
function bindSlide(track) {
  if (!track) return;
  const knob = $('[data-knob]', track);
  let x0 = 0, dx = 0, max = 0, dragging = false, holdT = null;
  const set = v => { knob.style.transform = `translateX(${v}px)`; track.style.setProperty('--p', max ? v / max : 0); };
  knob.addEventListener('pointerdown', ev => {
    ev.preventDefault(); try { knob.setPointerCapture(ev.pointerId); } catch (e) {}
    max = track.clientWidth - knob.offsetWidth - 8; x0 = ev.clientX; dx = 0; dragging = true; knob.style.transition = 'none';
    holdT = setTimeout(() => { if (dragging && Math.abs(dx) < 6) { dragging = false; dismissAlarm(); } }, 800); /* press and hold also works */
  });
  knob.addEventListener('pointermove', ev => { if (!dragging) return; dx = Math.max(0, Math.min(max, ev.clientX - x0)); if (Math.abs(dx) >= 6) clearTimeout(holdT); set(dx); });
  const end = () => { if (!dragging) return; dragging = false; clearTimeout(holdT); if (dx >= max * 0.85) { set(max); dismissAlarm(); return; } knob.style.transition = ''; set(0); };
  knob.addEventListener('pointerup', end); knob.addEventListener('pointercancel', end);
  knob.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); dismissAlarm(); } });
}

/* ---------- C: favourites ---------- */
function setFav(id, on) { savePref(id, {fav: on}); D._ex.clear(); }
A.favTog = d => { const e = D.ex(d.id); setFav(d.id, !e.fav); vib(8); const b = document.getElementById('libbody'); if (b) { const sh = $('.sheet'), top = sh && sh.scrollTop; b.innerHTML = libBody(S.sp); if (sh) sh.scrollTop = top; } else render(); };
A.favCur = () => { const s = D.session(), it = curItem(s), e = D.ex(it.exId); setFav(e.id, !e.fav); renderSheet(); };
A.startFav = d => { if (D.session()) return toast('A workout is already running.'); S.sheet = null; startWorkout({title: 'Workout', items: [{exId: d.id, sets: 3}]}); };
