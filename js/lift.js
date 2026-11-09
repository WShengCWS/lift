/* LIFT domain logic: pure functions, no DOM, no storage.
   Loaded in the browser after data/exercises.js; also runs in Node for tests. */
(function (root) {
'use strict';
/* data/exercises.js declares top-level consts (not window properties), so read them by name */
const EX = typeof EXERCISES !== 'undefined' ? EXERCISES : require('../data/exercises.js').EXERCISES;
const CARDIO = typeof CARDIO_FIELDS !== 'undefined' ? CARDIO_FIELDS : require('../data/exercises.js').CARDIO_FIELDS;

/* ---------- settings ---------- */
const PLATE_COLORS = {25:'#d7263d',20:'#1e5bd8',15:'#f2c230',10:'#2a9d5c',5:'#f4f3ef',2.5:'#d7263d',2:'#1e5bd8',1.5:'#f2c230',1.25:'#c3c8d1',1:'#2a9d5c',0.5:'#f4f3ef',0.25:'#c3c8d1'};
const ALL_PLATES = [25,20,15,10,5,2.5,2,1.5,1.25,1,0.5,0.25];
const KB_COLORS = {4:'#c3c8d1',6:'#f4a7c6',8:'#f06fa8',10:'#f4a7c6',12:'#1e5bd8',14:'#7fb2ff',16:'#f2c230',18:'#c4b7f7',20:'#7a4fd8',22:'#9ad8b0',24:'#2a9d5c',28:'#f08c1e',32:'#d7263d',36:'#8a8f99',40:'#f4f3ef'};
const MUSCLES = ['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','traps'];
/* evidence-based weekly working-set ranges (MEV to MRV), editable in Settings */
const RANGES = {chest:[10,20],back:[10,20],shoulders:[8,20],biceps:[8,20],triceps:[8,20],quads:[8,18],hamstrings:[6,16],glutes:[4,16],calves:[8,16]};

function defaultSettings() {
  return {
    name: '', theme: 'device', reduceGlass: false, textSize: 'default',
    unit: 'kg', bw: 72, bar: 20,
    steps: {barbell: 2.5, dumbbell: 2, stack: 5, addon: 2.5, machine: 5, bw: 2.5, round: 0.5},
    micro: false,
    plates: {25:true,20:true,15:true,10:true,5:true,2.5:true,2:false,1.5:false,1.25:true,1:false,0.5:true,0.25:true},
    bars: [
      {id:'olympic', name:'Olympic bar', kg:20, note:'Bench, squat, deadlift'},
      {id:'womens', name:"Women's bar", kg:15, note:''},
      {id:'ez', name:'EZ curl bar', kg:10, note:''},
      {id:'trap', name:'Trap bar', kg:25, note:''},
      {id:'smith', name:'Smith machine', kg:15, note:'Bar counts'},
    ],
    dbMin: 2, dbMax: 50,
    kettlebells: [8,12,16,20,24,28,32],
    machines: [
      {id:'legpress', name:'Leg press', kind:'plates', sled:50, step:5},
      {id:'hack', name:'Hack squat', kind:'plates', sled:40, step:5},
      {id:'stack', name:'Weight stacks', kind:'stack', plates:20, step:5},
      {id:'assist', name:'Assisted pull-up', kind:'assist', min:5, max:70, step:5},
    ],
    bands: [
      {id:'light', name:'Light', color:'#f2c230', kg:10},
      {id:'medium', name:'Medium', color:'#d7263d', kg:20},
      {id:'heavy', name:'Heavy', color:'#7a4fd8', kg:30},
      {id:'xheavy', name:'X-heavy', color:'#2a9d5c', kg:40},
    ],
    rest: 120, restPerExercise: true, sound: true, vibrate: true, keepAwake: true,
    fillLast: true, warmups: 'ask', prAlerts: true, haptics: true, drop: 20, rpe: false,
    weeklyTarget: 4, weekStart: 1, ranges: JSON.parse(JSON.stringify(RANGES)), formula: 'epley',
    backupReminder: true,
  };
}
function mergeSettings(saved) {
  const d = defaultSettings();
  if (!saved || typeof saved !== 'object') return d;
  const out = Object.assign({}, d, saved);
  for (const k of ['steps', 'plates', 'ranges']) out[k] = Object.assign({}, d[k], saved[k] || {});
  for (const k of ['bars', 'machines', 'bands', 'kettlebells']) if (!Array.isArray(saved[k])) out[k] = d[k];
  out.unit = 'kg';
  return out;
}

/* ---------- numbers and dates ---------- */
const fmt = n => (n == null || n === '' || isNaN(n)) ? '' : String(+(+n).toFixed(2));
const fmtThousands = n => Math.round(n).toLocaleString('en-GB');
const mmss = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
const pad = n => String(n).padStart(2, '0');
/* local calendar dates (never toISOString: that is UTC and shifts the day) */
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return localDate(d); };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
function weekStartOf(s, ws = 1) { const d = parseDate(s); const diff = (d.getDay() - ws + 7) % 7; d.setDate(d.getDate() - diff); return localDate(d); }
function isoWeek(s) { const d = parseDate(s); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
const roundTo = (v, step, mode) => { if (!step) return v; const q = v / step; const r = mode === 'down' ? Math.floor(q + 1e-9) : mode === 'up' ? Math.ceil(q - 1e-9) : Math.round(q); return +(r * step).toFixed(2); };
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0));

