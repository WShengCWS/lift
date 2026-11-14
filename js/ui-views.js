/* LIFT screens outside the set logger: Home, History, Progress, Stats, Settings, Templates, New exercise, Welcome, Import. */
'use strict';
const exOf = id => D.ex(id);
const tons = v => v >= 1000 ? `${fmt(+(v / 1000).toFixed(1))}<small> t</small>` : `${Math.round(v)}<small> kg</small>`;
const MUSCLE_ORDER = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps', 'glutes', 'calves', 'core', 'forearms', 'traps'];
function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function weekCounts(st, n = 8) {
  const ws = D.workouts(), cur = L.weekStartOf(today(), st.weekStart), out = [];
  for (let i = n - 1; i >= 0; i--) { const wk = L.addDays(cur, -7 * i); out.push({wk, n: L.weekWorkouts(ws, wk).length, current: i === 0}); }
  return out;
}
function streak(st) {
  const ws = D.workouts(); if (!ws.length) return 0;
  const cur = L.weekStartOf(today(), st.weekStart);
  let n = L.weekWorkouts(ws, cur).length >= st.weeklyTarget ? 1 : 0, wk = L.addDays(cur, -7);
  while (L.weekWorkouts(ws, wk).length >= st.weeklyTarget) { n++; wk = L.addDays(wk, -7); }
  return n;
}
const dateTile = s => { const d = L.parseDate(s); return `<div class="date"><span>${DAY[d.getDay()]}</span><b>${d.getDate()}</b></div>`; };

/* ---------- Home ---------- */
let WI = {bw: null};
VIEWS.home = {dock: true, render() {
  const ws = D.workouts(), st = D.settings();
  if (!ws.length) return homeFirst();
  const t = today(), wk = L.weekStartOf(t, st.weekStart), thisW = L.weekWorkouts(ws, wk), ms = L.muscleSets(thisW, exOf);
  const rangesM = MUSCLE_ORDER.filter(m => st.ranges[m]);
  const behind = rangesM.map(m => ({m, have: ms[m] || 0, need: st.ranges[m][0]})).filter(x => x.have < x.need).sort((a, b) => (b.need - b.have) / b.need - (a.need - a.have) / a.need).slice(0, 2);
  const tpls = D.templates();
  let pick = null, cover = 0;
  if (behind.length) for (const tp of tpls) { let c = 0; for (const x of tp.items) { const e = exOf(x.exId); if (behind.some(b => b.m === e.primary)) c += x.sets; else if (behind.some(b => (e.secondary || []).includes(b.m))) c += x.sets / 2; } if (c > cover) { cover = c; pick = tp; } }
  if (!pick && tpls.length) pick = tpls.slice().sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0))[0];
  const last = ws[0];
  const focusH = behind.length ? `${esc(cap(behind[0].m))}${behind[1] ? ` and ${esc(behind[1].m)} are` : ' is'} behind.` : `On track this week.`;
  /* name only the behind muscles the suggested template really trains */
  const covered = pick && cover ? behind.filter(b => pick.items.some(x => { const e = exOf(x.exId); return e.primary === b.m || (e.secondary || []).includes(b.m); })) : [];
  const coverTxt = !covered.length ? '' : covered.length === behind.length && behind.length > 1 ? `covers both` : `covers ${covered.map(b => b.m).join(' and ')}`;
  const why = behind.length ? `${behind.map((b, i) => `${i ? b.m : cap(b.m)} ${fmt(b.have)} of ${b.need} sets`).join(', ')}.${coverTxt ? ` ${esc(pick.name)} ${coverTxt}: about ${Math.round(cover)} sets.` : ''}` : `Every muscle has its minimum sets. ${thisW.length} of ${st.weeklyTarget} sessions so far.`;
  const wc = weekCounts(st), sk = streak(st);
  const days = []; for (let i = 0; i < 7; i++) { const d = L.addDays(wk, i); const did = thisW.some(w => w.date === d); days.push(`<span>${I18N.wdLetter(L.parseDate(d).getDay())}<em class="${did ? 'y' : d === t ? 't' : ''}"></em></span>`); }
  /* weekly weigh-in: shown until logged (or skipped) this week */
  const wis = D.weighins(), wiThis = wis.filter(x => x.date >= wk).pop(), prevW = wis.filter(x => x.date < wk).pop(), meta = D.meta();
  let wiCard = '';
  if (wiThis) wiCard = `<div class="card list" style="margin-top:10px"><button class="row" data-act="progBw"><span class="addb okm">${ic('check', 'sm')}</span><span class="grow"><b>Bodyweight ${fmt(wiThis.kg.toFixed(1))} kg</b><small>${prevW ? `${signed(+(wiThis.kg - prevW.kg).toFixed(1))} kg vs last week, ` : ''}trend in Progress</small></span>${ic('chev', 'sm')}</button></div>`;
  else if (meta.wiSkip !== wk) { if (WI.bw == null) WI.bw = D.latestBw(); wiCard = weighCard(prevW || wis[wis.length - 1]); }
  /* backup nudge every 7 days */
  const lb = meta.lastBackup || 0, days7 = (Date.now() - lb) / 864e5;
  const backup = st.backupReminder && ws.length && days7 > 7 && meta.backupSnooze !== t ? `<div class="card banner"><span class="addb">${ic('dl', 'sm')}</span><div class="grow"><b>Back up your workouts</b><small>${lb ? `Last backup ${Math.floor(days7)} days ago` : 'No backup yet'}, one file, everything</small></div><button class="btn2" style="flex:0 0 auto;padding:0 14px;height:40px" data-act="exportNow">Export</button></div>` : '';
  /* latest PR, last 14 days */
  const prs = D.prs(); let lp = null;
  for (const w of ws) { if (L.daysBetween(w.date, t) > 14) break; for (const it of w.items) for (const x of it.sets) if (prs.has(x.id)) { lp = lp || {w, it, x}; } if (lp) break; }
  const slip = slipping(ws, t);
  const rows = MUSCLE_ORDER.filter(m => st.ranges[m] || ms[m]);
  return `<div class="hd"><div style="min-width:0"><p>${esc(dLong(t).replace(/ (\d+) /, ', $1 '))}, week ${L.isoWeek(t)}</p><h3 class="pt">${greet()}${st.name ? ', ' + esc(st.name) : ''}</h3></div><div class="rbs"><button class="rb" data-act="go" data-v="templates" aria-label="Templates">${ic('book', 'sm')}</button><button class="rb" data-act="go" data-v="settings" aria-label="Settings">${ic('gear')}${syncDot()}</button></div></div>
    <div class="card focus"><h4 style="margin-top:0">${focusH}</h4><div class="why">${why}</div>
      ${pick ? `<button class="btn" style="margin-top:14px" data-act="startTpl" data-id="${esc(pick.id)}">${ic('play', 'sm')}Start ${esc(pick.name)}</button>` : `<button class="btn" style="margin-top:14px" data-act="startSheet">${ic('play', 'sm')}Start a workout</button>`}
      <div class="alt">${last ? `<button data-act="repeat" data-id="${esc(last.id)}">Repeat last: ${esc(last.title)}</button>` : ''}<button data-act="startEmpty">Empty workout</button></div></div>
    <div class="two"><div class="card mini"><div class="lbl">Streak</div><b class="serif">${sk} <small>${sk === 1 ? 'week' : 'weeks'} on target</small></b><div class="dots" aria-label="Last 8 weeks">${wc.map(x => `<i class="${x.n >= st.weeklyTarget ? 'y' : x.current && x.n ? 'p' : ''}"></i>`).join('')}</div></div>
      <div class="card mini"><div class="lbl">This week</div><b class="serif">${thisW.length}<small> / ${st.weeklyTarget} sessions</small></b><div class="days">${days.join('')}</div></div></div>
    ${wiCard}${backup}
    <div class="sec"><h5>Muscle volume</h5><span>working sets this week</span></div><div class="card list">${rows.map(m => mrow(m, ms[m] || 0, st.ranges[m])).join('')}</div>
    ${lp ? `<div class="sec"><h5>Latest PR</h5><span>${esc(dDay(lp.w.date))}</span></div><div class="card list"><button class="row" data-act="progressOf" data-id="${esc(lp.it.exId)}"><span class="addb okm">${ic('trophy', 'sm')}</span><span class="grow"><b>${esc(exOf(lp.it.exId).name)} ${setShort(lp.x, exOf(lp.it.exId))}</b><small>${L.PR_LABEL[prs.get(lp.x.id)[0]]}</small></span>${ic('chev', 'sm')}</button></div>` : ''}
    ${slip.length ? `<div class="sec"><h5>Slipping</h5><span>not trained lately</span></div><div class="card list">${slip.map(x => `<div class="row"><div class="addb unm">${ic('clock', 'sm')}</div><div class="grow"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div></div>`).join('')}</div>` : ''}`;
}};
function syncDot() { const s = Store.syncState(); return s === 'off' ? '' : `<span class="dot" style="background:var(--${s === 'ok' ? 'ok' : s === 'warn' ? 'under' : 'over'})"></span>`; }
function weighCard(prev) {
  const bw = WI.bw;
  return `<div class="card wi"><div class="hd"><div><b style="font-size:16px;font-weight:800">Weekly weigh-in</b><p style="margin-top:2px">${prev ? `last ${fmt(prev.kg.toFixed(1))} kg, ${esc(dDay(prev.date))}` : 'once a week is enough'}</p></div><b class="serif" data-wv>${bw.toFixed(1)}<small> kg</small></b></div>${weighStrip(bw)}<div class="btns" style="margin-top:6px"><button class="btn2" data-act="wiLog">${ic('check', 'sm')}<span data-wl>Log ${bw.toFixed(1)} kg</span></button><button class="btn2" style="flex:0 0 auto;padding:0 18px" data-act="wiSkip">Not now</button></div></div>`;
}
const weighStrip = bw => strip('wi', range(Math.max(30, Math.round(bw) - 6), Math.round(bw) + 6, .1), +bw.toFixed(1), v => v.toFixed(1), 'small', 'Bodyweight');
STRIP.wi = {live(v) { WI.bw = v; $$('[data-wv]').forEach(x => x.innerHTML = `${v.toFixed(1)}<small> kg</small>`); $$('[data-wl]').forEach(x => x.textContent = `Log ${v.toFixed(1)} kg`); }, set(v) { WI.bw = v; }};
A.wiLog = () => {
  const st = D.settings(), wk = L.weekStartOf(today(), st.weekStart), kg = +(+WI.bw).toFixed(1);
  D.weighins().filter(x => x.date >= wk).forEach(x => Store.remove('weighins', x.id));
  Store.put('weighins', {id: 'bw_' + today(), date: today(), kg});
  D.saveSettings({bw: kg});
  if (S.sheet) closeSheet();
  render(); toast(`Bodyweight ${fmt(kg)} kg saved`);
};
A.wiSkip = () => { D.setMeta({wiSkip: L.weekStartOf(today(), D.settings().weekStart)}); render(); };
A.weighSheet = () => { WI.bw = D.latestBw(); openSheet('weighin'); };
SHEETS.weighin = {title: 'Weigh-in', render() { if (WI.bw == null) WI.bw = D.latestBw(); return `<div class="hd"><h3 data-body>Bodyweight</h3><b class="serif" style="font-size:40px" data-wv>${WI.bw.toFixed(1)}<small style="font-family:Manrope;font-size:13px;color:var(--soft)"> kg</small></b></div><p class="lede">Used for pull-ups, dips and push-ups, and the line in Progress.</p><div class="card vis">${weighStrip(WI.bw)}</div><button class="btn" style="margin-top:14px" data-act="wiLog">${ic('check')}<span data-wl>Log ${WI.bw.toFixed(1)} kg</span></button>`; }};
function slipping(ws, t) {
  const out = [], byT = {};
  ws.slice().reverse().forEach(w => (byT[w.title] = byT[w.title] || []).push(w.date));
  for (const [title, ds] of Object.entries(byT)) {
    if (ds.length < 3) continue;
    const gaps = ds.slice(1).map((d, i) => L.daysBetween(ds[i], d)).filter(g => g > 0).sort((a, b) => a - b); if (!gaps.length) continue;
    const med = gaps[Math.floor(gaps.length / 2)], lo = gaps[Math.floor(gaps.length / 4)], hi = gaps[Math.floor(gaps.length * 3 / 4)], since = L.daysBetween(ds[ds.length - 1], t);
    if (since > Math.max(med * 1.5, med + 2) && since < 60) out.push({t: `${title}: ${since} days`, s: lo === hi ? `Usually every ${med} days` : `Usually every ${lo} to ${hi} days`, d: since / med});
  }
  const byE = {};
  ws.slice().reverse().forEach(w => w.items.forEach(it => { const a = byE[it.exId] = byE[it.exId] || []; if (a[a.length - 1] !== w.date) a.push(w.date); }));
  for (const [id, ds] of Object.entries(byE)) {
    if (ds.length < 3) continue;
    const since = L.daysBetween(ds[ds.length - 1], t);
    const gaps = ds.slice(1).map((d, i) => L.daysBetween(ds[i], d)).sort((a, b) => a - b), med = gaps[Math.floor(gaps.length / 2)] || 7;
    if (since >= 14 && since > med * 2 && since < 90) { const e = exOf(id), h = D.lastOf(id), top = h && h.sets.filter(x => x.type !== 'warmup').pop(); out.push({t: `${e.name}: ${since >= 14 ? Math.round(since / 7) + ' weeks' : since + ' days'}`, s: `Last ${dShort(ds[ds.length - 1])}${top ? ', ' + setShort(top, e) : ''}`, d: since / med}); }
  }
  return out.sort((a, b) => b.d - a.d).slice(0, 3);
}
A.exportNow = (d, el) => busy(el, () => exportBackup());

/* first week: 4 starter templates */
let HOME0 = 'start_push';
function homeFirst() {
  const st = D.settings(), t = today();
  let tpls = D.templates().filter(x => x.starter); if (!tpls.length) tpls = D.templates().slice(0, 4);
  const P = tpls.find(x => x.id === HOME0) || tpls[0];
  const wk = L.weekStartOf(t, st.weekStart);
  return `<div class="hd"><div style="min-width:0"><p>${esc(dLong(t).replace(/ (\d+) /, ', $1 '))}, week ${L.isoWeek(t)}</p><h3 class="pt">${greet()}${st.name ? ', ' + esc(st.name) : ''}</h3></div><div class="rbs"><button class="rb" data-act="go" data-v="settings" aria-label="Settings">${ic('gear')}</button></div></div>
    <div class="card focus"><h4 style="margin-top:0">Start with a template.</h4><div class="why">Your first week. Swap, add or skip exercises as you lift. From your second workout, LIFT fills in last time's numbers.</div>
    ${tpls.length ? `<div class="tgrid" style="margin-top:14px">${tpls.map(x => `<button data-act="home0" data-id="${esc(x.id)}" class="st0 ${P && x.id === P.id ? 'on' : ''}" aria-pressed="${P && x.id === P.id}"><b style="margin-top:0;font-size:16px">${esc(x.name)}</b><small>${esc(x.note || x.items.slice(0, 2).map(i => exOf(i.exId).name).join(', '))}</small><small style="margin-top:auto;padding-top:6px">${plural(x.items.length, 'exercise')}, ~${Math.max(20, x.items.reduce((a, i) => a + i.sets, 0) * 3)} min</small></button>`).join('')}</div>
    <p class="lede" style="margin-top:10px">${P.items.map(i => esc(exOf(i.exId).name)).join(', ')}</p>
    <button class="btn" style="margin-top:12px" data-act="startTpl" data-id="${esc(P.id)}">${ic('play', 'sm')}Start ${esc(P.name)}</button>` : `<button class="btn" style="margin-top:12px" data-act="startEmpty">${ic('play', 'sm')}Start a workout</button>`}
    <div class="alt"><button data-act="startEmpty">Empty workout</button><button data-act="go" data-v="import1">Import a backup</button></div></div>
    <div class="two"><div class="card mini"><div class="lbl">Streak</div><b class="serif">0 <small>weeks</small></b><div class="dots">${'<i></i>'.repeat(8)}</div></div>
    <div class="card mini"><div class="lbl">This week</div><b class="serif">0<small> / ${st.weeklyTarget} sessions</small></b><div class="days">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = L.addDays(wk, i); return `<span>${I18N.wdLetter(L.parseDate(d).getDay())}<em class="${d === t ? 't' : ''}"></em></span>`; }).join('')}</div></div></div>
    <div class="sec"><h5>Muscle volume</h5><span>fills in as you log</span></div><div class="card list mv0">${MUSCLE_ORDER.filter(m => st.ranges[m]).map(m => mrow(m, 0, st.ranges[m])).join('')}</div>
    <p class="lede" style="margin:8px 4px 0">The green band is each muscle's weekly target range. Change the ranges in Settings.</p>`;
}
A.home0 = d => { HOME0 = d.id; render(); };