/* ---------- exercises ---------- */
function pairDefault(e) {
  if (e.logType !== 'rack') return false;
  if (e.variant === 'dumbbell') return !/single-arm|concentration|kickback|suitcase|pullover|overhead dumbbell extension|goblet|calf raise/i.test(e.name);
  if (e.variant === 'kettlebell') return /carry/i.test(e.name);
  return false;
}
function defaultRest(e) {
  if (!e) return 120;
  if (e.logType === 'cardio') return 0;
  if (['bodyweight', 'timed', 'band'].includes(e.logType) || e.primary === 'core') return 60;
  const big = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'glutes'].includes(e.primary);
  if (e.logType === 'barbell' && ['olympic', 'trap'].includes(e.variant) && big && e.secondary.length) return 150;
  if (big && e.secondary.length && e.logType !== 'machine') return 120;
  if (big && e.secondary.length && e.variant === 'plates') return 120;
  return 90;
}
/* the exercise as the app uses it: built-in or custom, with the owner's saved preferences on top */
function resolveExercise(id, custom = [], prefs = []) {
  const base = EX.find(e => e.id === id) || custom.find(e => e.id === id && !e.deleted);
  if (!base) return null;
  const p = prefs.find(x => x.id === id) || {};
  const e = Object.assign({secondary: []}, base, p.fields || {});
  e.pair = p.pair != null ? p.pair : (base.pair != null ? base.pair : pairDefault(e));
  e.rest = p.rest != null ? p.rest : (base.rest != null ? base.rest : defaultRest(e));
  e.note = p.note || base.note || '';
  e.seat = p.seat || '';
  e.machineId = p.machineId || base.machineId || '';
  e.warm = p.warm || base.warm || '';
  return e;
}
const TYPE_LABEL = {barbell:'Barbell',rack:'Rack',machine:'Machine',bodyweight:'Bodyweight',band:'Band',timed:'Timed',cardio:'Cardio'};
const VARIANT_LABEL = {olympic:'Olympic bar',ez:'EZ bar',trap:'Trap bar',smith:'Smith',dumbbell:'Dumbbells',kettlebell:'Kettlebells',plate:'Plate',stack:'Weight stack',plates:'Plate-loaded',run:'Run',walk:'Walk',bike:'Bike',row:'Row',ski:'SkiErg',stairs:'StairMaster',elliptical:'Elliptical',airbike:'Air bike',rope:'Jump rope'};

/* ---------- equipment ---------- */
function plateSet(st) { return ALL_PLATES.filter(k => st.plates[k] && (st.micro || k >= 1)); }
function splitPlates(perSide, plates) {
  let r = +perSide.toFixed(2); const out = [];
  if (r <= 0) return {plates: out, rest: 0};
  for (const k of plates) while (r >= k - 1e-9) { out.push(k); r = +(r - k).toFixed(2); }
  return {plates: out, rest: r};
}
function barFor(e, st) {
  const id = e.variant === 'olympic' ? null : e.variant;
  if (!id) return st.bar;
  const b = st.bars.find(x => x.id === id);
  return b ? b.kg : st.bar;
}
function machineFor(e, st) {
  if (e.logType !== 'machine') return null;
  if (e.machineId) { const m = st.machines.find(x => x.id === e.machineId); if (m) return m; }
  if (e.variant === 'plates') {
    const n = e.name.toLowerCase();
    return st.machines.find(m => m.kind === 'plates' && (n.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(n))) || {id:'', name:'Plate-loaded machine', kind:'plates', sled:0, step:st.steps.machine};
  }
  return st.machines.find(m => m.kind === 'stack') || {id:'', name:'Weight stack', kind:'stack', plates:20, step:st.steps.stack};
}
function stepFor(e, st) {
  if (!e) return 2.5;
  switch (e.logType) {
    case 'barbell': return st.steps.barbell;
    case 'rack': return e.variant === 'dumbbell' ? st.steps.dumbbell : st.steps.barbell;
    case 'machine': { const m = machineFor(e, st); return (m && m.step) || (e.variant === 'stack' ? st.steps.stack : st.steps.machine); }
    case 'bodyweight': case 'timed': return st.steps.bw;
    default: return 1;
  }
}
function minFor(e, st) {
  if (e.logType === 'barbell') return barFor(e, st);
  if (e.logType === 'machine') { const m = machineFor(e, st); return m.kind === 'plates' ? (m.sled || 0) : stepFor(e, st); }
  if (e.logType === 'rack') return e.variant === 'dumbbell' ? st.dbMin : 0;
  return 0;
}
function dumbbellRange(st) { const o = []; for (let v = st.dbMin; v <= st.dbMax + 1e-9; v += st.steps.dumbbell) o.push(+v.toFixed(2)); return o; }
/* clamp and snap a typed or stepped weight to what the gym can make */
function snapWeight(e, st, kg) {
  const step = stepFor(e, st), min = minFor(e, st);
  if (e.logType === 'rack' && e.variant === 'kettlebell') { const ks = st.kettlebells.slice().sort((a, b) => a - b); return ks.reduce((b, k) => Math.abs(k - kg) < Math.abs(b - kg) ? k : b, ks[0] || kg); }
  if (e.logType === 'rack' && e.variant === 'dumbbell') return Math.min(st.dbMax, Math.max(st.dbMin, +(st.dbMin + roundTo(kg - st.dbMin, step)).toFixed(2)));
  if (e.logType === 'machine' && machineFor(e, st).kind !== 'plates') return Math.max(step, +(+kg).toFixed(2)); /* stacks: keep add-on offsets like 6.25 */
  return Math.max(min, +(min + roundTo(kg - min, step)).toFixed(2));
}