/* ---------- History ---------- */
let HIST = {q: '', f: 'All'};
VIEWS.history = {dock: true, render() {
  const ws = D.workouts();
  const titles = {}; ws.forEach(w => titles[w.title] = (titles[w.title] || 0) + 1);
  const top = Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  return `<div class="hd"><div><p>${ws.length ? `${plural(ws.length, 'workout')}, since ${dShort(ws[ws.length - 1].date)}` : 'No workouts yet'}</p><h3 class="pt">History</h3></div><button class="rb" data-act="exportNow" aria-label="Export backup">${ic('dl', 'sm')}</button></div>
    <label class="card search">${ic('search', 'sm')}<input type="search" data-in="hq" value="${esc(HIST.q)}" placeholder="Search workouts or exercises" aria-label="Search history"></label>
    <div class="chips">${['All', ...top, 'PRs only'].map(f => `<button class="chip ${HIST.f === f ? 'on' : ''}" data-act="hf" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>
    <div id="hbody">${histBody()}</div>`;
}};
function histBody() {
  const ws = D.workouts(), q = HIST.q.trim().toLowerCase(), prs = D.prs(), st = D.settings();
  const hasPR = w => w.items.some(it => it.sets.some(x => prs.has(x.id)));
  const list = ws.filter(w => (HIST.f === 'All' || (HIST.f === 'PRs only' ? hasPR(w) : w.title === HIST.f)) && (!q || w.title.toLowerCase().includes(q) || w.items.some(it => exOf(it.exId).name.toLowerCase().includes(q)) || (w.note || '').toLowerCase().includes(q)));
  if (!list.length) return `<div class="card empty" style="margin-top:14px"><b>${ws.length ? 'Nothing matches.' : 'No workouts yet.'}</b><p class="lede">${ws.length ? 'Try another word or filter.' : 'Finished workouts show up here, newest first.'}</p></div>`;
  const cur = L.weekStartOf(today(), st.weekStart), groups = [];
  for (const w of list) { const wk = L.weekStartOf(w.date, st.weekStart); let g = groups[groups.length - 1]; if (!g || g.wk !== wk) groups.push(g = {wk, ws: []}); g.ws.push(w); }
  return groups.map(g => {
    const lbl = g.wk === cur ? 'This week' : g.wk === L.addDays(cur, -7) ? 'Last week' : `Week of ${dShort(g.wk)}`;
    const vol = g.ws.reduce((a, w) => a + L.workoutSummary(w, exOf).vol, 0);
    return `<div class="sec"><h5>${lbl}</h5><span>${plural(g.ws.length, 'session')}, ${L.fmtThousands(vol)} kg</span></div><div class="card list">${g.ws.map(w => { const s = L.workoutSummary(w, exOf); return `<button class="row" data-act="go" data-v="detail" data-id="${esc(w.id)}">${dateTile(w.date)}<span class="grow"><b>${esc(w.title)}</b><small>${s.min ? s.min + ' min, ' : ''}${plural(s.sets, 'set')}, ${L.fmtThousands(s.vol)} kg</small></span>${hasPR(w) ? `<span class="prm" title="Personal record">${ic('trophy', 'xs')}</span>` : ''}${ic('chev', 'sm')}</button>`; }).join('')}</div>`;
  }).join('');
}
IN.hq = v => { HIST.q = v; const b = document.getElementById('hbody'); if (b) b.innerHTML = histBody(); };
A.hf = d => { HIST.f = d.v; render(); };

/* ---------- Workout detail ---------- */
VIEWS.detail = {dock: false, render(p) {
  const w = Store.get('workouts', p.id);
  if (!w) return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button></div><div class="card empty" style="margin-top:20px"><b>This workout is gone.</b></div>`;
  const s = L.workoutSummary(w, exOf), prs = D.prs(), npr = w.items.reduce((a, it) => a + it.sets.filter(x => prs.has(x.id)).length, 0);
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><button class="rb" data-act="dopts" data-id="${esc(w.id)}" aria-label="Workout options">${ic('more')}</button></div>
    <h3 class="ptl">${esc(w.title)}</h3><p class="lede" style="font-size:14px;margin-top:4px">${esc(dLong(w.date))}${w.start ? ', ' + hhmm(w.start) : ''}${s.min ? ', ' + s.min + ' min' : ''}</p>
    <div class="stat3"><div class="card"><div class="lbl">Volume</div><b class="serif">${tons(s.vol)}</b></div><div class="card"><div class="lbl">Sets</div><b class="serif">${s.sets}</b></div><div class="card"><div class="lbl">PRs</div><b class="serif" style="${npr ? 'color:var(--ok)' : ''}">${npr}</b></div></div>
    ${w.note ? `<div class="card" style="margin-top:10px;padding:12px 16px;font-size:14px;font-weight:600;white-space:pre-wrap">${esc(w.note)}</div>` : ''}
    ${w.items.map(it => { const e = exOf(it.exId); let n = 0; return `<div class="sec"><h5>${esc(e.name)}</h5><span>${esc(e.primary)}, ${esc((L.TYPE_LABEL[e.logType] || '').toLowerCase())}</span></div><div class="card list">${it.sets.map(x => { const lt = typeLetter(x.type); if (!lt) n++; const t = prs.get(x.id); return `<button class="set" data-act="dset" data-wid="${esc(w.id)}" data-uid="${esc(it.uid)}" data-id="${esc(x.id)}"><span class="no">${lt || n}</span><span>${setLong(x, e)}${x.rpe ? ` <span class="nt">RPE ${x.rpe}</span>` : ''}</span>${t ? '<span class="tag">PR</span>' : x.note ? `<span class="nt">${esc(x.note)}</span>` : x.type === 'warmup' ? '<span class="tag w">warm-up</span>' : '<span></span>'}</button>`; }).join('')}</div>`; }).join('')}
    ${w.skipped ? `<p class="lede" style="margin-top:10px">${plural(w.skipped, 'planned set')} skipped.</p>` : ''}
    <div style="margin-top:16px"><button class="btn" data-act="repeat" data-id="${esc(w.id)}">${ic('repeat')}Repeat this workout</button></div>
    <div class="btns"><button class="btn2" data-act="wToTpl" data-id="${esc(w.id)}">${ic('book', 'sm')}Save as template</button><button class="btn2 danger" style="flex:0 0 48px;padding:0" data-act="wDel" data-id="${esc(w.id)}" aria-label="Delete workout">${ic('trash', 'sm')}</button></div>`;
}};
A.dset = d => { SETED = null; openSheet('set', {where: 'workout', wid: d.wid, uid: d.uid, id: d.id}); };
A.wToTpl = d => { const w = Store.get('workouts', d.id); saveTemplateFrom(w.title, w.items.map(it => ({exId: it.exId, sets: Math.max(1, it.sets.filter(x => x.type !== 'warmup' && x.type !== 'drop').length), reps: (it.sets.find(x => x.type === 'working') || {}).reps || 0, link: !!it.link}))); };
A.wDel = d => { const old = Store.remove('workouts', d.id); if (!old) return; nav('history', {}, {replace: true}); toast(`Deleted ${old.title}`, {action: {label: 'Undo', fn: () => { Store.put('workouts', old); render(); }}, ms: 6000}); };
A.dopts = d => openSheet('dopts', {id: d.id});
SHEETS.dopts = {title: 'Workout', render(sp) { const w = Store.get('workouts', sp.id); if (!w) return ''; return `<div class="hd"><h3>Edit workout</h3></div><label class="card fld"><small>Name</small><input data-in="dtitle" value="${esc(w.title)}" maxlength="60"></label><label class="card fld"><small>Date</small><input type="date" data-chg="ddate" value="${esc(w.date)}" max="${today()}"></label><label class="card fld"><small>Note</small><textarea data-in="dnote" rows="2">${esc(w.note || '')}</textarea></label><p class="lede">Tap any set on the workout to change it.</p><button class="btn" style="margin-top:12px" data-act="dclose">Done</button>`; }};
IN.dtitle = v => { const w = Store.get('workouts', S.sp.id); if (w) Store.put('workouts', Object.assign({}, w, {title: v.trim().slice(0, 60) || 'Workout'})); };
IN.dnote = v => { const w = Store.get('workouts', S.sp.id); if (w) Store.put('workouts', Object.assign({}, w, {note: v.slice(0, 2000)})); };
IN.ddate = el => { const w = Store.get('workouts', S.sp.id); if (w && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) Store.put('workouts', Object.assign({}, w, {date: el.value})); };
A.dclose = () => { closeSheet(); setTimeout(render, 30); };

/* ---------- Progress ---------- */
const PROG = {ex: null, metric: null, cmp: null, range: '12w'};
const METRICS = {
  weight: [['max', 'Max weight'], ['vol', 'Volume'], ['e1rm', 'Est. 1RM'], ['reps', 'Reps']],
  bodyweight: [['reps', 'Reps'], ['add', 'Added kg'], ['vol', 'Volume']],
  band: [['reps', 'Reps']], timed: [['sec', 'Longest hold']], cardio: [['dist', 'Distance'], ['time', 'Time'], ['pace', 'Pace']],
};
const metricsFor = e => METRICS[['barbell', 'rack', 'machine'].includes(e.logType) ? 'weight' : e.logType] || METRICS.weight;
function seriesOf(exId, metric) {
  const e = exOf(exId), st = D.settings(), prs = D.prs(), out = [];
  for (const h of D.historyOf(exId).reverse()) {
    const real = h.sets.filter(L.isReal); if (!real.length) continue;
    let y = 0;
    switch (metric) {
      case 'max': y = Math.max(...real.map(x => L.setWeight(x, e))); break;
      case 'vol': y = real.reduce((a, x) => a + L.setVolume(x, e), 0); break;
      case 'e1rm': y = Math.max(...real.map(x => L.e1rm(L.setWeight(x, e), L.setReps(x, e), st.formula))); break;
      case 'reps': y = Math.max(...real.map(x => L.setReps(x, e))); break;
      case 'add': y = Math.max(...real.map(x => +x.add || 0)); break;
      case 'sec': y = Math.max(...real.map(x => +x.sec || 0)); break;
      case 'dist': y = real.reduce((a, x) => a + (+x.m || 0), 0) / 1000; break;
      case 'time': y = real.reduce((a, x) => a + (+x.sec || 0), 0) / 60; break;
      case 'pace': { const m = real.reduce((a, x) => a + (+x.m || 0), 0), s = real.reduce((a, x) => a + (+x.sec || 0), 0); if (!m) continue; y = s / 60 / (m / 1000); break; }
    }
    out.push({x: L.parseDate(h.w.date).getTime(), y: +y.toFixed(2), date: h.w.date, pr: h.sets.some(x => prs.has(x.id))});
  }
  return out;
}
const UNIT = {max: 'kg', vol: 'kg', e1rm: 'kg', reps: 'reps', add: 'kg', sec: 's', dist: 'km', time: 'min', pace: 'min/km'};
VIEWS.progress = {dock: true, render() {
  const ws = D.workouts();
  if (ws.length < 2) return `<div class="hd"><div><p>${ws.length ? '1 workout so far' : 'No workouts yet'}</p><h3 class="pt">Progress</h3></div></div><div class="ghostw"><div class="ghost" aria-hidden="true">${sampleProgress()}</div>${emptyCard('Then each exercise gets its chart: max weight, estimated 1RM, PR markers and your best reps at each weight. Below is a preview.', ws.length)}</div>`;
  if (PROG.ex === '__bw') return bwProgress();
  if (!PROG.ex || !D.historyOf(PROG.ex).length) {
    const cnt = {}; ws.slice(0, 40).forEach(w => w.items.forEach(it => { const e = exOf(it.exId); if (['barbell', 'rack', 'machine'].includes(e.logType)) cnt[it.exId] = (cnt[it.exId] || 0) + 1; }));
    PROG.ex = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || ws[0].items[0].exId;
  }
  const e = exOf(PROG.ex), ms = metricsFor(e);
  if (!ms.find(m => m[0] === PROG.metric)) PROG.metric = ms[0][0];
  let pts = seriesOf(PROG.ex, PROG.metric);
  const cut = PROG.range === '12w' ? Date.now() - 84 * 864e5 : PROG.range === '6m' ? Date.now() - 183 * 864e5 : 0;
  const inR = pts.filter(p => p.x >= cut); if (inR.length >= 2) pts = inR;
  const cmp = PROG.cmp && PROG.cmp !== PROG.ex ? seriesOf(PROG.cmp, PROG.metric).filter(p => p.x >= (pts[0] || {x: 0}).x) : null;
  const last = pts[pts.length - 1], first = pts[0];
  const ch = last && first && pts.length > 1 ? last.y - first.y : 0, wk = pts.length > 1 ? Math.max(1, Math.round((last.x - first.x) / 6048e5)) : 0;
  const better = PROG.metric === 'pace' ? ch < 0 : ch > 0;
  const showV = v => PROG.metric === 'pace' ? mmss(v * 60) : PROG.metric === 'sec' ? mmss(v) : PROG.metric === 'vol' ? L.fmtThousands(v) : fmt(+v.toFixed(1));
  let table = '';
  if (['barbell', 'rack', 'machine'].includes(e.logType)) {
    const best = {}; for (const h of D.historyOf(PROG.ex)) for (const x of h.sets.filter(L.isReal)) { const k = fmt(x.kg), r = L.setReps(x, e); if (!best[k] || r > best[k].r) best[k] = {kg: +x.kg, r, date: h.w.date}; }
    const rows = Object.values(best).sort((a, b) => b.kg - a.kg).slice(0, 8);
    table = `<div class="sec"><h5>Best reps at each weight</h5><span>${esc(e.name.toLowerCase())}</span></div><div class="card list"><table><tr><th>Weight</th><th class="r">Best reps</th><th class="r">Est. 1RM</th><th class="r">When</th></tr>${rows.map(r => `<tr><td>${kgs(r.kg)}</td><td class="r">${r.r}</td><td class="r">${fmt(L.roundTo(L.e1rm(r.kg, r.r, D.settings().formula), D.settings().steps.round))} kg</td><td class="r">${dShort(r.date)}</td></tr>`).join('')}</table></div>`;
  }
  const sameMuscle = [...new Set(ws.slice(0, 30).flatMap(w => w.items.map(i => i.exId)))].filter(id => id !== PROG.ex && exOf(id).primary === e.primary && metricsFor(exOf(id)) === ms).slice(0, 3);
  return `<div class="hd"><div><p>${PROG.range === '12w' ? '12 weeks' : PROG.range === '6m' ? '6 months' : 'All time'}</p><h3 class="pt">Progress</h3></div></div>
    <button class="card row" style="margin-top:14px;padding:12px 16px;border-bottom:1px solid var(--edge)" data-act="library" data-m="progress"><span class="grow"><b style="font-size:17px">${esc(e.name)}</b></span>${ic('down')}</button>
    ${ms.length > 1 ? `<div class="seg wide" style="margin-top:10px" role="radiogroup">${ms.map(([k, l]) => `<button class="${PROG.metric === k ? 'on' : ''}" data-act="pmetric" data-v="${k}" role="radio" aria-checked="${PROG.metric === k}">${l}</button>`).join('')}</div>` : ''}
    <div class="card" style="margin-top:10px;padding:16px">
      ${last ? `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><b class="serif" style="font-size:60px;line-height:1">${showV(last.y)}</b><span style="font-weight:700;color:var(--soft)">${UNIT[PROG.metric]}</span>${pts.length > 1 && ch ? `<span class="tag ${better ? '' : 'w'}" style="margin-left:auto">${PROG.metric === 'pace' ? (ch < 0 ? '−' : '+') + mmss(Math.abs(ch) * 60) : signed(+ch.toFixed(1)) + ' ' + UNIT[PROG.metric]} in ${wk} wk</span>` : ''}</div>
      ${pts.length > 1 ? lineChart(pts, {label: `${e.name}, ${((ms.find(m => m[0] === PROG.metric) || [])[1] || '').toLowerCase()}`, dashed: cmp}) + axisLabels(pts[0].x, last.x) : `<p class="lede">One session so far. The line starts with the second.</p>`}
      <div class="legend"><span><i style="background:var(--ok)"></i>personal record</span>${cmp && cmp.length > 1 ? `<span><i style="background:var(--soft)"></i>${esc(exOf(PROG.cmp).name)} (dashed)</span>` : ''}</div>` : '<p class="lede">No data for this measure yet.</p>'}
    </div>
    <div class="chips"><button class="chip" data-act="library" data-m="compare">${ic('plus', 'xs')} Compare</button>${PROG.cmp ? `<button class="chip on" data-act="pcmp" data-id="">${esc(exOf(PROG.cmp).name)} ${ic('x', 'xs')}</button>` : sameMuscle.map(id => `<button class="chip" data-act="pcmp" data-id="${esc(id)}">${esc(exOf(id).name)}</button>`).join('')}</div>
    <div class="seg" style="margin-top:10px;width:max-content">${[['12w', '12 wk'], ['6m', '6 mo'], ['all', 'All']].map(([k, l]) => `<button class="${PROG.range === k ? 'on' : ''}" data-act="prange" data-v="${k}">${l}</button>`).join('')}</div>
    ${table}`;
}};
A.pmetric = d => { PROG.metric = d.v; render(); };
A.prange = d => { PROG.range = d.v; render(); };
A.pcmp = d => { PROG.cmp = d.id || null; render(); };
function emptyCard(body, n) { return `<div class="card emptyc"><div class="et">Log 2 workouts to see this.</div><p class="lede">${body}</p><div class="prog2"><i class="${n > 0 ? 'y' : ''}"></i><i class="${n > 1 ? 'y' : ''}"></i><span>${n} of 2 workouts</span></div>${D.session() ? '' : `<div style="display:flex;margin-top:14px"><button class="btn2" data-act="startSheet">${ic('play', 'sm')}Start a workout</button></div>`}</div>`; }
function sampleProgress() {
  const pts = [62, 64, 64, 66, 68, 66, 70, 72, 72, 75, 77.5, 80, 82.5].map((y, i) => ({x: i * 6048e5, y, pr: [3, 6, 9, 11, 12].includes(i)}));
  return `<div class="card" style="margin-top:14px;padding:12px 16px"><div class="lbl">Exercise</div><b style="font-size:17px;font-weight:800">Bench press</b></div><div class="seg wide" style="margin-top:10px"><button class="on">Max weight</button><button>Volume</button><button>Est. 1RM</button><button>Reps</button></div><div class="card" style="margin-top:10px;padding:16px"><b class="serif" style="font-size:60px;line-height:1">82.5</b>${lineChart(pts, {label: 'preview'})}</div><div class="sec"><h5>Best reps at each weight</h5></div><div class="card list"><table><tr><th>Weight</th><th class="r">Best reps</th><th class="r">Est. 1RM</th></tr><tr><td>82.5 kg</td><td class="r">6</td><td class="r">99 kg</td></tr><tr><td>80 kg</td><td class="r">8</td><td class="r">101 kg</td></tr><tr><td>75 kg</td><td class="r">10</td><td class="r">100 kg</td></tr></table></div>`;
}

/* ---------- Stats ---------- */
const STATS = {off: 0};
let CALC = {kg: 100, reps: 5};
VIEWS.stats = {dock: true, render() {
  const ws = D.workouts(), st = D.settings();
  const wk = L.addDays(L.weekStartOf(today(), st.weekStart), -7 * STATS.off), end = L.addDays(wk, 6);
  const range = `${L.parseDate(wk).getDate()}${L.parseDate(wk).getMonth() !== L.parseDate(end).getMonth() ? ' ' + MONL[L.parseDate(wk).getMonth()] : ''} to ${L.parseDate(end).getDate()} ${MONL[L.parseDate(end).getMonth()]}`;
  if (ws.length < 2) return `<div class="hd"><div><p>${range}, ${ws.length ? '1 workout so far' : 'no workouts yet'}</p><h3 class="pt">Stats</h3></div></div><div class="ghostw"><div class="ghost" aria-hidden="true">${statsTop([], st, true)}</div>${emptyCard('Then you see sessions against your target, sets per muscle against your ranges, the calendar and your training trends. Below is a preview.', ws.length)}</div>${calcCard(st)}<p class="lede" style="margin:8px 4px 0">The calculator works from day one.</p>`;
  const thisW = L.weekWorkouts(ws, wk);
  return `<div class="hd"><div><p>${range}</p><h3 class="pt">Stats</h3></div><div class="rbs"><button class="rb" data-act="sweek" data-v="1" aria-label="Previous week">${ic('back', 'sm')}</button><button class="rb" data-act="sweek" data-v="-1" aria-label="Next week" ${STATS.off ? '' : 'disabled style="opacity:.35"'}>${ic('chev', 'sm')}</button></div></div>
    ${statsTop(thisW, st)}${balance(L.muscleSets(thisW, exOf))}${trends(ws, st)}${calendar(ws, st)}${calcCard(st)}`;
}};
function statsTop(thisW, st, sample) {
  const sum = thisW.reduce((a, w) => { const s = L.workoutSummary(w, exOf); a.sets += s.sets; a.vol += s.vol; return a; }, {sets: 0, vol: 0});
  const ms = sample ? {chest: 12, back: 6, shoulders: 9, quads: 8, hamstrings: 3, biceps: 7, triceps: 15, glutes: 4, calves: 6} : L.muscleSets(thisW, exOf);
  const n = sample ? 3 : thisW.length;
  return `<div class="stat3"><div class="card"><div class="lbl">Sessions</div><b class="serif">${n}<small> / ${st.weeklyTarget}</small></b></div><div class="card"><div class="lbl">Sets</div><b class="serif">${sample ? 41 : sum.sets}</b></div><div class="card"><div class="lbl">Volume</div><b class="serif">${sample ? '17.9<small> t</small>' : tons(sum.vol)}</b></div></div>
    <div class="sec"><h5>Muscle volume</h5><button data-act="go" data-v="ranges">edit ranges</button></div><div class="card list">${MUSCLE_ORDER.filter(m => st.ranges[m] || ms[m]).map(m => mrow(m, ms[m] || 0, st.ranges[m])).join('')}</div>`;
}
const CAL = {mode: 'weeks', m: 0};
function calendar(ws, st) {
  const t = today(), by = {};
  for (const w of ws) by[w.date] = (by[w.date] || 0) + L.workoutSummary(w, exOf).sets;
  const lvl = n => n >= 12 ? 'b' : n ? 'a' : '';
  const seg = `<div class="seg" style="width:max-content" role="radiogroup">${[['weeks', '12 weeks'], ['month', 'Month']].map(([k, l]) => `<button class="${CAL.mode === k ? 'on' : ''}" data-act="calMode" data-v="${k}" role="radio" aria-checked="${CAL.mode === k}">${l}</button>`).join('')}</div>`;
  if (CAL.mode === 'month') {
    const base = L.parseDate(t); base.setDate(1); base.setMonth(base.getMonth() - CAL.m);
    const first = L.localDate(base), y = base.getFullYear(), mo = base.getMonth(), days = new Date(y, mo + 1, 0).getDate();
    const lead = (base.getDay() - st.weekStart + 7) % 7, letters = [0, 1, 2, 3, 4, 5, 6].map(i => I18N.wdLetter((st.weekStart + i) % 7));
    let cells = letters.map(l => `<span class="wd">${l}</span>`).join('') + '<span></span>'.repeat(lead), n = 0;
    for (let d = 1; d <= days; d++) { const ds = L.addDays(first, d - 1), k = by[ds] || 0; if (k) n++; cells += `<button class="${lvl(k)} ${ds === t ? 't' : ''} ${ds > t ? 'f' : ''}" data-act="calDay" data-d="${ds}" aria-label="${dLong(ds)}${k ? ', ' + plural(k, 'set') : ', no workout'}">${d}</button>`; }
    return `<div class="sec"><h5>Training calendar</h5><span>${plural(n, 'training day')}</span></div><div class="card" style="padding:14px 16px"><div class="hd">${seg}<div class="rbs"><button class="rb" data-act="calMonth" data-v="1" aria-label="Previous month">${ic('back', 'sm')}</button><button class="rb" data-act="calMonth" data-v="-1" aria-label="Next month" ${CAL.m ? '' : 'disabled style="opacity:.35"'}>${ic('chev', 'sm')}</button></div></div><div class="lbl" style="margin-top:12px">${MONL[mo]} ${y}</div><div class="mgrid">${cells}</div><p class="lede">Tap a day to see what you did.</p></div>`;
  }
  const endWk = L.weekStartOf(t, st.weekStart), start = L.addDays(endWk, -77);
  let cells = '', n = 0;
  for (let i = 0; i < 84; i++) { const d = L.addDays(start, i), k = by[d] || 0; if (k && d <= t) n++; cells += `<button class="${lvl(k)} ${d === t ? 't' : ''} ${d > t ? 'f' : ''}" data-act="calDay" data-d="${d}" aria-label="${dLong(d)}${k ? ', ' + plural(k, 'set') : ', no workout'}" ${d > t ? 'disabled' : ''}></button>`; }
  return `<div class="sec"><h5>Training calendar</h5><span>last 12 weeks, ${plural(n, 'day')}</span></div><div class="card" style="padding:14px 16px">${seg}<div class="heat" style="margin-top:12px">${cells}</div><div style="display:flex;gap:12px;font-size:11px;font-weight:700;color:var(--soft);margin-top:10px"><span>each column is a week; tap a day</span><span style="margin-left:auto">lighter = under 12 sets</span></div></div>`;
}
A.calMode = d => { CAL.mode = d.v; render(); };
A.calMonth = d => { CAL.m = Math.max(0, CAL.m + +d.v); render(); };
A.calDay = d => openSheet('day', {d: d.d});
SHEETS.day = {title: 'Day', render(sp) {
  const ws = D.workouts().filter(w => w.date === sp.d), st = D.settings();
  const wkOff = Math.round(L.daysBetween(L.weekStartOf(sp.d, st.weekStart), L.weekStartOf(today(), st.weekStart)) / 7);
  return `<div class="hd"><h3>${esc(dLong(sp.d))}</h3></div>${ws.length ? `<div class="card list" style="margin-top:12px">${ws.map(w => { const x = L.workoutSummary(w, exOf); return `<button class="row" data-act="dayOpen" data-id="${esc(w.id)}">${dateTile(w.date)}<span class="grow"><b>${esc(w.title)}</b><small>${x.min ? x.min + ' min, ' : ''}${plural(x.sets, 'set')}, ${L.fmtThousands(x.vol)} kg</small></span>${ic('chev', 'sm')}</button>`; }).join('')}</div>` : `<p class="lede" style="margin-top:10px">No workout logged on this day.</p>`}
    <div class="btns" style="margin-top:14px"><button class="btn2" data-act="dayWeek" data-v="${wkOff}">See this week in Stats</button></div>`;
}};
A.dayOpen = d => { S.sheet = null; nav('detail', {id: d.id}); };
A.dayWeek = d => { STATS.off = Math.max(0, +d.v); closeSheet(); setTimeout(() => { render(); window.scrollTo({top: 0, behavior: 'smooth'}); }, 30); };

/* ---------- D16: muscle balance ---------- */
function balance(ms) {
  const sum = ks => ks.reduce((a, k) => a + (ms[k] || 0), 0);
  const rows = [['Push', sum(['chest', 'shoulders', 'triceps']), 'Pull', sum(['back', 'biceps', 'traps'])], ['Upper', sum(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps']), 'Lower', sum(['quads', 'hamstrings', 'glutes', 'calves'])]];
  if (!rows.some(r => r[1] + r[3])) return '';
  return `<div class="sec"><h5>Balance</h5><span>sets this week</span></div><div class="card list">${rows.map(([a, x, b, y]) => { const tot = x + y || 1, p = x / tot, even = Math.abs(x - y) <= Math.max(2, tot * .2); return `<div class="bal"><span>${a} <b>${fmt(Math.round(x * 2) / 2)}</b></span><div class="baltr" role="img" aria-label="${a} ${fmt(x)}, ${b} ${fmt(y)}"><i style="width:${p * 100}%"></i></div><span><b>${fmt(Math.round(y * 2) / 2)}</b> ${b}</span><small class="${even ? 'okm' : 'unm'}">${even ? 'even' : x > y ? 'more ' + a.toLowerCase() : 'more ' + b.toLowerCase()}</small></div>`; }).join('')}</div>`;
}

/* ---------- D14: trends instead of bodyweight ---------- */
const TREND = {k: 'vol'};
function barChart(vals, {fmtv = v => fmt(v), target = null, label = 'Chart'} = {}) {
  const W = 310, H = 140, n = vals.length, mx = Math.max(target || 0, ...vals.map(v => v.v), 1), bw = (W - 20) / n;
  const Y = v => H - 20 - v / mx * (H - 40);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  vals.forEach((v, i) => { const x = 10 + i * bw + bw * .18, h = H - 20 - Y(v.v); svg += `<rect x="${x.toFixed(1)}" y="${Y(v.v).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${Math.max(h, v.v ? 2 : 0).toFixed(1)}" rx="3" fill="${i === n - 1 ? 'var(--ink)' : 'var(--soft)'}" opacity="${i === n - 1 ? 1 : .45}"/>`; });
  if (target) svg += `<line x1="6" x2="${W - 6}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--ok)" stroke-width="2" stroke-dasharray="5 5"/><text x="${W - 6}" y="${Y(target) - 4}" text-anchor="end" font-size="9" font-weight="700" fill="var(--ok)">target ${fmtv(target)}</text>`;
  const last = vals[n - 1]; svg += `<text x="${10 + (n - 1) * bw + bw / 2}" y="${Y(last.v) - 6}" text-anchor="middle" font-size="10" font-weight="800" fill="var(--ink)">${fmtv(last.v)}</text>`;
  return svg + `</svg><div class="axis"><span>${esc(vals[0].lbl)}</span><span>${esc(last.lbl)}</span></div>`;
}
function topLifts(ws) {
  const want = ['bench-press', 'back-squat', 'deadlift', 'overhead-press'].filter(id => D.historyOf(id).length);
  if (want.length < 4) { const cnt = {}; ws.slice(0, 60).forEach(w => w.items.forEach(it => { const e = exOf(it.exId); if (['barbell', 'rack', 'machine'].includes(e.logType) && !want.includes(it.exId)) cnt[it.exId] = (cnt[it.exId] || 0) + 1; })); want.push(...Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 4 - want.length)); }
  const cut = Date.now() - 84 * 864e5;
  return want.map(id => { const all = seriesOf(id, 'e1rm'), pts = all.filter(p => p.x >= cut); const use = pts.length ? pts : all.slice(-1); return {id, e: exOf(id), now: use.length ? use[use.length - 1].y : 0, ch: use.length > 1 ? use[use.length - 1].y - use[0].y : 0}; });
}
function trends(ws, st) {
  const cur = L.weekStartOf(today(), st.weekStart), weeks = [];
  for (let i = 11; i >= 0; i--) { const wk = L.addDays(cur, -7 * i); weeks.push({wk, w: L.weekWorkouts(ws, wk), lbl: dShort(wk)}); }
  const chips = `<div class="chips" role="group" aria-label="Trend">${[['vol', 'Volume'], ['sess', 'Sessions'], ['e1rm', 'Top lifts'], ['time', 'Time'], ['prs', 'PRs']].map(([k, l]) => `<button class="chip ${TREND.k === k ? 'on' : ''}" data-act="trend" data-v="${k}" aria-pressed="${TREND.k === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (TREND.k === 'vol') { const v = weeks.map(x => ({v: x.w.reduce((a, w) => a + L.workoutSummary(w, exOf).vol, 0) / 1000, lbl: x.lbl})), avg = v.slice(0, -1).reduce((a, x) => a + x.v, 0) / 11; body = `<p class="lede">Tonnes lifted per week. Average ${fmt(+avg.toFixed(1))} t before this week.</p>${barChart(v, {fmtv: x => fmt(+x.toFixed(1)) + ' t', label: 'Volume per week'})}`; }
  if (TREND.k === 'sess') { const v = weeks.map(x => ({v: x.w.length, lbl: x.lbl})), hit = v.filter(x => x.v >= st.weeklyTarget).length; body = `<p class="lede">Sessions per week against your target of ${st.weeklyTarget}. On target ${hit} of 12 weeks.</p>${barChart(v, {target: st.weeklyTarget, label: 'Sessions per week'})}`; }
  if (TREND.k === 'time') { const mins = weeks.map(x => x.w.reduce((a, w) => a + L.workoutSummary(w, exOf).min, 0)), sess = weeks.reduce((a, x) => a + x.w.filter(w => L.workoutSummary(w, exOf).min).length, 0); body = `<p class="lede">Minutes trained per week. Average session ${sess ? Math.round(mins.reduce((a, b) => a + b, 0) / sess) : 0} min.</p>${barChart(mins.map((v, i) => ({v, lbl: weeks[i].lbl})), {fmtv: x => Math.round(x) + ' min', label: 'Time per week'})}`; }
  if (TREND.k === 'prs') { const prs = D.prs(), months = []; const d0 = L.parseDate(today()); for (let i = 5; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push({key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, lbl: MON[d.getMonth()], v: 0}); }
    for (const w of ws) { const m = months.find(x => w.date.startsWith(x.key)); if (m) for (const it of w.items) for (const x of it.sets) if (prs.has(x.id)) m.v++; }
    body = `<p class="lede">Personal records per month, real sets only.</p>${barChart(months, {label: 'PRs per month'})}`; }
  if (TREND.k === 'e1rm') { const L4 = topLifts(ws); body = L4.length ? `<p class="lede">Estimated 1RM now, and the change over 12 weeks. An estimate, never a PR.</p><div class="list" style="padding:0">${L4.map(x => `<button class="row" data-act="trendLift" data-id="${esc(x.id)}"><span class="grow"><b>${esc(x.e.name)}</b><small>est. 1RM</small></span><b class="serif" style="font-size:30px;font-weight:400">${fmt(L.roundTo(x.now, st.steps.round))}<small style="font-family:var(--font-body);font-size:12px;color:var(--soft)"> kg</small></b>${x.ch ? `<span class="tag ${x.ch > 0 ? '' : 'w'}" style="margin-left:8px">${signed(+x.ch.toFixed(1))}</span>` : ''}</button>`).join('')}</div>` : '<p class="lede">Log a few weighted sets to see your top lifts.</p>'; }
  return `<div class="sec"><h5>Trends</h5><span>last 12 weeks</span></div><div class="card" style="padding:14px 16px">${chips}${body}</div>`;
}
A.trend = d => { TREND.k = d.v; render(); };
A.trendLift = d => { PROG.ex = d.id; PROG.metric = 'e1rm'; nav('progress'); };

/* ---------- D15: bodyweight lives in Progress ---------- */
function bwProgress() {
  const all = D.weighins(), cut = PROG.range === '12w' ? L.addDays(today(), -84) : PROG.range === '6m' ? L.addDays(today(), -183) : '0';
  let wi = all.filter(x => x.date >= cut); if (wi.length < 2) wi = all;
  const pts = wi.map(x => ({x: L.parseDate(x.date).getTime(), y: x.kg})), l = wi[wi.length - 1], ch = wi.length > 1 ? +(l.kg - wi[0].kg).toFixed(1) : 0;
  return `<div class="hd"><div><p>${PROG.range === '12w' ? '12 weeks' : PROG.range === '6m' ? '6 months' : 'All time'}</p><h3 class="pt">Progress</h3></div></div>
    <button class="card row" style="margin-top:14px;padding:12px 16px;border-bottom:1px solid var(--edge)" data-act="library" data-m="progress"><span class="grow"><b style="font-size:17px" data-body>Bodyweight</b></span>${ic('down')}</button>
    <div class="card" style="margin-top:10px;padding:16px">${l ? `<div style="display:flex;align-items:baseline;gap:8px"><b class="serif" style="font-size:60px;line-height:1">${fmt(l.kg.toFixed(1))}</b><span style="font-weight:700;color:var(--soft)">kg</span>${ch ? `<span class="tag w" style="margin-left:auto">${signed(ch)} kg in ${Math.max(1, Math.round((pts[pts.length - 1].x - pts[0].x) / 6048e5))} wk</span>` : ''}</div>
    ${pts.length > 1 ? lineChart(pts, {label: `Bodyweight from ${wi[0].kg} to ${l.kg} kg`}) + axisLabels(pts[0].x, pts[pts.length - 1].x) : '<p class="lede">The line starts with your second weekly weigh-in.</p>'}` : '<p class="lede">No weigh-ins yet.</p>'}
    <p class="lede" style="margin-top:10px">Logged once a week from Home. Pull-ups, dips and push-ups use the latest weigh-in.</p></div>
    <div class="seg" style="margin-top:10px;width:max-content">${[['12w', '12 wk'], ['6m', '6 mo'], ['all', 'All']].map(([k, lb]) => `<button class="${PROG.range === k ? 'on' : ''}" data-act="prange" data-v="${k}">${lb}</button>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><button class="btn2" data-act="weighSheet">${ic('scale', 'sm')}Log a weigh-in</button></div>`;
}
A.progBw = () => { PROG.ex = '__bw'; PROG.cmp = null; if (S.sheet) { S.sheet = null; } if (S.view === 'progress') { if (history.state && history.state.s) history.back(); setTimeout(render, 30); } else nav('progress'); };
function calcCard(st) {
  const e1 = L.e1rm(CALC.kg, CALC.reps, st.formula), r = v => fmt(L.roundTo(v, st.steps.round));
  return `<div class="sec"><h5>1RM calculator</h5><span>${st.formula === 'brzycki' ? 'Brzycki' : 'Epley'}</span></div><div class="card" style="padding:14px 16px"><div class="steps" style="margin-top:0">${stepper('Weight', fmt(CALC.kg), 'calc', 'data-f="kg"')}${stepper('Reps', CALC.reps, 'calc', 'data-f="reps"')}</div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px"><span class="lbl">Estimated 1RM</span><b class="serif" style="font-size:40px;margin-left:auto">${r(e1)} kg</b></div>
    <table style="margin-top:4px"><tr><th>%</th>${[90, 80, 70, 60].map(p => `<th class="r">${p}</th>`).join('')}</tr><tr><td>kg</td>${[.9, .8, .7, .6].map(p => `<td class="r">${r(e1 * p)}</td>`).join('')}</tr></table><p class="lede">An estimate (est.), never a PR.</p></div>`;
}
STEP.calc = (dir, ds, n) => { if (ds.f === 'kg') CALC.kg = Math.max(1, +(CALC.kg + dir * (n > 8 ? 10 : 2.5)).toFixed(2)); else CALC.reps = Math.max(1, Math.min(20, CALC.reps + dir)); render(); };
A.sweek = d => { STATS.off = Math.max(0, STATS.off + +d.v); render(); };

/* ---------- Settings ---------- */
let INSTALL = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL = e; if (S.view === 'settings') render(); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
VIEWS.settings = {dock: false, render() {
  const st = D.settings(), meta = D.meta();
  const RW = (icn, t, sub, v, act) => `<button class="row" ${act}><span class="addb">${ic(icn, 'sm')}</span><span class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${valc(v)}</button>`;
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button></div><h3 class="ptl">Settings</h3>
  <div class="sec"><h5>You</h5></div><div class="card list">${RW('scale', '<span data-body>Bodyweight</span>', 'Weekly weigh-in; used for pull-ups, dips, push-ups', kgs(D.latestBw()), 'data-act="weighSheet"')}${RW('user', 'Name on Home', '', esc(st.name || 'not set'), 'data-act="textSheet" data-k="name"')}</div>
  <div class="sec"><h5>Appearance</h5></div><div class="card list">${sr('Theme', segb('theme', [['light', `${ic('sun', 'sm')}Light`], ['dark', `${ic('moon', 'sm')}Dark`], ['device', `${ic('phone', 'sm')}Device`]], st.theme))}${sr('Reduce glass', tog('reduceGlass', st.reduceGlass, 'Reduce glass'), 'Solid cards instead of frosted glass. Also turns on by itself when the battery is low.')}${sr('Text size', valc(st.textSize === 'large' ? 'Large' : 'Default'), '', 'data-act="pick" data-k="textSize"')}${sr('Language', segb('lang', [['en', 'English'], ['zh', '简体中文']], st.lang))}</div>
  <div class="sec"><h5>Units and weights</h5></div><div class="card list">${sr('Units', '<span class="val">kg, km</span>', 'lbs and miles come later')}${RW('ruler', 'Weight steps', 'Barbell / dumbbells / stacks', `${fmt(st.steps.barbell)} / ${fmt(st.steps.dumbbell)} / ${fmt(st.steps.stack)}`, 'data-act="go" data-v="steps"')}${RW('bar', 'Equipment', 'Bars, plates, dumbbells, machines, bands', 'Edit', 'data-act="go" data-v="equip"')}</div>
  <div class="sec"><h5>Logging</h5></div><div class="card list">${sr("Fill in last time's numbers", tog('fillLast', st.fillLast))}${sr('Warm-up sets', valc(st.warmups === 'off' ? 'Off' : 'Ask'), 'Shows "Add warm-ups": bar, 50, 70, 85%', 'data-act="pick" data-k="warmups"')}${sr('Drop sets', valc('−' + st.drop + '%'), 'Each drop takes this much off, rounded to the step', 'data-act="pick" data-k="drop"')}${sr('RPE', tog('rpe', st.rpe), 'Rate each set 6 to 10 (optional)')}${sr('PR alerts', tog('prAlerts', st.prAlerts))}${sr('Haptics', tog('haptics', st.haptics), 'Tick on swipe, buzz on Log set')}${sr('Keep screen awake', tog('keepAwake', st.keepAwake), 'During a workout')}</div>
  <div class="sec"><h5>Rest timer</h5></div><div class="card list">${sr('Default rest', valc(mmss(st.rest)), '', 'data-act="pick" data-k="rest"')}${sr('Different rest per exercise', tog('restPerExercise', st.restPerExercise), 'Big lifts 2:30, compounds 2:00, isolation 1:30, bodyweight 1:00')}${sr('Sound', tog('sound', st.sound))}${sr('Vibration', tog('vibrate', st.vibrate))}</div>
  <div class="sec"><h5>Training</h5></div><div class="card list">${sr('Weekly target', valc(plural(st.weeklyTarget, 'session')), '', 'data-act="pick" data-k="weeklyTarget"')}${sr('Week starts on', valc(DAYL[st.weekStart]), '', 'data-act="pick" data-k="weekStart"')}${sr('Muscle volume ranges', valc('MEV / MRV'), '', 'data-act="go" data-v="ranges"')}${sr('1RM formula', segb('formula', [['epley', 'Epley'], ['brzycki', 'Brzycki']], st.formula))}</div>
  <div class="sec"><h5>Reminders</h5></div><div class="card list">${sr('Backup reminder', tog('backupReminder', st.backupReminder), 'Every 7 days, on Home')}</div>
  <div class="sec"><h5>Sync and data</h5></div><div class="card list">${sr('Cloud sync', '<span class="val">Not set up</span>', 'Arrives with Cloudflare. Until then everything stays on this phone.')}${sr('Export backup', ic('dl', 'sm'), meta.lastBackup ? 'Last: ' + dShort(L.localDate(new Date(meta.lastBackup))) + ', everything, one file' : 'Everything, as one file', 'data-act="exportNow"')}${sr('Import backup', ic('ul', 'sm'), 'From LIFT 5 or a LIFT 2 backup', 'data-act="go" data-v="import1"')}${sr('<span style="color:var(--over)">Clear all data</span>', '', 'Asks twice, saves a backup first', 'data-act="clearAll"')}</div>
  <div class="sec"><h5>App</h5></div><div class="card list">${INSTALL && !standalone() ? sr('Install LIFT', ic('install', 'sm'), 'Add to your home screen', 'data-act="install"') : ''}${sr('About', '<span class="val">v2.0</span>', `${L.EX.length} built-in exercises, data stays on this phone`)}</div>`;
}};
A.toggle = d => { const st = D.settings(); D.saveSettings({[d.k]: !st[d.k]}); applyTheme(); if (d.k === 'keepAwake') { st.keepAwake ? unwake() : wake(); } render(); };
A.lang = d => { if (d.v === D.settings().lang) return; D.saveSettings({lang: d.v}); I18N.setLang(d.v); render(); };
A.theme = d => { D.saveSettings({theme: d.v}); applyTheme(); render(); };
A.formula = d => { D.saveSettings({formula: d.v}); render(); };
A.install = async () => { if (!INSTALL) return; INSTALL.prompt(); try { await INSTALL.userChoice; } catch (e) {} INSTALL = null; render(); };
const PICKS = {
  rest: ['Default rest', [30, 45, 60, 90, 120, 150, 180, 240, 300].map(v => [v, mmss(v)])],
  weeklyTarget: ['Weekly target', [1, 2, 3, 4, 5, 6, 7].map(v => [v, plural(v, 'session')])],
  weekStart: ['Week starts on', [[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']]],
  drop: ['Drop set size', [10, 15, 20, 25, 30].map(v => [v, '−' + v + '%'])],
  warmups: ['Warm-up sets', [['ask', 'Ask (show the chip)'], ['off', 'Off']]],
  textSize: ['Text size', [['default', 'Default'], ['large', 'Large']]],
  feel: ['How it felt', [['Easy', 'Easy'], ['Moderate', 'Moderate'], ['Hard', 'Hard'], ['Max', 'All out']]],
};
A.pick = d => openSheet('pick', {key: d.k});
SHEETS.pick = {title: 'Choose', render(sp) {
  const [title, opts] = PICKS[sp.key]; const st = D.settings();
  let cur = st[sp.key];
  if (sp.key === 'feel') { const s = D.session(), it = s && curItem(s), i = it ? curIdx(it) : -1; cur = i >= 0 ? it.sets[i].feel : null; }
  return `<div class="hd"><h3>${title}</h3></div><div class="card list" style="margin-top:12px">${opts.map(([v, l]) => `<button class="row" data-act="pickSet" data-v="${esc(v)}"><span class="grow"><b class="t14">${esc(l)}</b></span>${String(v) === String(cur) ? `<span class="okm">${ic('check', 'sm')}</span>` : ''}</button>`).join('')}</div>`;
}};
A.pickSet = d => {
  const k = S.sp.key;
  if (k === 'feel') { withCur(c => { c.feel = d.v; }, {redraw: false}); closeSheet(); setTimeout(render, 30); return; }
  const v = ['warmups', 'textSize'].includes(k) ? d.v : +d.v;
  D.saveSettings({[k]: v}); applyTheme(); closeSheet(); setTimeout(render, 30);
};
A.textSheet = d => openSheet('text', {key: d.k});
SHEETS.text = {title: 'Edit', render(sp) { const st = D.settings(); return `<div class="hd"><h3>Name on Home</h3></div><label class="card fld"><small>Name</small><input data-in="textv" value="${esc(st[sp.key] || '')}" maxlength="30" autofocus autocomplete="given-name"></label><button class="btn" style="margin-top:14px" data-act="textSave">Save</button>`; }};
let TEXTV = null;
IN.textv = v => { TEXTV = v; };
A.textSave = () => { if (TEXTV != null) D.saveSettings({[S.sp.key]: TEXTV.trim().slice(0, 30)}); TEXTV = null; closeSheet(); setTimeout(render, 30); };
SHEETS.confirm = {title: 'Confirm', render(sp) { return `<div class="hd"><h3>${esc(sp.title)}</h3></div><p class="lede" style="font-size:14px">${esc(sp.body)}</p><button class="btn" style="margin-top:16px;${sp.danger ? 'background:var(--over);color:#fff' : ''}" data-act="${esc(sp.act)}">${esc(sp.ok)}</button><div class="btns"><button class="btn2" data-act="closeSheet">Cancel</button></div>`; }};
A.clearAll = () => { exportBackup(); openSheet('confirm', {title: 'Clear all data?', body: 'A backup file was just saved. This deletes every workout, template, custom exercise and setting in LIFT on this phone. Old LIFT 5 data is not touched.', ok: 'Yes, continue', act: 'clear2', danger: 1}); };
A.clear2 = () => openSheet('confirm', {title: 'Last check', body: 'There is no undo. Delete everything now?', ok: 'Delete everything', act: 'clear3', danger: 1});
A.clear3 = () => { Store.clearAll(); D._st = null; location.replace(location.pathname); };
function exportBackup() {
  const d = Store.exportAll();
  download(`lift-backup-${today()}.json`, JSON.stringify(d, null, 1));
  D.setMeta({lastBackup: Date.now()});
  toast('Backup saved to Downloads');
  if (S.view === 'log' || S.view === 'settings') setTimeout(render, 50);
}

/* ---------- Weight steps ---------- */
const STEPOPTS = {barbell: [.25, .5, 1, 1.25, 2, 2.5, 5], dumbbell: [.5, 1, 1.25, 2, 2.5, 5], stack: [1, 2.5, 5, 10], addon: [.25, .5, 1, 1.25, 2.5], machine: [1, 2.5, 5, 10], bw: [.25, .5, 1, 1.25, 2.5, 5], round: [.25, .5, 1, 2.5]};
const STEPLBL = {barbell: ['Barbell', 'Smallest jump on the bar, both sides together'], dumbbell: ['Dumbbells', 'Gap between dumbbells on your rack'], stack: ['Weight stacks', 'Each plate on a cable or machine stack'], addon: ['Stack add-on', 'Small magnet or add-on weight'], machine: ['Plate-loaded machines', 'Leg press, hack squat, etc.'], bw: ['Bodyweight extras', 'Belt plates or vest steps'], round: ['Rounding', 'How estimates and % tables round']};
VIEWS.steps = {dock: false, render() {
  const st = D.settings();
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button></div><h3 class="ptl">Weight steps</h3><p class="lede">How much each tap of − / + adds, for each kind of equipment.</p>
    ${Object.keys(STEPOPTS).map(k => `<div class="card stepc"><div class="stephd"><div><b>${STEPLBL[k][0]}</b><small>${STEPLBL[k][1]}</small></div><span class="now">${fmt(st.steps[k])} kg</span></div><div class="chipz">${STEPOPTS[k].map(v => `<button data-act="stepSet" data-k="${k}" data-v="${v}" class="${v === st.steps[k] ? 'on' : ''}">${fmt(v)}</button>`).join('')}</div></div>`).join('')}
    <div class="card list" style="margin-top:10px">${sr('Micro plates (0.5 and 0.25 kg)', tog('micro', st.micro), 'Lets the barbell move in 0.5 kg or 1 kg jumps')}</div>`;
}};
A.stepSet = d => {
  const st = D.settings(), steps = Object.assign({}, st.steps, {[d.k]: +d.v}), patch = {steps};
  if (d.k === 'barbell' && +d.v < 2.5) patch.micro = true;
  D.saveSettings(patch); render();
};

/* ---------- Equipment ---------- */
VIEWS.equip = {dock: false, render() {
  const st = D.settings();
  const RW = (icn, t, sub, v, act) => `<button class="row" ${act}><span class="addb">${ic(icn, 'sm')}</span><span class="grow"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${valc(esc(v))}</button>`;
  const avail = new Set(L.plateSet(st));
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button></div><h3 class="ptl">Equipment</h3><p class="lede">What your gym has and what it weighs. Change it here and every exercise using it updates.</p>
  <div class="sec"><h5>Bars</h5><button data-act="eqEdit" data-t="bar" data-id="new">+ add bar</button></div><div class="card list">${st.bars.map(b => RW('bar', b.name, b.note || (b.id === 'olympic' ? 'Default for bench, squat, deadlift' : ''), kgs(b.kg), `data-act="eqEdit" data-t="bar" data-id="${esc(b.id)}"`)).join('')}</div>
  <div class="sec"><h5>Plates</h5><span>tap to turn off</span></div><div class="card" style="padding:12px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;justify-items:center">${L.ALL_PLATES.map(k => `<button class="plate ${[5, 1.25, .5, .25].includes(k) ? 'lt' : [15, 10, 1.5, 1].includes(k) ? 'ink' : ''} ${avail.has(k) ? '' : 'off'}" style="background:${L.PLATE_COLORS[k]};border-radius:50%" data-act="plateTog" data-k="${k}" aria-pressed="${avail.has(k)}" aria-label="${fmt(k)} kg plates">${fmt(k)}</button>`).join('')}</div>${!st.micro ? '<p class="lede">0.5 and 0.25 kg need Micro plates on in Weight steps.</p>' : ''}
  <div class="sec"><h5>Dumbbells</h5></div><div class="card list">${RW('db', 'Dumbbell rack', `${fmt(st.dbMin)} to ${fmt(st.dbMax)} kg`, `every ${fmt(st.steps.dumbbell)} kg`, 'data-act="eqEdit" data-t="db" data-id="rack"')}</div>
  <div class="sec"><h5>Kettlebells</h5><span>tap the ones you have</span></div><div class="chipz">${[4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48].map(k => `<button class="${st.kettlebells.includes(k) ? 'on' : ''}" data-act="kbTog" data-k="${k}">${k}</button>`).join('')}</div>
  <div class="sec"><h5>Machines</h5><button data-act="eqEdit" data-t="machine" data-id="new">+ add machine</button></div><div class="card list">${st.machines.map(m => RW(m.kind === 'plates' ? 'sled' : 'stack', m.name, m.kind === 'plates' ? 'Plate-loaded, sled counts' : m.kind === 'assist' ? `Counterweight ${m.min || 5} to ${m.max || 70} kg` : `Stack, ${m.plates || 20} plates of ${fmt(m.step)} kg`, m.kind === 'plates' ? kgs(m.sled || 0) : m.kind === 'assist' ? 'Assist' : 'Stack', `data-act="eqEdit" data-t="machine" data-id="${esc(m.id)}"`)).join('')}</div>
  <div class="sec"><h5>Bands</h5><button data-act="eqEdit" data-t="band" data-id="new">+ add band</button></div><div class="card list">${st.bands.map(b => `<button class="row" data-act="eqEdit" data-t="band" data-id="${esc(b.id)}"><span class="addb" style="color:${esc(b.color)}">${ic('band', 'sm')}</span><span class="grow"><b>${esc(b.name)}</b></span>${valc('≈ ' + kgs(b.kg))}</button>`).join('')}</div>`;
}};
A.plateTog = d => { const st = D.settings(), k = +d.k; if (k < 1 && !st.micro) { toast('Turn on Micro plates in Weight steps first.'); return; } D.saveSettings({plates: Object.assign({}, st.plates, {[k]: !(L.plateSet(st).includes(k))})}); render(); };
A.kbTog = d => { const st = D.settings(), k = +d.k; const ks = st.kettlebells.includes(k) ? st.kettlebells.filter(x => x !== k) : st.kettlebells.concat(k).sort((a, b) => a - b); if (!ks.length) return; D.saveSettings({kettlebells: ks}); render(); };
let EQ = null;
const BANDCOL = ['#f2c230', '#d7263d', '#7a4fd8', '#2a9d5c', '#1e5bd8', '#15161b', '#f08c1e', '#9aa1ad'];
const COLNAME = {'#f2c230': 'Yellow', '#d7263d': 'Red', '#7a4fd8': 'Purple', '#2a9d5c': 'Green', '#1e5bd8': 'Blue', '#15161b': 'Black', '#f08c1e': 'Orange', '#9aa1ad': 'Grey'};
A.eqEdit = d => {
  const st = D.settings();
  if (d.t === 'db') EQ = {t: 'db', min: st.dbMin, max: st.dbMax};
  else { const arr = {bar: st.bars, machine: st.machines, band: st.bands}[d.t]; const ex = arr.find(x => x.id === d.id); EQ = {t: d.t, isNew: !ex, v: ex ? Object.assign({}, ex) : d.t === 'bar' ? {id: Store.uid('bar'), name: 'New bar', kg: 15} : d.t === 'machine' ? {id: Store.uid('m'), name: 'New machine', kind: 'plates', sled: 40, step: 5, plates: 20} : {id: Store.uid('band'), name: 'New band', color: '#1e5bd8', kg: 15}}; }
  openSheet('eq');
};
SHEETS.eq = {title: 'Equipment', render() {
  if (!EQ) return '';
  if (EQ.t === 'db') return `<div class="hd"><h3>Dumbbell rack</h3></div><div class="steps">${stepper('Lightest', fmt(EQ.min), 'eq', 'data-f="min"')}${stepper('Heaviest', fmt(EQ.max), 'eq', 'data-f="max"')}</div><p class="lede">Gap between dumbbells is set in Weight steps (${fmt(D.settings().steps.dumbbell)} kg).</p><button class="btn" style="margin-top:14px" data-act="eqSave">Save</button>`;
  const v = EQ.v, used = EQ.t === 'bar' ? ['olympic', 'womens', 'ez', 'trap', 'smith'].includes(v.id) : EQ.t === 'machine' ? ['stack', 'assist'].includes(v.id) : false;
  let body = `<label class="card fld"><small>Name</small><input data-in="eqname" value="${esc(v.name)}" maxlength="40"></label>`;
  if (EQ.t === 'bar') body += `<div class="card" style="margin-top:12px;padding:14px 16px"><div class="lbl">Weight</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><b class="serif" style="font-size:52px;line-height:1">${fmt(v.kg)} kg</b><div class="pm"><button data-step="eq" data-f="kg" data-dir="-1" aria-label="Lighter">−</button><button data-step="eq" data-f="kg" data-dir="1" aria-label="Heavier">+</button></div></div></div>`;
  if (EQ.t === 'machine') {
    body += `<div class="seg wide" role="radiogroup">${[['plates', 'Plate-loaded'], ['stack', 'Weight stack'], ['assist', 'Assist']].map(([k, l]) => `<button class="${v.kind === k ? 'on' : ''}" data-act="eqF" data-f="kind" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (v.kind === 'plates') body += `<div class="card" style="margin-top:12px;padding:14px 16px"><div class="lbl">Sled / carriage weight</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><b class="serif" style="font-size:52px;line-height:1">${fmt(v.sled || 0)} kg</b><div class="pm"><button data-step="eq" data-f="sled" data-dir="-1" aria-label="Lighter">−</button><button data-step="eq" data-f="sled" data-dir="1" aria-label="Heavier">+</button></div></div><p class="lede">Most sleds are 40 to 70 kg; the label is usually on the carriage. Logged weight = sled + plates.</p></div>`;
    if (v.kind === 'stack') body += `<div class="steps">${stepper('Plates', v.plates || 20, 'eq', 'data-f="plates"')}</div>`;
    if (v.kind === 'assist') body += `<div class="steps">${stepper('From kg', v.min || 5, 'eq', 'data-f="min"')}${stepper('To kg', v.max || 70, 'eq', 'data-f="max"')}</div>`;
    body += `<div class="card list" style="margin-top:10px">${sr('Weight step', segb('eqStep', [2.5, 5, 10].map(x => [x, fmt(x)]), v.step))}</div>`;
    if (v.kind === 'plates') body += `<p class="lede">Plate-loaded exercises pick the machine whose name matches (for example "Leg press"), or set it under the exercise.</p>`;
  }
  if (EQ.t === 'band') body += `<div class="sec"><h5>Colour</h5></div><div class="chipz">${BANDCOL.map(c => `<button aria-label="${COLNAME[c] || c}" aria-pressed="${v.color === c}" data-act="eqF" data-f="color" data-v="${c}" class="${v.color === c ? 'on2' : ''}" style="background:${c};min-width:40px"></button>`).join('')}</div><div class="steps">${stepper('Resistance (kg)', fmt(v.kg), 'eq', 'data-f="kg"')}</div>`;
  return `<div class="hd"><h3>${esc(EQ.isNew ? 'Add ' + EQ.t : v.name)}</h3><button class="btn2" style="flex:0 0 auto;height:40px" data-act="eqSave">Save</button></div>${body}${!EQ.isNew && !used ? `<div class="btns" style="margin-top:14px"><button class="btn2 danger" data-act="eqDel">${ic('trash', 'sm')}Remove</button></div>` : ''}`;
}};
STEP.eq = (dir, ds) => {
  const f = ds.f;
  if (EQ.t === 'db') { const stp = D.settings().steps.dumbbell; EQ[f] = Math.max(.5, +(EQ[f] + dir * stp).toFixed(2)); if (EQ.min > EQ.max) EQ.max = EQ.min; }
  else { const v = EQ.v, stp = {kg: EQ.t === 'band' ? 5 : 2.5, sled: 2.5, plates: 1, min: 5, max: 5}[f] || 1; v[f] = Math.max(0, +((+v[f] || 0) + dir * stp).toFixed(2)); }
  renderSheet();
};
A.eqF = d => { EQ.v[d.f] = d.v; renderSheet(); };
A.eqStep = d => { EQ.v.step = +d.v; renderSheet(); };
IN.eqname = v => { if (EQ && EQ.v) EQ.v.name = v.trim().slice(0, 40) || 'Unnamed'; };
A.eqSave = () => {
  const st = D.settings();
  if (EQ.t === 'db') D.saveSettings({dbMin: EQ.min, dbMax: EQ.max});
  else { const key = {bar: 'bars', machine: 'machines', band: 'bands'}[EQ.t]; const arr = st[key].slice(); const i = arr.findIndex(x => x.id === EQ.v.id); if (i < 0) arr.push(EQ.v); else arr[i] = EQ.v; const patch = {[key]: arr}; if (EQ.t === 'bar' && EQ.v.id === 'olympic') patch.bar = EQ.v.kg; D.saveSettings(patch); }
  EQ = null; closeSheet(); setTimeout(render, 30);
};
A.eqDel = () => { const st = D.settings(), key = {bar: 'bars', machine: 'machines', band: 'bands'}[EQ.t]; D.saveSettings({[key]: st[key].filter(x => x.id !== EQ.v.id)}); EQ = null; closeSheet(); setTimeout(render, 30); };

/* ---------- Muscle ranges ---------- */
VIEWS.ranges = {dock: false, render() {
  const st = D.settings();
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><button class="btn2" style="flex:0 0 auto;height:40px" data-act="rangeReset">Reset</button></div><h3 class="ptl">Muscle ranges</h3><p class="lede">Working sets per week. Below the first number (MEV) a muscle shows as behind; above the second (MRV) as too much. Secondary muscles count half a set.</p>
  ${MUSCLE_ORDER.filter(m => st.ranges[m]).map(m => { const [a, b] = st.ranges[m]; return `<div class="card stepc"><div class="stephd"><div><b>${cap(m)}</b><small>${a} to ${b} sets a week</small></div></div><div class="steps">${stepper('MEV', a, 'range', `data-m="${m}" data-k="0"`)}${stepper('MRV', b, 'range', `data-m="${m}" data-k="1"`)}</div></div>`; }).join('')}`;
}};
STEP.range = (dir, ds) => { const st = D.settings(), r = Object.assign({}, st.ranges), v = r[ds.m].slice(); v[+ds.k] = Math.max(0, Math.min(40, v[+ds.k] + dir)); if (v[0] > v[1]) v[ds.k === '0' ? 1 : 0] = v[+ds.k]; r[ds.m] = v; D.saveSettings({ranges: r}); render(); };
A.rangeReset = () => { D.saveSettings({ranges: JSON.parse(JSON.stringify(L.RANGES))}); render(); toast('Ranges reset to the defaults'); };

/* ---------- Templates ---------- */
VIEWS.templates = {dock: false, render() {
  const tp = D.templates();
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><button class="rb" data-act="tplNew" aria-label="New template">${ic('plus')}</button></div><h3 class="ptl">Templates</h3><p class="lede" style="font-size:14px">${plural(tp.length, 'routine')}, sorted by last used</p>
  ${tp.map(t => `<div class="card" style="padding:16px;margin-top:10px"><div class="hd"><button class="exh" data-act="tplEdit" data-id="${esc(t.id)}" style="min-width:0"><b style="font-size:18px;font-weight:800">${esc(t.name)}</b><p style="font-size:13px;font-weight:600;color:var(--soft)">${plural(t.items.length, 'exercise')}${t.lastUsed ? ', last ' + dShort(L.localDate(new Date(t.lastUsed))) : ''}, edit</p></button><button class="btn" style="width:auto;height:44px;padding:0 18px;font-size:14px;flex:none" data-act="startTpl" data-id="${esc(t.id)}">${ic('play', 'sm')}Start</button></div><div class="chipz">${t.items.map(x => `<span class="chip" style="font-size:12px;padding:6px 10px;cursor:default">${esc(exOf(x.exId).name)}</span>`).join('')}</div></div>`).join('')}
  ${tp.length ? '' : `<div class="card empty" style="margin-top:14px"><b>No templates.</b><p class="lede">Save a finished workout as a template, or build one here.</p></div>`}`;
}};
let TPL = null;
A.tplNew = () => { TPL = {id: Store.uid('tpl'), name: 'New template', items: [], isNew: true}; nav('tpledit'); };
A.tplEdit = d => { const t = Store.get('templates', d.id); if (!t) return; TPL = JSON.parse(JSON.stringify(t)); nav('tpledit'); };
VIEWS.tpledit = {dock: false, render() {
  if (!TPL) return VIEWS.templates.render();
  const lab = {}; let g = 0, k = 1; TPL.items.forEach((x, i) => { const prev = i > 0 && TPL.items[i - 1].link; if (!prev && x.link) { g++; k = 1; } if (prev || x.link) lab[i] = String.fromCharCode(64 + g) + (k++); });
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><button class="btn2" style="flex:0 0 auto;height:40px" data-act="tplSave">Save</button></div>
  <label class="card fld" style="margin-top:16px"><small>Name</small><input data-in="tplname" value="${esc(TPL.name)}" maxlength="40"></label>
  <div class="sec"><h5>Exercises</h5><span>sets × target reps</span></div>
  ${TPL.items.length ? `<div class="card ovl">${TPL.items.map((x, i) => { const e = exOf(x.exId); return `<div class="ovr" data-i="${i}" style="grid-template-columns:34px 1fr auto 44px;height:auto;min-height:74px;padding:6px 0"><span class="mk next"></span><div style="min-width:0"><b style="font-size:14px;font-weight:800;display:flex;gap:6px;align-items:center">${lab[i] ? `<span class="ss">${lab[i]}</span>` : ''}${esc(e.name)}</b><div class="pm" style="margin-top:6px;align-items:center;font-size:13px;font-weight:800"><button data-step="tpl" data-i="${i}" data-f="sets" data-dir="-1" aria-label="Fewer sets" style="width:34px;height:34px">−</button>${x.sets}<button data-step="tpl" data-i="${i}" data-f="sets" data-dir="1" aria-label="More sets" style="width:34px;height:34px">+</button><span style="color:var(--soft);margin:0 4px">×</span><button data-step="tpl" data-i="${i}" data-f="reps" data-dir="-1" aria-label="Fewer reps" style="width:34px;height:34px">−</button>${x.reps || '–'}<button data-step="tpl" data-i="${i}" data-f="reps" data-dir="1" aria-label="More reps" style="width:34px;height:34px">+</button></div></div><button class="grip" data-act="tplDel" data-i="${i}" aria-label="Remove ${esc(e.name)}">${ic('x', 'sm')}</button><span class="grip" data-grip role="button" tabindex="0" aria-label="Drag to reorder ${esc(e.name)}">${ic('grip', 'sm')}</span></div>${i < TPL.items.length - 1 ? `<div class="jn ${x.link ? 'on' : ''}"><button data-act="tplLink" data-i="${i}" aria-pressed="${!!x.link}" aria-label="Link as superset">${ic('link', 'xs')}</button></div>` : ''}`; }).join('')}</div>` : `<p class="lede">No exercises yet.</p>`}
  <div style="margin-top:12px;display:flex"><button class="btn2" data-act="library" data-m="tpl">${ic('plus', 'sm')}Add exercise</button></div>
  ${!TPL.isNew ? `<div class="btns" style="margin-top:20px"><button class="btn2 danger" data-act="tplRemove">${ic('trash', 'sm')}Delete template</button></div>` : ''}`;
}, bind(el) {
  $$('[data-grip]', el).forEach(g => {
    g.addEventListener('pointerdown', e => { e.preventDefault(); const row = g.closest('.ovr'), i = +row.dataset.i, y0 = e.clientY, h = row.offsetHeight; g.setPointerCapture(e.pointerId); row.classList.add('drag'); const mv = ev => { row.style.transform = `translateY(${ev.clientY - y0}px)`; }; const up = ev => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); tplMove(i, Math.round((ev.clientY - y0) / h)); }; g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); });
    g.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); tplMove(+g.closest('.ovr').dataset.i, e.key === 'ArrowUp' ? -1 : 1); } });
  });
}};
function tplMove(i, d) { const a = TPL.items, j = Math.max(0, Math.min(a.length - 1, i + d)); if (j !== i) { if (i > 0) a[i - 1].link = false; const [x] = a.splice(i, 1); x.link = false; a.splice(j, 0, x); if (j > 0) a[j - 1].link = false; } if (a.length) a[a.length - 1].link = false; render(); }
STEP.tpl = (dir, ds) => { const x = TPL.items[+ds.i]; if (!x) return; if (ds.f === 'sets') x.sets = Math.max(1, Math.min(10, x.sets + dir)); else x.reps = Math.max(0, Math.min(50, (x.reps || 0) + dir)); render(); };
IN.tplname = v => { TPL.name = v.trim().slice(0, 40) || 'Template'; };
A.tplLink = d => { const x = TPL.items[+d.i]; x.link = !x.link; render(); };
A.tplDel = d => { TPL.items.splice(+d.i, 1); if (TPL.items.length) TPL.items[TPL.items.length - 1].link = false; render(); };
A.tplSave = () => { if (!TPL.items.length) return toast('Add at least one exercise.'); const t = Object.assign({}, TPL); delete t.isNew; delete t.starter; Store.put('templates', t); TPL = null; history.back(); toast(`Saved ${t.name}`); };
A.tplRemove = () => openSheet('confirm', {title: `Delete ${TPL.name}?`, body: 'Only the template goes. Workouts you did with it stay in History.', ok: 'Delete template', act: 'tplRemoveYes', danger: 1});
A.tplRemoveYes = () => { Store.remove('templates', TPL.id); TPL = null; S.sheet = null; nav('templates', {}, {replace: true}); };