/* ---------- sets ---------- */
const REAL = {working: 1, drop: 1, failure: 1};
const isReal = s => !!REAL[s.type || 'working'] && !!s.done;
const hasData = s => !!(s.reps || s.l || s.r || s.sec || s.m || s.floors || s.cal || s.jumps);
function setReps(s, e) { return e && e.unilateral ? Math.min(+s.l || 0, +s.r || 0) : (+s.reps || 0); }
function setTotalReps(s, e) { return e && e.unilateral ? (+s.l || 0) + (+s.r || 0) : (+s.reps || 0); }
/* the weight that counts for PRs: bar total, one dumbbell, stack, or you + belt for bodyweight */
function setWeight(s, e) {
  if (!e) return +s.kg || 0;
  if (e.logType === 'bodyweight') return +((+s.bw || 0) + (+s.add || 0)).toFixed(2);
  if (e.logType === 'band') return +s.bandKg || 0;
  if (e.logType === 'timed') return +s.add || 0;
  return +s.kg || 0;
}
function setVolume(s, e) {
  if (!e || ['cardio', 'timed', 'band'].includes(e.logType)) return 0;
  const load = setWeight(s, e) * (e.pair ? 2 : 1);
  return load * setTotalReps(s, e);
}
function e1rm(w, r, formula = 'epley') {
  if (!w || !r) return 0;
  if (r === 1) return w;
  if (formula === 'brzycki') return r >= 37 ? 0 : w * 36 / (37 - r);
  return w * (1 + r / 30);
}
function warmups(e, kg, st) {
  if (!['barbell', 'machine'].includes(e.logType)) return [];
  const step = stepFor(e, st), min = minFor(e, st), out = [];
  const ramp = e.logType === 'barbell' ? [[0, 10], [0.5, 8], [0.7, 5], [0.85, 3]] : [[0.5, 10], [0.7, 6], [0.85, 3]];
  for (const [p, reps] of ramp) {
    const w = p === 0 ? min : Math.max(min || step, +(min + roundTo(kg * p - min, step, 'down')).toFixed(2));
    if (w >= kg) continue;
    if (out.length && out[out.length - 1].kg === w) continue;
    out.push({type: 'warmup', kg: w, reps});
  }
  return out;
}
function dropWeight(e, prevKg, st) {
  const target = prevKg * (1 - st.drop / 100);
  if (e.logType === 'rack' && e.variant === 'kettlebell') { const ks = st.kettlebells.filter(k => k < prevKg); return ks.length ? ks.reduce((b, k) => Math.abs(k - target) < Math.abs(b - target) ? k : b) : prevKg; }
  if (e.logType === 'machine' && machineFor(e, st).kind !== 'plates') return Math.min(prevKg, Math.max(stepFor(e, st), roundTo(target, stepFor(e, st))));
  return Math.min(prevKg, snapWeight(e, st, target));
}

/* ---------- PRs (real sets only; estimates never count) ---------- */
/* returns Map setId -> array of 'weight' | 'reps' | 'volume' | 'time' */
function computePRs(workouts, exOf) {
  const best = {}, tags = new Map();
  for (const w of workouts.slice().sort(byDate)) {
    const seenNow = new Set();
    for (const it of w.items || []) {
      const e = exOf(it.exId); if (!e || e.logType === 'cardio') continue;
      const b = best[it.exId] || (best[it.exId] = {seen: false, maxW: -1, repsAt: {}, maxV: -1, maxSec: -1});
      for (const s of it.sets || []) {
        if (!isReal(s)) continue;
        const t = [], wgt = setWeight(s, e), reps = setReps(s, e), vol = setVolume(s, e);
        if (e.logType === 'timed') {
          if (b.seen && (+s.sec || 0) > b.maxSec) t.push('time');
          b.maxSec = Math.max(b.maxSec, +s.sec || 0);
        } else {
          /* bodyweight: heaviest means most added weight, so a heavier you is not a PR */
          const bwx = e.logType === 'bodyweight', top = bwx ? (+s.add || 0) : wgt;
          const key = e.logType === 'band' ? (s.band || '') : bwx ? fmt(+s.add || 0) : fmt(wgt);
          if (b.seen && e.logType !== 'band' && top > b.maxW && (!bwx || top > 0)) t.push('weight');
          if (b.seen && b.repsAt[key] != null && reps > b.repsAt[key]) t.push('reps');
          if (b.seen && vol > 0 && vol > b.maxV && !t.length) t.push('volume');
          b.maxW = Math.max(b.maxW, top); b.maxV = Math.max(b.maxV, vol);
          b.repsAt[key] = Math.max(b.repsAt[key] || 0, reps);
        }
        if (t.length) tags.set(s.id, t);
      }
      seenNow.add(it.exId);
    }
    seenNow.forEach(id => { best[id].seen = true; });
  }
  return tags;
}
const PR_LABEL = {weight: 'heaviest weight', reps: 'most reps at this weight', volume: 'best single-set volume', time: 'longest hold'};