/* ---------- New exercise (also edits any exercise) ---------- */
const TYPEINFO = [['barbell', 'Barbell', 'Plates on a bar', ['olympic', 'ez', 'trap', 'smith']], ['rack', 'Rack', 'Dumbbells, kettlebells, plates', ['dumbbell', 'kettlebell', 'plate']], ['machine', 'Machine', 'Cable stack or plate-loaded', ['stack', 'plates']], ['bodyweight', 'Bodyweight', 'Plain, + weight, assisted', []], ['band', 'Band', 'Pick a band, count reps', []], ['timed', 'Timed', 'Hold for time', []], ['cardio', 'Cardio', 'Time, distance, pace', ['run', 'walk', 'bike', 'row', 'ski', 'stairs', 'elliptical', 'airbike', 'rope']]];
let NEWEX = null;
VIEWS.newex = {dock: false, render(p) {
  if (!NEWEX || NEWEX._for !== (p.id || 'new')) {
    const e = p.id ? exOf(p.id) : null;
    NEWEX = e ? {_for: p.id, id: e.id, custom: !!e.custom, name: e.name, type: e.logType, variant: e.variant || '', primary: e.primary, sec: (e.secondary || []).slice(), uni: !!e.unilateral, dist: !!e.distance, rest: e.rest, warm: e.warm || 'ask', note: e.note || '', pair: !!e.pair, fav: !!e.fav, needsGroup: !!e.needsGroup}
      : {_for: 'new', id: null, custom: true, name: p.name || '', type: 'barbell', variant: 'olympic', primary: 'chest', sec: [], uni: false, dist: false, rest: 120, warm: 'ask', note: '', pair: false, fav: false};
  }
  const s = NEWEX, T = TYPEINFO.find(t => t[0] === s.type);
  const MUSC = L.MUSCLES.concat(['cardio']);
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><button class="btn2" style="flex:0 0 auto;height:40px" data-act="nexSave">Save</button></div>
  <h3 class="ptl">${s.id ? 'Edit exercise' : 'New exercise'}</h3><p class="lede">${s.id && !s.custom ? 'Built-in exercise: your changes are kept on top of it.' : "For moves the built-in library doesn't have. The same page edits any exercise."}</p>
  <label class="card fld"><small>Name</small><input data-in="nexname" value="${esc(s.name)}" maxlength="50" placeholder="Landmine press" ${s.id ? '' : 'autofocus'}></label>
  <div class="sec"><h5>How it's logged</h5><span>pick one</span></div>
  <div class="tgrid">${TYPEINFO.map(([id, n, d]) => `<button data-act="nexF" data-f="type" data-v="${id}" class="${id === s.type ? 'on' : ''}" aria-pressed="${id === s.type}">${ic(TYPEICON[id], 'sm')}<b>${n}</b><small>${d}</small></button>`).join('')}</div>
  ${T[3].length ? `<div class="sec"><h5>${s.type === 'cardio' ? 'Machine' : s.type === 'machine' ? 'Type' : s.type === 'rack' ? 'Rack' : 'Bar'}</h5></div><div class="chipz">${T[3].map(v => `<button data-act="nexF" data-f="variant" data-v="${v}" class="${v === s.variant ? 'on' : ''}">${esc(L.VARIANT_LABEL[v])}</button>`).join('')}</div>` : ''}
  <div class="card prev"><small>The log screen will show</small><b>${T[1]}${s.variant && T[3].length ? ', ' + esc(L.VARIANT_LABEL[s.variant]) : ''}${s.uni && ['barbell', 'rack', 'machine', 'bodyweight', 'band'].includes(s.type) ? ', left and right reps' : ''}${s.dist ? ', distance' : ''}${s.type === 'rack' && s.pair ? ', a pair' : ''}</b></div>
  <div class="sec"><h5>Group</h5><span>${s.needsGroup ? 'imported without a clear muscle: pick one' : 'where it sits in the library'}</span></div><div class="chipz">${NEX_GROUPS.map(([g, ms]) => `<button data-act="nexGroup" data-v="${g}" class="${ms.includes(s.primary) && !s.needsGroup ? 'on' : ''}" aria-pressed="${ms.includes(s.primary) && !s.needsGroup}">${g}</button>`).join('')}</div>
  ${(() => { const grp = NEX_GROUPS.find(([, ms]) => ms.includes(s.primary)); return grp && grp[1].length > 1 ? `<div class="sec"><h5>Main muscle</h5><span>counts toward weekly volume</span></div><div class="chipz cap">${grp[1].map(m => `<button data-act="nexF" data-f="primary" data-v="${m}" class="${m === s.primary ? 'on' : ''}">${m}</button>`).join('')}</div>` : ''; })()}
  <div class="sec"><h5>Also works</h5><span>counts as half a set</span></div><div class="chipz cap">${L.MUSCLES.filter(m => m !== s.primary).map(m => `<button data-act="nexSec" data-v="${m}" class="${s.sec.includes(m) ? 'on2' : ''}" aria-pressed="${s.sec.includes(m)}">${m}</button>`).join('')}</div>
  <div class="card list" style="margin-top:12px">${sr('One side at a time', `<button class="tog" role="switch" aria-checked="${s.uni}" data-act="nexTog" data-f="uni" aria-label="One side at a time"></button>`, 'Log left and right reps separately')}${s.type === 'rack' ? sr('A pair (one in each hand)', `<button class="tog" role="switch" aria-checked="${s.pair}" data-act="nexTog" data-f="pair" aria-label="Pair"></button>`, 'Volume counts both') : ''}${sr('Also log distance', `<button class="tog" role="switch" aria-checked="${s.dist}" data-act="nexTog" data-f="dist" aria-label="Distance"></button>`, 'For carries and sled pushes')}${sr('Favourite', `<button class="tog" role="switch" aria-checked="${s.fav}" data-act="nexTog" data-f="fav" aria-label="Favourite"></button>`, 'Shows first when you pick an exercise')}${sr('Default rest', valc(s.rest ? mmss(s.rest) : 'none'), '', 'data-act="nexRest"')}${['barbell', 'machine'].includes(s.type) ? sr('Warm-up sets', valc(s.warm === 'off' ? 'Off' : 'Ask'), '', 'data-act="nexWarm"') : ''}</div>
  <label class="card fld" style="margin-top:10px"><small>Pinned note</small><input data-in="nexnote" value="${esc(s.note)}" maxlength="140" placeholder="Landmine in the corner, half-kneeling"></label>
  <button class="btn" style="margin-top:14px" data-act="nexSave">${ic('check', 'sm')}Save exercise</button>
  ${s.id ? `<div class="btns">${s.custom ? `<button class="btn2 danger" data-act="nexHide">${ic('trash', 'sm')}Remove from library</button>` : (Store.get('exprefs', s.id) ? `<button class="btn2" data-act="nexReset">Reset to built-in</button>` : '')}</div>` : ''}`;
}};
const NEX_GROUPS = [['Chest', ['chest']], ['Back', ['back', 'traps']], ['Shoulders', ['shoulders']], ['Arms', ['biceps', 'triceps', 'forearms']], ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']], ['Core', ['core']], ['Cardio', ['cardio']]];
A.nexGroup = d => { const s = NEWEX, g = NEX_GROUPS.find(x => x[0] === d.v); if (!g) return; if (!g[1].includes(s.primary) || s.needsGroup) s.primary = g[1][0]; s.needsGroup = false; s.sec = s.sec.filter(x => x !== s.primary); render(); };
IN.nexname = v => { NEWEX.name = v; };
IN.nexnote = v => { NEWEX.note = v.slice(0, 140); };
A.nexF = d => { const s = NEWEX; s[d.f] = d.v; if (d.f === 'type') { const T = TYPEINFO.find(t => t[0] === d.v); s.variant = T[3][0] || ''; s.rest = L.defaultRest({logType: d.v, variant: s.variant, primary: s.primary, secondary: s.sec}); s.pair = d.v === 'rack' && s.variant === 'dumbbell'; } if (d.f === 'primary') s.sec = s.sec.filter(x => x !== d.v); render(); };
A.nexSec = d => { const s = NEWEX; s.sec = s.sec.includes(d.v) ? s.sec.filter(x => x !== d.v) : s.sec.concat(d.v); render(); };
A.nexTog = d => { NEWEX[d.f] = !NEWEX[d.f]; render(); };
A.nexRest = () => { const opts = [0, 60, 90, 120, 150, 180]; const i = opts.indexOf(NEWEX.rest); NEWEX.rest = opts[(i + 1) % opts.length]; render(); };
A.nexWarm = () => { NEWEX.warm = NEWEX.warm === 'off' ? 'ask' : 'off'; render(); };
A.nexSave = () => {
  const s = NEWEX, name = s.name.trim();
  if (!name) return toast('Give it a name first.');
  const fields = {name, logType: s.type, variant: s.variant, primary: s.primary, secondary: s.sec, unilateral: s.uni, distance: s.dist};
  let id = s.id;
  if (s.custom) { id = id || 'c_' + L.normName(name).replace(/ /g, '-').slice(0, 30) + '_' + Date.now().toString(36); const old = Store.get('exercises', id) || {}; Store.put('exercises', Object.assign({}, old, fields, {id, custom: true, pair: s.pair, rest: s.rest, warm: s.warm, note: s.note, needsGroup: false})); savePref(id, {fav: !!s.fav}); }
  else savePref(id, {fields, pair: s.pair, rest: s.rest, warm: s.warm, note: s.note, fav: !!s.fav});
  const from = S.p.from; NEWEX = null; D._ex.clear();
  if (from === 'add' && D.session() && !s.id) { const se = D.session(), cur = curItem(se), it = makeItem(id, 3, 0); se.items.splice(cur ? se.items.indexOf(cur) + 1 : 0, 0, it); se.cur = it.uid; D.saveSession(se); nav('log', {}, {replace: true}); }
  else if (from === 'tpl' && TPL && !s.id) { TPL.items.push({exId: id, sets: 3, reps: 8, link: false}); history.back(); }
  else history.back();
  toast(`Saved ${name}`);
};
A.nexHide = () => { const e = Store.get('exercises', NEWEX.id); if (e) Store.put('exercises', Object.assign({}, e, {hidden: true})); NEWEX = null; history.back(); toast('Removed from the library. Its history stays.'); };
A.nexReset = () => { Store.remove('exprefs', NEWEX.id); NEWEX = null; D._ex.clear(); render(); toast('Back to the built-in settings'); };

/* ---------- Welcome and setup ---------- */
VIEWS.welcome = {dock: false, render() {
  return `<div class="win"><div class="kick">LIFT, a training log</div><div class="wwords" aria-label="Lift. Log. Progress."><div>Lift.</div><div>Log.</div><div class="wrot" aria-hidden="true"><span>Progress.</span><span>Repeat.</span><span>PR.</span><span>Recover.</span></div></div>
    <p class="wlede">The log that keeps up between sets, and tells you the truth after.</p><div class="wchips"><span>Offline</span><span>No ads</span><span>Your cloud</span></div>
    <div style="margin-top:auto;padding-top:30px"><button class="btn" data-act="go" data-v="setup">Set up in 20 seconds</button><button class="wghost" data-act="go" data-v="import1">Have a backup? <u>Import it</u></button></div></div>`;
}};
let SETUP = null;
VIEWS.setup = {dock: false, render() {
  const st = D.settings();
  if (!SETUP) SETUP = {name: st.name, bw: st.bw, bar: st.bar, theme: st.theme};
  WI.bw = SETUP.bw;
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button></div><h3 class="ptl">Quick setup</h3><p class="lede">Three things, then you're lifting. All of it can change later in Settings.</p>
  <label class="card fld"><small>Your name (for home)</small><input data-in="suname" value="${esc(SETUP.name)}" maxlength="30" placeholder="optional" autocomplete="given-name"></label>
  <div class="card" style="margin-top:12px;padding:14px 16px 10px"><div class="hd"><div><b style="font-size:15px;font-weight:800" data-body>Bodyweight</b><p>for pull-ups, dips and push-ups</p></div><b class="serif" style="font-size:40px" data-wv>${(+SETUP.bw).toFixed(1)}<small style="font-family:Manrope;font-size:13px;color:var(--soft)"> kg</small></b></div>${strip('su', range(40, 140, .5), +SETUP.bw, v => fmt(v), 'small', 'Bodyweight')}</div>
  <div class="card list" style="margin-top:12px">${sr('Bar weight', segb('suBar', [[20, '20'], [15, '15']], SETUP.bar), 'Your usual Olympic bar, kg')}${sr('Theme', segb('suTheme', [['light', 'Light'], ['dark', 'Dark'], ['device', 'Device']], SETUP.theme))}${sr('Language', segb('lang', [['en', 'English'], ['zh', '简体中文']], st.lang))}${sr('Units', '<span class="val">kg, km</span>')}</div>
  <button class="btn" style="margin-top:20px" data-act="suDone">Start lifting</button>`;
}};
STRIP.su = {live(v) { SETUP.bw = v; $$('[data-wv]').forEach(x => x.innerHTML = `${v.toFixed(1)}<small style="font-family:Manrope;font-size:13px;color:var(--soft)"> kg</small>`); }, set(v) { SETUP.bw = v; }};
IN.suname = v => { SETUP.name = v.trim().slice(0, 30); };
A.suBar = d => { SETUP.bar = +d.v; render(); };
A.suTheme = d => { SETUP.theme = d.v; D.saveSettings({theme: d.v}); applyTheme(); render(); };
A.suDone = () => {
  const st = D.settings(), bars = st.bars.map(b => b.id === 'olympic' ? Object.assign({}, b, {kg: SETUP.bar}) : b);
  D.saveSettings({name: SETUP.name, bw: SETUP.bw, bar: SETUP.bar, theme: SETUP.theme, bars});
  if (!D.weighins().length) Store.put('weighins', {id: 'bw_' + today(), date: today(), kg: +(+SETUP.bw).toFixed(1)});
  seedStarters();
  D.setMeta({setup: Date.now()}); SETUP = null;
  nav('log', {}, {replace: true});
};
function seedStarters() { if (!Store.all('templates').length) L.starterTemplates().forEach((t, i) => Store.put('templates', Object.assign(t, {order: i}))); }