/* ---------- weekly numbers ---------- */
function workoutSummary(w, exOf) {
  let sets = 0, vol = 0;
  for (const it of w.items || []) { const e = exOf(it.exId); for (const s of it.sets || []) if (isReal(s)) { sets++; vol += setVolume(s, e); } }
  const min = w.end && w.start ? Math.max(1, Math.round((w.end - w.start) / 60000)) : (w.minutes || 0);
  return {sets, vol, min};
}
function muscleSets(workouts, exOf) {
  const m = {};
  for (const w of workouts) for (const it of w.items || []) {
    const e = exOf(it.exId); if (!e || e.logType === 'cardio') continue;
    const n = (it.sets || []).filter(isReal).length; if (!n) continue;
    m[e.primary] = (m[e.primary] || 0) + n;
    for (const s2 of e.secondary || []) m[s2] = (m[s2] || 0) + n / 2;
  }
  return m;
}
function weekWorkouts(workouts, weekStart) { const end = addDays(weekStart, 7); return workouts.filter(w => w.date >= weekStart && w.date < end); }

/* ---------- suggestion: "try +1 step" when every target rep was hit last time ---------- */
function suggestion(e, lastSets, targetReps, st) {
  const work = (lastSets || []).filter(s => isReal(s) && (s.type || 'working') === 'working');
  if (!work.length || !['barbell', 'rack', 'machine'].includes(e.logType)) return null;
  const top = Math.max(...work.map(s => +s.kg || 0));
  const target = targetReps || setReps(work[0], e);
  const atTop = work.filter(s => (+s.kg || 0) === top);
  if (!target || !atTop.every(s => setReps(s, e) >= target)) return null;
  let next;
  if (e.variant === 'kettlebell') { next = st.kettlebells.filter(k => k > top).sort((a, b) => a - b)[0]; if (!next) return null; }
  else next = +(top + stepFor(e, st)).toFixed(2);
  if (e.variant === 'dumbbell' && next > st.dbMax) return null;
  return {from: top, kg: next, reps: target};
}

/* ---------- cardio ---------- */
const KCAL_PER_MIN = {run: 10.5, walk: 6, bike: 9, row: 11, ski: 12, stairs: 11, elliptical: 9, rope: 12};
function cardioFields(e) { return CARDIO[e.variant] || {fields: ['time', 'distance'], derived: 'pace'}; }
function cardioDerived(e, s, bw = 72) {
  const min = (+s.sec || 0) / 60, km = (+s.m || 0) / 1000, out = [];
  const d = cardioFields(e).derived;
  if (d === 'pace' && km && min) out.push(['Pace /km', mmss(min * 60 / km)], ['km/h', fmt(+(km / (min / 60)).toFixed(1))]);
  if (d === 'speed' && km && min) out.push(['km/h', fmt(+(km / (min / 60)).toFixed(1))], ['Pace /km', mmss(min * 60 / km)]);
  if (d === 'split500' && s.m && min) out.push(['Split /500 m', mmss(min * 60 / (s.m / 500))], ['m/min', String(Math.round(s.m / min))]);
  if (d === 'floorsPerMin' && s.floors && min) out.push(['Floors /min', fmt(+(s.floors / min).toFixed(1))]);
  if (d === 'calPerMin' && s.cal && min) out.push(['cal /min', fmt(+(s.cal / min).toFixed(1))]);
  if (d === 'jumpsPerMin' && s.jumps && min) out.push(['Jumps /min', String(Math.round(s.jumps / min))]);
  const kcal = e.variant === 'airbike' ? (+s.cal || 0) : Math.round(min * (KCAL_PER_MIN[e.variant] || 8) * bw / 72);
  return {pairs: out, kcal};
}

/* ---------- import from the old app (LIFT 5, localStorage prefix lift5_) ---------- */
/* the old app's built-in exercises: [name, muscle, secondary, equipment, trackingMode, one side]. Its backups only list exercises
   the owner customised, so these fill in how each old default was logged. */