/* ---------- Import (old LIFT 5 backup or this phone; LIFT 2 backups) ---------- */
let IMP = null;
VIEWS.import1 = {dock: false, render() {
  const old = Store.readOld();
  if (!IMP) IMP = {src: old ? 'phone' : 'file'};
  if (IMP.src === 'phone' && old && !IMP.plan) { try { IMP.plan = L.planOldImport(old); IMP.kind = 'lift5'; IMP.name = 'LIFT 5 data in this browser'; IMP.err = null; } catch (e) { IMP.err = e.message; } }
  const pl = IMP.plan;
  let body = '';
  if (IMP.err) body = `<div class="card banner" style="margin-top:12px"><span class="addb unm">${ic('x', 'sm')}</span><div class="grow"><b>Could not read that file</b><small>${esc(IMP.err)} Nothing was changed.</small></div></div>`;
  if (pl && IMP.kind === 'lift5') {
    const need = pl.exercises.filter(x => x.match.status !== 'auto'), auto = pl.exercises.length - need.length;
    body += `<div class="stat3"><div class="card"><div class="lbl">Workouts</div><b class="serif">${pl.workouts.length}</b></div><div class="card"><div class="lbl">Sets</div><b class="serif">${pl.sets}</b></div><div class="card"><div class="lbl">Exercises</div><b class="serif">${pl.exercises.length}</b></div></div>
    <div class="sec"><h5>What will happen</h5><span>${pl.from ? `${dShort(pl.from)} to ${dShort(pl.to)}` : ''}</span></div><div class="card list">
      <div class="row"><div class="addb okm">${ic('check', 'sm')}</div><div class="grow"><b>${plural(pl.workouts.length, 'workout')} come${pl.workouts.length === 1 ? 's' : ''} in</b><small>${pl.to ? 'Newest: ' + esc(dLong(pl.to)) : ''}${pl.lbs ? ', converted from lbs to kg' : ''}</small></div></div>
      <div class="row"><div class="addb okm">${ic('check', 'sm')}</div><div class="grow"><b>${plural(auto, 'exercise')} matched</b><small>Paired with the built-in library by name</small></div></div>
      ${need.length ? `<div class="row"><div class="addb unm">${ic('clock', 'sm')}</div><div class="grow"><b>${need.length} need a look</b><small>Old names LIFT doesn't know. Each has a safe default.</small></div></div>` : ''}
      ${pl.templates.length ? `<div class="row"><div class="addb okm">${ic('check', 'sm')}</div><div class="grow"><b>${plural(pl.templates.length, 'template')}</b><small>${pl.templates.slice(0, 3).map(t => esc(t.name)).join(', ')}</small></div></div>` : ''}
      ${(() => { const f = L.fitEquipment(L.convertOldImport(pl, () => 'x'), D.settings()); return f.notes.length ? `<div class="row"><div class="addb okm">${ic('check', 'sm')}</div><div class="grow"><b>Equipment fitted to your history</b><small>${esc(cap(f.notes.join(', ')))}</small></div></div>` : ''; })()}
      <div class="row"><div class="addb">${ic('minus', 'sm')}</div><div class="grow"><b>Old settings left behind</b><small>Units, bar and rest come from Settings here</small></div></div></div>
    <div style="margin-top:16px">${need.length ? `<button class="btn" data-act="go" data-v="import2">Review ${need.length} exercise${need.length > 1 ? 's' : ''}</button>` : `<button class="btn" data-act="doImport">${ic('check')}Import ${plural(pl.workouts.length, 'workout')}</button>`}</div>`;
  }
  if (pl && IMP.kind === 'lift2') {
    const d = pl.data, have = new Set(Store.all('workouts').map(w => w.id)), nw = (d.workouts || []).filter(w => !have.has(w.id)).length;
    body += `<div class="stat3"><div class="card"><div class="lbl">Workouts</div><b class="serif">${(d.workouts || []).length}</b></div><div class="card"><div class="lbl">New here</div><b class="serif">${nw}</b></div><div class="card"><div class="lbl">Templates</div><b class="serif">${(d.templates || []).length}</b></div></div>
    <div class="card list" style="margin-top:10px">${sr('LIFT 2 backup', '', `Saved ${esc(String(pl.exported || '').slice(0, 10))}, ${(d.exercises || []).length} custom exercises, ${(d.weighins || []).length} weigh-ins`)}${sr('Merge, never overwrite', '', 'The newer copy of each record wins; nothing here is deleted')}${sr('Settings', tog('impSettings', IMP.withSettings, 'Also bring settings'), 'Also bring the backup\'s settings')}</div>
    <div style="margin-top:16px"><button class="btn" data-act="doImport">${ic('check')}Import</button></div>`;
  }
  return `<div class="hd"><button class="rb" data-act="impBack" aria-label="Back">${ic('back')}</button>${pl && IMP.kind === 'lift5' ? '<span class="tag w" style="font-size:12px;padding:5px 10px">step 1 of 2</span>' : ''}</div>
  <h3 class="ptl">Import</h3><p class="lede">Nothing changes until you press Import. Workouts already here stay; duplicates are skipped.</p>
  ${old ? `<div class="seg wide" role="radiogroup" aria-label="Import from"><button class="${IMP.src === 'phone' ? 'on' : ''}" data-act="impSrc" data-v="phone">Old LIFT on this phone</button><button class="${IMP.src === 'file' ? 'on' : ''}" data-act="impSrc" data-v="file">Backup file</button></div>` : ''}
  ${IMP.src === 'file' ? `<div class="card list" style="margin-top:10px"><button class="row" data-act="impPick"><span class="addb">${ic('file', 'sm')}</span><span class="grow" style="min-width:0"><b style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${IMP.name && IMP.src === 'file' ? esc(IMP.name) : 'Choose a backup file'}</b><small>${IMP.size ? `${IMP.kind === 'lift2' ? 'LIFT 2' : 'LIFT 5'} backup, ${Math.max(1, Math.round(IMP.size / 1024))} KB` : 'A .json file from LIFT 5 or LIFT 2'}</small></span>${valc(IMP.name ? 'Change' : 'Choose')}</button></div>` : `<div class="card list" style="margin-top:10px"><div class="row"><span class="addb">${ic('phone', 'sm')}</span><div class="grow"><b class="t14">LIFT 5 data in this browser</b><small>Found automatically, weights as saved</small></div></div></div>`}
  ${body}<button class="wghost" data-act="impBack">Cancel</button>`;
}};
A.impBack = () => { IMP = null; history.length > 1 ? history.back() : nav(defaultView(), {}, {replace: true}); };
A.impSrc = d => { IMP = {src: d.v}; render(); };
A.impPick = () => pickFile('.json,application/json', (text, f) => {
  IMP = {src: 'file', name: f.name, size: f.size};
  try {
    let d; try { d = JSON.parse(text); } catch (e) { throw new Error('This is not a JSON file.'); }
    if (d && d.app === 'LIFT' && d.schema === 2 && d.data) { IMP.kind = 'lift2'; IMP.plan = {data: d.data, exported: d.exported}; IMP.withSettings = !!d.data.settings && !Store.all('workouts').length; }
    else { IMP.kind = 'lift5'; IMP.plan = L.planOldImport(d); if (!IMP.plan.workouts.length) throw new Error('No workouts found in this file.'); }
  } catch (e) { IMP.err = e.message; IMP.plan = null; }
  render();
});
A.impSettings = () => { IMP.withSettings = !IMP.withSettings; render(); };
VIEWS.import2 = {dock: false, render() {
  if (!IMP || !IMP.plan || IMP.kind !== 'lift5') return VIEWS.import1.render();
  const pl = IMP.plan, rows = pl.exercises.map((x, i) => [x, i]).filter(([x]) => x.match.status !== 'auto');
  const nm = rows.filter(([x]) => x.choice === 'map').length;
  return `<div class="hd"><button class="rb" data-act="back" aria-label="Back">${ic('back')}</button><span class="tag w" style="font-size:12px;padding:5px 10px">step 2 of 2</span></div>
  <h3 class="ptl">Match exercises</h3><p class="lede">The old app used these names. Pick the built-in match, or keep yours as a custom exercise. Its history comes along either way.</p>
  ${rows.map(([x, i]) => { const sug = x.mapTo ? exOf(x.mapTo) : null; return `<div class="card mapc"><div class="stephd"><div><b>“${esc(x.name)}”</b><small>${plural(x.workouts, 'workout')}, ${plural(x.sets, 'set')}${x.old && x.old.lateral === 'unilateral' ? ', one side' : ''}${!sug ? ', no built-in match' : ''}${x.why ? ', ' + esc(x.why) : ''}${x.note ? ', note: ' + esc(x.note) : ''}</small></div></div><div class="mapo" role="radiogroup" aria-label="${esc(x.name)}">
    ${sug ? `<button role="radio" aria-checked="${x.choice === 'map'}" data-act="impMap" data-i="${i}" data-v="map" class="${x.choice === 'map' ? 'on' : ''}"><span class="rad"></span><span><b>${esc(sug.name)}</b><small>built-in, ${esc(L.TYPE_LABEL[sug.logType])}${sug.variant ? ', ' + esc((L.VARIANT_LABEL[sug.variant] || '').toLowerCase()) : ''}</small></span></button>` : ''}
    <button role="radio" aria-checked="${x.choice === 'keep'}" data-act="impMap" data-i="${i}" data-v="keep" class="${x.choice === 'keep' ? 'on' : ''}"><span class="rad"></span><span><b>Keep as “${esc(x.name)}”</b><small>custom, logs as ${esc(L.TYPE_LABEL[x.keepAs.logType])}${x.keepAs.variant && L.VARIANT_LABEL[x.keepAs.variant] ? ', ' + esc(L.VARIANT_LABEL[x.keepAs.variant].toLowerCase()) : ''}</small></span></button>
  </div><button class="mapl" data-act="library" data-m="map" data-ref="${i}">Pick from the library instead</button></div>`; }).join('')}
  <div style="margin-top:16px"><button class="btn" data-act="doImport">${ic('check')}Import ${plural(pl.workouts.length, 'workout')}</button></div>
  <p class="lede" style="text-align:center;margin-top:8px">${nm} matched to built-in, ${rows.length - nm} kept as custom</p>`;
}};
A.impMap = d => { const x = IMP.plan.exercises[+d.i]; x.choice = d.v; render(); };
A.doImport = () => {
  if (!IMP || !IMP.plan) return;
  let n = 0;
  if (IMP.kind === 'lift5') {
    const out = L.convertOldImport(IMP.plan, Store.uid);
    n = Store.merge('workouts', out.workouts).added;
    Store.merge('exercises', out.exercises);
    Store.merge('exprefs', out.prefs);
    Store.merge('templates', out.templates);
    Store.merge('weighins', out.weighins);
    const fit = L.fitEquipment(out, D.settings()); if (Object.keys(fit.patch).length) D.saveSettings(fit.patch);
  } else {
    const d = IMP.plan.data;
    n = Store.merge('workouts', (d.workouts || []).filter(r => !r.deleted), {revive: true}).added;
    for (const c of ['exercises', 'exprefs', 'templates', 'weighins']) if (Array.isArray(d[c])) Store.merge(c, d[c].filter(r => !r.deleted), {revive: true});
    if (IMP.withSettings && d.settings) D.saveSettings(L.mergeSettings(d.settings));
  }
  const w = D.weighins(); if (w.length) D.saveSettings({bw: w[w.length - 1].kg});
  if (!D.meta().setup) { seedStarters(); D.setMeta({setup: Date.now()}); }
  D._w = null; D._prs = null; D._ex.clear();
  IMP = null;
  nav('log', {}, {replace: true});
  toast(n ? `Imported ${plural(n, 'workout')}` : 'Nothing new: those workouts were already here');
};

/* ---------- theme, glass, service worker, start ---------- */
let lowBattery = false;
function applyTheme() {
  const st = D.settings(), root = document.documentElement;
  root.dataset.theme = st.theme;
  root.classList.toggle('noglass', !!st.reduceGlass || lowBattery);
  root.classList.toggle('big', st.textSize === 'large');
  const dark = st.theme === 'dark' || (st.theme === 'device' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#141416' : '#f7e6df';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
try { navigator.getBattery && navigator.getBattery().then(b => { const f = () => { lowBattery = b.level <= .2 && !b.charging; applyTheme(); }; f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f); }); } catch (e) {}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('LIFT: offline mode unavailable', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('LIFT was updated', {action: {label: 'Reload', fn: () => location.reload()}, ms: 12000}); });
}
(function start() {
  if (!Store.available) { view.innerHTML = `<div class="card empty" style="margin-top:60px"><b>This browser is blocking storage.</b><p class="lede">LIFT keeps your workouts on this phone, so it needs site storage. Leave private mode or allow storage for this site.</p></div>`; return; }
  applyTheme();
  I18N.setLang(D.settings().lang);
  Store.persist();
  S.view = defaultView();
  history.replaceState({v: S.view, p: {}}, '');
  render();
  if (D.session()) wake();
})();