const OLD_DEF = {"ex_bench_bb":["Bench Press","chest",["triceps","shoulders"],"barbell","weighted",0],"ex_bench_db":["DB Bench Press","chest",["triceps"],"dumbbell","weighted",0],"ex_incline_bb":["Incline Bench","chest",["shoulders"],"barbell","weighted",0],"ex_incline_db":["Incline DB Press","chest",["shoulders"],"dumbbell","weighted",0],"ex_cable_fly":["Cable Fly","chest",[],"cable","weighted",0],"ex_pushup":["Push Up","chest",["triceps"],"bodyweight","bodyweight",0],"ex_pullup":["Pull Up","back",["biceps"],"bodyweight","bodyweight",0],"ex_chinup":["Chin Up","back",["biceps"],"bodyweight","bodyweight",0],"ex_row_bb":["Barbell Row","back",["biceps"],"barbell","weighted",0],"ex_row_db":["DB Row","back",["biceps"],"dumbbell","weighted",1],"ex_lat":["Lat Pulldown","back",["biceps"],"cable","weighted",0],"ex_deadlift":["Deadlift","back",["hamstrings","glutes"],"barbell","weighted",0],"ex_facepull":["Face Pull","shoulders",["back"],"cable","weighted",0],"ex_ohp":["OHP","shoulders",["triceps"],"barbell","weighted",0],"ex_ohp_db":["DB Shoulder Press","shoulders",["triceps"],"dumbbell","weighted",0],"ex_curl_bb":["Barbell Curl","biceps",[],"barbell","weighted",0],"ex_curl_db":["DB Curl","biceps",[],"dumbbell","weighted",1],"ex_curl_hammer":["Hammer Curl","biceps",[],"dumbbell","weighted",1],"ex_lateral":["Lateral Raise","shoulders",[],"dumbbell","weighted",0],"ex_pushdown":["Tricep Pushdown","triceps",[],"cable","weighted",0],"ex_dip":["Dip","triceps",["chest"],"bodyweight","bodyweight",0],"ex_squat":["Squat","quads",["glutes","hamstrings"],"barbell","weighted",0],"ex_rdl":["Romanian Deadlift","hamstrings",["glutes"],"barbell","weighted",0],"ex_leg_press":["Leg Press","quads",["glutes"],"machine","weighted",0],"ex_lunge":["DB Lunge","quads",["glutes"],"dumbbell","weighted",1],"ex_split_squat":["Bulgarian Split Squat","quads",["glutes"],"dumbbell","weighted",1],"ex_calf":["Calf Raise","calves",[],"machine","weighted",0],"ex_plank":["Plank","core",[],"bodyweight","bodyweight",0],"ex_crunch":["Crunch","core",[],"bodyweight","bodyweight",0],"ex_run":["Running","cardio",[],"none","cardio",0],"ex_cycle":["Cycling","cardio",[],"machine","cardio",0],"ex_row_erg":["Rowing Machine","cardio",["back"],"machine","cardio",0],"ex_jump":["Jump Rope","cardio",[],"none","cardio",0],"ex_swim":["Swimming","cardio",[],"none","cardio",0],"ex_hiit":["HIIT","cardio",[],"none","cardio",0],"ex_walk":["Walking","cardio",[],"none","cardio",0],"ex_snatch":["Snatch","shoulders",["back","quads"],"barbell","weighted",0],"ex_clean":["Clean & Jerk","quads",["shoulders","back"],"barbell","weighted",0]};
const OLD_DEFAULTS = Object.fromEntries(Object.entries(OLD_DEF).map(([k, v]) => [k, v[0]]));
function oldDefault(id) { const v = OLD_DEF[id]; return v ? {id, name: v[0], muscle: v[1], secondary: v[2], equipment: v[3], trackingMode: v[4], lateral: v[5] ? 'unilateral' : 'bilateral'} : null; }
/* spellings the owner used in the old app ("felt" for delt, "extention", "peck deck", "kattebell") */
const TYPOS = [[/\bextention\b/g, 'extension'], [/\btricpet\b/g, 'triceps'], [/\bpeck\b/g, 'pec'], [/\bk[ae]t+e?bell\b/g, 'kettlebell'], [/\bdumbbel\b/g, 'dumbbell'], [/\bfelt\b/g, 'delt'], [/\bpullup\b/g, 'pull up'], [/\bchinup\b/g, 'chin up']];
function normName(n) {
  let s = String(n || '').toLowerCase().replace(/&/g, ' and ');
  for (const [re, to] of TYPOS) s = s.replace(re, to);
  s = s.replace(/\bdb\b/g, 'dumbbell').replace(/\bbb\b/g, 'barbell').replace(/\btricep\b/g, 'triceps').replace(/\bbicep\b/g, 'biceps');
  return s.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map(w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w).join(' ');
}
/* likely matches for names that are not exact. "~" marks a weak one: offered, but "keep yours" stays selected */
const ALIASES = {'ohp':'overhead-press','overhead press':'overhead-press','military press':'overhead-press','dumbbell row':'single-arm-dumbbell-row','dumbbell shoulder press':'seated-dumbbell-press','squat':'back-squat','incline bench':'incline-bench-press','calf raise':'standing-calf-raise','running':'outdoor-run','run':'outdoor-run','cycling':'outdoor-cycle','walking':'outdoor-walk','dumbbell lunge':'walking-lunge','rdl':'romanian-deadlift','skullcrusher':'skull-crusher','leg curl':'lying-leg-curl',
  'weighted pull up':'~pull-up','weighted chin up':'~chin-up','hamstring curl':'~lying-leg-curl','leg curl sitting':'~seated-leg-curl','hip adductor opener':'~hip-adduction','hip adductor':'~hip-adduction'};
/* names that carry a grip or set-up (", | | grip", "wide", "shoulder width"): the owner tracks these apart on purpose */
const VARIANT_NAME = /grip|width|\bwide\b|narrow|\btight\b|\||\/|\\/i;
function matchOldName(name) {
  const n = normName(name), sq = n.replace(/ /g, '');
  const exact = EX.find(e => normName(e.name) === n || normName(e.name).replace(/ /g, '') === sq);
  if (exact) return {status: 'auto', id: exact.id, sure: true};
  const al = ALIASES[n];
  if (al && EX.find(e => e.id === al.replace('~', ''))) return {status: 'suggest', id: al.replace('~', ''), sure: !al.startsWith('~')};
  const words = n.split(' ').filter(w => w.length > 2);
  const cand = EX.filter(e => { const en = normName(e.name); return en.endsWith(' ' + n) || en.startsWith(n + ' ') || (words.length > 1 && words.every(w => en.includes(w))); });
  if (cand.length) return {status: 'suggest', id: cand.sort((a, b) => a.name.length - b.name.length)[0].id, sure: false};
  return {status: 'none', id: null, sure: false};
}
/* how an old exercise was really done, read from its equipment text and name ("Db", "Cable number 10", "Sitting row machine") */
function oldToType(o) {
  const eq = String(o.equipment || '').toLowerCase(), nm = normName(o.name), all = eq + ' ' + nm, tm = o.trackingMode;
  const t = (logType, variant, sure = true) => ({logType, variant, sure});
  if (tm === 'cardio') return t('cardio', /stair/.test(all) ? 'stairs' : /\brow/.test(all) ? 'row' : /bike|cycl/.test(all) ? 'bike' : /walk/.test(all) ? 'walk' : /\brun|jog/.test(all) ? 'run' : /ellip/.test(all) ? 'elliptical' : /rope|skip/.test(all) ? 'rope' : /ski/.test(all) ? 'ski' : '');
  if (/smith/.test(all)) return t('barbell', 'smith');
  if (/k[ae]t+l?e?bell|\bkb\b/.test(all)) return t('rack', 'kettlebell');
  if (/\bdb\b|dumbbel/.test(all)) return t('rack', 'dumbbell');
  if (tm === 'bodyweight' || eq === 'bodyweight' || /pull up|chin up|\bdip\b|push up|back extension/.test(nm)) return t('bodyweight', '');
  if (/cable|pulldown|pull down|lat pull|pushdown|face pull|crossover/.test(all)) return t('machine', 'stack');
  if (/leg press|hack squat|sled|plate.?loaded|hip thrust machine/.test(all)) return t('machine', 'plates');
  if (/machine|pec deck|peck|leg curl|leg extension|abduct|adduct/.test(all)) return t('machine', 'stack');
  if (/\bband\b/.test(eq)) return t('band', '');
  if (/barbell|\bbar\b|\bez\b/.test(all)) return t('barbell', /\bez\b/.test(all) ? 'ez' : 'olympic');
  if (eq === 'none') return t('bodyweight', '', false);
  return t('rack', 'dumbbell', false); /* nothing to go on: a dumbbell is the most common free weight */
}
/* free-text equipment that says more than "cable" or "machine" (a cable number, a grip, a bench angle) becomes the pinned note */
const FILLER = new Set(['machine', 'cable', 'sitting', 'seated', 'standing', 'dumbbell', 'db', 'bench', 'band', 'barbell', 'bodyweight', 'none', 'kettlebell']);
function setupNote(o) {
  const raw = String(o.equipment || '').trim(); if (!raw) return '';
  if (/[0-9|\\/,]/.test(raw)) return raw.slice(0, 140);
  const nameW = new Set(normName(o.name).split(' '));
  const extra = normName(raw).split(' ').filter(w => w && !FILLER.has(w) && !nameW.has(w));
  return extra.join('').length >= 3 ? raw.slice(0, 140) : '';
}
/* read and check an old backup (or the old app's own storage); returns a plan for the review screen */
function planOldImport(d) {
  if (!d || typeof d !== 'object') throw new Error('This file is not a LIFT backup.');
  if (d.workouts !== undefined && !Array.isArray(d.workouts)) throw new Error('"workouts" in this file is not a list.');
  const workouts = (d.workouts || []).filter(w => w && typeof w === 'object' && typeof w.id === 'string' && typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && Array.isArray(w.exercises));
  const oldEx = {};
  for (const e of (Array.isArray(d.exercises) ? d.exercises : [])) if (e && typeof e.id === 'string' && typeof e.name === 'string') oldEx[e.id] = e;
  const used = {};
  let sets = 0;
  for (const w of workouts) for (const x of w.exercises) {
    if (!x || typeof x.exId !== 'string' || !Array.isArray(x.sets)) continue;
    const real = x.sets.filter(s => s && typeof s === 'object' && (s.reps || s.lReps || s.rReps || s.duration || s.distance));
    if (!real.length) continue;
    const u = used[x.exId] || (used[x.exId] = {workouts: new Set(), sets: 0, lr: 0, dist: 0});
    u.workouts.add(w.id); u.sets += real.length; sets += real.length;
    u.lr += real.filter(s => s.lReps || s.rReps).length; u.dist += real.filter(s => s.distance).length;
  }
  const list = Object.keys(used).map(id => {
    const o = oldEx[id] || oldDefault(id) || {id, name: id};
    const m = matchOldName(o.name), keepAs = oldToType(o), b = m.id ? EX.find(e => e.id === m.id) : null;
    let status = m.status, why = '';
    /* the name matches, but the old equipment says otherwise (a hip thrust machine is not a barbell hip thrust) */
    /* the old app had no timed or band type, so its "bodyweight" fits either */
    const fits = b && (b.logType === keepAs.logType || (keepAs.logType === 'bodyweight' && ['timed', 'band'].includes(b.logType)));
    if (b && keepAs.sure && !fits) { status = 'suggest'; why = `you logged it as ${TYPE_LABEL[keepAs.logType].toLowerCase()}${o.equipment ? ' (' + String(o.equipment).slice(0, 40) + ')' : ''}`; }
    const choice = !b ? 'keep' : status === 'auto' ? 'map' : (m.sure && !why && !VARIANT_NAME.test(o.name)) ? 'map' : 'keep';
    return {oldId: id, name: o.name, old: o, workouts: used[id].workouts.size, sets: used[id].sets, lr: used[id].lr, dist: used[id].dist,
      match: Object.assign({}, m, {status}), why, choice, mapTo: m.id, keepAs, note: setupNote(o)};
  }).sort((a, b) => b.sets - a.sets);
  const dates = workouts.map(w => w.date).sort();
  const lbs = d.settings && d.settings.unit === 'lbs';
  return {kind: 'lift5', workouts, oldEx, exercises: list, sets, from: dates[0], to: dates[dates.length - 1],
    templates: Array.isArray(d.templates) ? d.templates.filter(t => t && typeof t.name === 'string' && Array.isArray(t.exercises)) : [], lbs};
}
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
/* turn the reviewed plan into LIFT 2 records */
function convertOldImport(plan, uid) {
  const k = plan.lbs ? 0.45359237 : 1, kg = v => v ? +(num(v) * k).toFixed(2) : 0;
  const custom = [], prefs = [], idFor = {};
  for (const x of plan.exercises) {
    if (x.choice === 'map' && x.mapTo) {
      idFor[x.oldId] = x.mapTo;
      /* keep how it was really done: one side at a time, reps instead of distance, the set-up note */
      const b = EX.find(e => e.id === x.mapTo), fields = {};
      if (b && x.lr && !b.unilateral) fields.unilateral = true;
      if (b && b.distance && !x.dist) fields.distance = false;
      if (Object.keys(fields).length || x.note) { const pr = prefs.find(p => p.id === x.mapTo); if (pr) { Object.assign(pr.fields, fields); if (!pr.note) pr.note = x.note; } else prefs.push({id: x.mapTo, fields, note: x.note || ''}); }
      continue;
    }
    const o = x.old || {};
    const id = 'c_' + normName(x.name).replace(/ /g, '-').slice(0, 40) + '_' + x.oldId.replace(/[^a-z0-9]/gi, '').slice(-6);
    const muscle = MUSCLES.includes(o.muscle) ? o.muscle : (o.muscle === 'cardio' || x.keepAs.logType === 'cardio' ? 'cardio' : 'core');
    custom.push({id, name: String(x.name).slice(0, 60), logType: x.keepAs.logType, variant: x.keepAs.variant, primary: muscle,
      secondary: (o.secondary || []).filter(m => MUSCLES.includes(m) && m !== muscle), unilateral: o.lateral === 'unilateral' || x.lr > 0, distance: false, custom: true, note: x.note || '', fromOld: x.oldId});
    idFor[x.oldId] = id;
  }
  const exOf = id => resolveExercise(id, custom, prefs);
  const workouts = [], weighins = {};
  for (const w of plan.workouts) {
    const end = num(w.ts) || parseDate(w.date).getTime() + 19 * 3600e3;
    const mins = num(w.duration);
    const bw = num(w.bodyweight) * k;
    const items = [];
    for (const x of w.exercises) {
      const exId = x && idFor[x.exId]; if (!exId) continue;
      const e = exOf(exId);
      const sets = (x.sets || []).filter(s => s && typeof s === 'object' && (s.reps || s.lReps || s.rReps || s.duration || s.distance)).map(s => {
        const o = {id: uid('s'), type: s.type === 'warmup' ? 'warmup' : ['drop', 'failure'].includes(s.type) ? s.type : 'working', done: true, note: typeof s.note === 'string' ? s.note.slice(0, 500) : ''};
        if (e.logType === 'cardio') {
          /* the old "pace" box: minutes per km on runs, the level on a StairMaster or air bike */
          let min = num(s.duration); const km = num(s.distance), pace = num(s.pace);
          if (!min && km && pace) min = km * pace;
          o.sec = Math.round(min * 60); o.m = Math.round(km * 1000);
          if (pace && ['stairs', 'airbike'].includes(e.variant)) o.level = pace;
          else if (pace && num(s.duration)) o.note = [o.note, `old pace box: ${String(s.pace).slice(0, 10)}`].filter(Boolean).join(', ');
        }
        else if (e.logType === 'timed') { o.sec = num(s.duration) ? Math.round(num(s.duration) * 60) : num(s.reps); o.add = kg(s.weight); }
        else if (e.logType === 'bodyweight') { if (e.unilateral) { o.l = num(s.lReps) || num(s.reps); o.r = num(s.rReps) || num(s.reps); } else o.reps = num(s.reps) || Math.max(num(s.lReps), num(s.rReps)); o.add = kg(s.weight); o.bw = bw || 0; o.mode = o.add ? 'added' : 'plain'; }
        else if (e.logType === 'band') { o.band = 'medium'; o.reps = num(s.reps) || Math.max(num(s.lReps), num(s.rReps)); }
        else { o.kg = kg(s.weight); if (e.unilateral) { o.l = num(s.lReps) || num(s.reps); o.r = num(s.rReps) || num(s.reps); } else o.reps = num(s.reps) || Math.max(num(s.lReps), num(s.rReps)); }
        return o;
      });
      if (sets.length) items.push({uid: uid('i'), exId, sets});
    }
    if (!items.length) continue;
    workouts.push({id: w.id, date: w.date, title: typeof w.title === 'string' && w.title.trim() ? w.title.trim().slice(0, 80) : 'Workout', note: typeof w.note === 'string' ? w.note.slice(0, 2000) : '',
      start: mins ? end - mins * 60000 : end - 3600e3, end, items, imported: 'lift5'});
    if (bw) { const wk = weekStartOf(w.date); if (!weighins[wk] || weighins[wk].date < w.date) weighins[wk] = {id: 'bw_' + w.date, date: w.date, kg: +bw.toFixed(1)}; }
  }
  const templates = plan.templates.map(t => ({id: 'tpl_' + String(t.id || t.name).replace(/[^a-z0-9_]/gi, ''), name: String(t.name).slice(0, 60),
    items: t.exercises.filter(x => x && idFor[x.exId]).map(x => ({exId: idFor[x.exId], sets: Math.max(1, Math.min(10, num(x.targetSets) || 3)), reps: 0, link: false}))})).filter(t => t.items.length);
  return {workouts, exercises: custom, prefs, templates, weighins: Object.values(weighins)};
}
/* fit the equipment settings to what the history shows (a 2.5 kg dumbbell rack, a 10 kg kettlebell) */
function fitEquipment(out, st) {
  const exOf = id => resolveExercise(id, out.exercises, out.prefs || []);
  const db = [], kb = new Set();
  for (const w of out.workouts) for (const it of w.items) { const e = exOf(it.exId); if (!e || e.logType !== 'rack') continue; for (const s of it.sets) if (s.kg) { if (e.variant === 'dumbbell') db.push(+s.kg); if (e.variant === 'kettlebell') kb.add(+s.kg); } }
  const patch = {}, notes = [];
  if (db.length >= 10) {
    const on25 = db.filter(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-9).length / db.length, on2 = db.filter(v => v % 2 === 0).length / db.length;
    if (on25 >= .8 && on2 < .8 && st.steps.dumbbell !== 2.5) { patch.steps = Object.assign({}, st.steps, {dumbbell: 2.5}); patch.dbMin = 2.5; notes.push('dumbbells in 2.5 kg steps'); }
    const mx = Math.max(...db); if (mx > st.dbMax) { patch.dbMax = Math.ceil(mx / 2.5) * 2.5; notes.push(`dumbbells up to ${patch.dbMax} kg`); }
  }
  const add = [...kb].filter(v => !st.kettlebells.includes(v)).sort((a, b) => a - b);
  if (add.length) { patch.kettlebells = st.kettlebells.concat(add).sort((a, b) => a - b); notes.push(`kettlebell${add.length > 1 ? 's' : ''} ${add.join(', ')} kg added`); }
  return {patch, notes};
}

/* ---------- starter templates (first run) ---------- */
const STARTERS = [
  {id:'start_push', name:'Push', note:'Chest, shoulders, triceps', items:[['bench-press',4,6],['overhead-press',3,8],['incline-dumbbell-press',3,10],['lateral-raise',3,12],['triceps-pushdown',3,12]]},
  {id:'start_pull', name:'Pull', note:'Back, biceps, rear delts', items:[['deadlift',3,5],['pull-up',3,8],['barbell-row',3,8],['face-pull',3,15],['barbell-curl',3,10]]},
  {id:'start_legs', name:'Legs', note:'Quads, hamstrings, glutes, calves', items:[['back-squat',4,5],['romanian-deadlift',3,8],['leg-press',3,12],['lying-leg-curl',3,12],['standing-calf-raise',3,15]]},
  {id:'start_full', name:'Full body', note:'The big lifts, one each', items:[['back-squat',3,5],['bench-press',3,6],['barbell-row',3,8],['overhead-press',3,8],['plank',3,0]]},
];
function starterTemplates() { return STARTERS.map(t => ({id: t.id, name: t.name, note: t.note, starter: true, items: t.items.map(([exId, sets, reps]) => ({exId, sets, reps, link: false}))})); }

const api = {EX, CARDIO, PLATE_COLORS, ALL_PLATES, KB_COLORS, MUSCLES, RANGES, TYPE_LABEL, VARIANT_LABEL, PR_LABEL,
  defaultSettings, mergeSettings, fmt, fmtThousands, mmss, localDate, parseDate, addDays, daysBetween, weekStartOf, isoWeek, roundTo, byDate,
  pairDefault, defaultRest, resolveExercise, plateSet, splitPlates, barFor, machineFor, stepFor, minFor, dumbbellRange, snapWeight,
  isReal, hasData, setReps, setTotalReps, setWeight, setVolume, e1rm, warmups, dropWeight, computePRs, workoutSummary, muscleSets, weekWorkouts,
  suggestion, cardioFields, cardioDerived, normName, matchOldName, oldToType, planOldImport, convertOldImport, fitEquipment, starterTemplates, OLD_DEFAULTS};
root.L = api;
if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
