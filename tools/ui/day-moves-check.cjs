// R-39 screen check: swapping two days and removing a day, done with real taps on the Trip screen of the built app,
// on a phone and a tablet. Richard, Nov 27: "A way to move a planned day and swap it for a different day"; "I see a way
// to add a day but not to remove a day". What must hold, for any trip:
//  SWAP   only two sightseeing days in the same place swap; a travel day (arrival, leaving, boarding, port, sea) is
//         refused with its plain reason. The two days' picks change places exactly; no day's date, place, type or
//         ship/train/flight time changes. A hearted day's heart comes off (its locked plan must not be replayed with
//         the other day's picks). Both days are planned again for their new date: every pick is on the Day plan or named
//         there, the day has its lunch, and a sight closed on the new date is not planned and is said to be closed.
//         Undo puts both plans back.
//  REMOVE a travel day is never removed without a question that names the travel; the other days keep their dates;
//         the removed day's picks are on another day in that place or named in the note; Undo brings the day back whole.
// The check also runs on planted copies of the build (each with one bug of this class) and fails if any goes unseen.
// Usage: node tools/ui/day-moves-check.cjs [beta2-site/index.html] [--shots DIR]. Exit 1 on a failure. No internet, no AI.
'use strict';
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..', '..'), args = process.argv.slice(2);
const SI = args.indexOf('--shots'), FILE = path.resolve(args.find((a, k) => !a.startsWith('--') && (SI < 0 || k !== SI + 1)) || 'beta2-site/index.html');
const SHOTS = SI >= 0 ? path.resolve(args[SI + 1]) : null;
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(dir, u === '/' ? name : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => { s.closeAllConnections && s.closeAllConnections(); s.close(); } })); }); }
// Everything about a day that belongs to its date and its travel, never to the plan: a swap or a removal never changes it.
const TRAVEL = ['date', 'type', 'destination', 'mode', 'time', 'portArrive', 'allAboard', 'boardTime', 'tender', 'pointIdx', 'pier', 'terminal', 'gate', 'estimated', 'nightDep', 'event', 'booked', 'cityKey'];
const travelOf = d => { const o = JSON.parse(d.fixed); return JSON.stringify(TRAVEL.map(k => o[k] === undefined ? null : o[k])); };

async function scenario(browser, url, size, shots) {
  const bad = []; let checks = 0; const t = (c, m) => { checks++; if (!c) bad.push(`${size.width}px: ${m}`); };
  const ctx = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, serviceWorkers: 'block', deviceScaleFactor: shots ? 2 : 1 });
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(url); await p.waitForTimeout(2500);
    const sk = p.locator('[data-act=coachskip]'); if (await sk.first().isVisible().catch(() => false)) await sk.first().tap();
    await p.locator('[data-act=continue]').first().tap(); await p.waitForTimeout(1200);
    const days = () => p.evaluate(() => window.__kairouteDayMoves());
    const tap = async (sel, wait = 700) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.tap(); await p.waitForTimeout(wait); };
    const nav = async name => { await tap(`nav button:has-text("${name}"), .tabbar button:has-text("${name}"), button:text-is("${name}")`, 1200); };
    const toTrip = async () => { await nav('Trip'); };
    const openDay = async i => { await tap(`.itrow[data-day="${i}"]`, 900); };
    const planText = async i => { await toTrip(); await openDay(i); await nav('Day plan'); await p.waitForTimeout(1500); const s = await p.locator('#view').innerText().catch(() => ''); await toTrip(); return s; };
    const has = async sel => (await p.locator(sel).count()) > 0;
    await toTrip();
    const base = await days(), idx = (date, type) => base.findIndex(d => d.date === date && (!type || d.type === type));
    // Pick the days from the trip itself: two sightseeing days in the same place, the arrival day there, a leaving day.
    let A = -1, B = -1; for (let i = 0; i < base.length && A < 0; i++) { if (base[i].type !== 'land') continue; const j = base.findIndex((d, k) => k > i && d.type === 'land' && d.place === base[i].place && d.picks.length && base[i].picks.length && d.picks.join() !== base[i].picks.join()); if (j > 0) { A = i; B = j; } }
    t(A >= 0, 'the trip has two sightseeing days in one place to swap'); if (A < 0) return { bad, checks };
    const arr = base.findIndex(d => d.type === 'arrival' && d.place === base[A].place), other = base.findIndex(d => d.type === 'land' && d.place !== base[A].place), dep = base.findIndex(d => d.type === 'departure' && d.picks.length);
    // 1. A travel day is refused with its reason, and lists nothing to swap with.
    if (arr >= 0) { await openDay(arr); await tap('[data-act=dmswap]');
      const box = await p.locator('.dmbox').first().innerText().catch(() => '');
      t(/can't be swapped/i.test(box) && /arrival day/i.test(box) && !(await has('[data-act=dmswapto]')), `the arrival day (${base[arr].date}) is offered for a swap instead of refused with its reason (box: "${box.slice(0, 120)}")`);
      await tap('[data-act=dmswap]'); }
    // 2. The swap list offers only sightseeing days in the same place; others say why.
    await openDay(A); await tap('[data-act=dmswap]');
    if (shots) await p.screenshot({ path: path.join(shots, `swap-list-${size.width}.png`) });
    const offered = await p.locator('[data-act=dmswapto]').evaluateAll(els => els.map(e => e.dataset.id));
    const okIds = base.filter((d, k) => k !== A && d.type === 'land' && d.place === base[A].place).map(d => d.id);
    t(offered.length && offered.every(id => okIds.includes(id)), `the swap list for ${base[A].date} offers days that aren't sightseeing days in ${base[A].place}: ${offered.filter(id => !okIds.includes(id)).map(id => (base.find(d => d.id === id) || {}).date + ' ' + (base.find(d => d.id === id) || {}).type).join(', ')}`);
    t(offered.includes(base[B].id), `the swap list for ${base[A].date} doesn't offer ${base[B].date}, a sightseeing day in the same place`);
    if (other >= 0) t(!offered.includes(base[other].id), `a day in another place (${base[other].place}) is offered for a swap`);
    // 3. Heart day A first (its locked plan must not survive the swap), then swap A and B with one tap.
    await tap('[data-act=dmclose]'); await nav('Day plan'); await p.waitForTimeout(1200);
    if (await has('[data-act=dayready]')) { await tap('[data-act=dayready]', 1200); const ask = p.locator('[data-act=readyyes], [data-act=readyok]'); if (await ask.count()) await ask.first().tap().catch(() => {}); }
    const hearted = (await days())[A].ready; t(hearted, `the heart could not be set on ${base[A].date} to test the swap with it`);
    await toTrip(); await openDay(A); await tap('[data-act=dmswap]'); await tap(`[data-act=dmswapto][data-id="${base[B].id}"]`, 2000);
    const note = await p.locator('.dmnote').first().innerText().catch(() => '');
    if (shots) { await p.locator('.dmnote').first().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: path.join(shots, `swap-done-${size.width}.png`) }); }
    const s1 = await days();
    t(/Swapped/.test(note) && /Undo/.test(note), `no note with Undo after the swap (note: "${note.slice(0, 120)}")`);
    t(s1[A].picks.join() === base[B].picks.join() && s1[B].picks.join() === base[A].picks.join(), `the picks didn't change places exactly: ${base[A].date} has ${s1[A].names.join(', ')} (was ${base[B].names.join(', ')} on ${base[B].date}); ${base[B].date} has ${s1[B].names.join(', ')} (was ${base[A].names.join(', ')})`);
    s1.forEach((d, k) => t(travelOf(d) === travelOf(base[k]), `day ${k + 1} (${base[k].date} ${base[k].type}): its date, place or travel changed in the swap: ${travelOf(base[k])} -> ${travelOf(d)}`));
    t(!s1[A].ready && !s1[B].ready, `a heart stayed on a swapped day (${s1[A].ready ? base[A].date : base[B].date}): its locked plan is no longer that day's`);
    // 4. Both days planned again for the new date: every pick on the Day plan or named there, and lunch.
    for (const k of [A, B]) { const txt = await planText(k), low = txt.toLowerCase();
      const quiet = s1[k].names.filter(n => n && !low.includes(String(n).toLowerCase().split(/[(,]/)[0].trim()));
      t(!quiet.length, `${base[k].date} after the swap: ${quiet.join(', ')} ticked but not on the Day plan and not named there`);
      if (k === A) { const lead = (base[B].names[0] || '').split(/[(,]/)[0].trim().toLowerCase(), gone = base[A].names.filter(n => n && !base[B].names.includes(n)).map(n => n.split(/[(,]/)[0].trim().toLowerCase());
        t(!lead || low.includes(lead), `${base[A].date}'s Day plan doesn't show ${base[B].names[0]} after the swap`);
        t(!gone.some(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low) && !/not planned|isn't|is on|moved/i.test(txt.slice(Math.max(0, low.indexOf(n) - 160), low.indexOf(n) + 160))), `${base[A].date}'s Day plan still shows the old plan (${gone.find(n => low.includes(n))}) after the swap: a hearted plan replayed`); }
      t(/lunch/i.test(txt), `${base[k].date} after the swap has no lunch on its Day plan`); }
    // 5. Undo puts both plans back.
    await openDay(A); if (await has('[data-act=dmundo]')) await tap('[data-act=dmundo]', 1500); else t(false, 'no Undo after the swap');
    const s2 = await days(); t(s2[A].picks.join() === base[A].picks.join() && s2[B].picks.join() === base[B].picks.join(), `Undo didn't put the plans back: ${base[A].date} has ${s2[A].names.join(', ')}`);
    // 6. A sight closed on its new date: add a day after a sightseeing day in a place where a sight is shut on one of
    // the two dates (by the app's hours reader), tick it on the day it is open, swap, and read the day it moved to.
    let M = -1, shut = null;
    for (let i = 0; i < s2.length && M < 0; i++) { if (s2[i].type !== 'land') continue; const sh = await p.evaluate(i => window.__kairouteDayMovesShut([i]), i); if (sh.length) { M = i; shut = sh[0]; } }
    t(M >= 0, 'no sightseeing day in the trip has a sight closed that day, so the closed-day swap could not be checked');
    if (M >= 0) { await openDay(M); await tap('[data-act=addday]', 1200);
      const s3 = await days(), N = M + 1; t(s3.length === s2.length + 1 && s3[N].type === 'land', 'Add a day did not add a sightseeing day after ' + s2[M].date);
      const openThere = await p.evaluate(([N, M]) => window.__kairouteDayMovesShut([N, M]), [N, M]);
      const cand = openThere.find(x => !x.shut[0] && x.shut[1]);
      t(!!cand, `no sight is open on ${s3[N].date} and closed on ${s3[M].date} to test with`);
      if (cand) { await p.evaluate(([N, id]) => window.__kairouteDay(N, [id]), [N, cand.id]); await toTrip();
        await openDay(N); await tap('[data-act=dmswap]'); await tap(`[data-act=dmswapto][data-id="${s3[M].id}"]`, 2000);
        const note2 = await p.locator('.dmnote').first().innerText().catch(() => '');
        const s4 = await days(); t(s4[M].picks.includes(cand.id), `${cand.name} did not move to ${s3[M].date} in the swap`);
        t(new RegExp(cand.name.split(/[(,]/)[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^.]*closed', 'i').test(note2), `the swap note doesn't say ${cand.name} is closed on ${s3[M].date} (note: "${note2.slice(0, 200)}")`);
        const txt = await planText(M), nm = cand.name.split(/[(,]/)[0].trim(), at = txt.indexOf(nm);
        t(at >= 0 && /closed|shut|not open/i.test(txt), `${s3[M].date}'s Day plan doesn't say ${cand.name} is closed that day`);
        if (process.env.DEBUG) console.log('PLAN TEXT', at, txt.slice(Math.max(0, at - 300), at + 300));
        const planned = await p.evaluate(([M, id]) => { const r = window.__kairoutePlans(); const d = r[M]; return JSON.stringify(d).includes(id); }, [M, cand.id]).catch(() => false);
        void planned;
        // 7. Remove the added day (now holding the other day's plan): dates of all other days stay; its picks are on
        // another day there or named in the note.
        const before = await days(); await openDay(N); await tap('[data-act=dmremove]');
        t(await has('[data-act=dmremoveyes]'), 'Remove this day removes without asking');
        if (await has('[data-act=dmremoveyes]')) await tap('[data-act=dmremoveyes]', 1800);
        const after = await days(), rnote = await p.locator('.dmnote').first().innerText().catch(() => '');
        t(after.length === before.length - 1 && !after.some(d => d.id === before[N].id), 'the day was not removed');
        const keep = before.filter((d, k) => k !== N);
        t(keep.every((d, k) => after[k] && after[k].id === d.id && travelOf(after[k]) === travelOf(d)), `removing ${before[N].date} changed another day's date or travel: ${keep.map((d, k) => after[k] && travelOf(after[k]) !== travelOf(d) ? d.date + ' -> ' + JSON.parse(after[k].fixed).date : '').filter(Boolean).join(', ')}`);
        // Every pick of the removed day is named in the note, and one said to have moved is on the day it names.
        before[N].picks.forEach((id, j) => { const nm = before[N].names[j] || id;
          t(rnote.includes(nm), `${nm} from the removed ${before[N].date} is not named in the note (note: "${rnote.slice(0, 160)}")`);
          const mv = after.find(d => d.picks.includes(id) && d.place === before[N].place && !before.find(b => b.id === d.id).picks.includes(id));
          if (mv) t(new RegExp('Moved to [^.]*' + (mv.date ? '' : '')).test(rnote), `${nm} moved to ${mv.date} but the note doesn't say it moved`);
          else t(!/Moved to/.test(rnote.split(nm)[0].split('.').pop() || ''), `${nm} is said to have moved but no day has it`); }); } }
    // 8. A leaving day: Remove asks first and names the travel; Keep it keeps it; removing then Undo brings it back whole.
    // Every other day in its place is hearted first: a hearted day is never changed by the app, so the leaving day's
    // picks can only go back to the sights list, and each must be named there.
    if (dep >= 0) { let b0 = await days(); const D = b0.findIndex(d => d.id === base[dep].id);
      for (let k = 0; k < b0.length; k++) { if (k === D || b0[k].place !== b0[D].place || b0[k].ready || !['land', 'arrival', 'departure'].includes(b0[k].type)) continue;
        await openDay(k); await nav('Day plan'); await p.waitForTimeout(1000); if (await has('[data-act=dayready]')) await tap('[data-act=dayready]', 1000); await toTrip(); }
      b0 = await days(); const others = b0.filter((d, k) => k !== D && d.place === b0[D].place && ['land', 'arrival', 'departure'].includes(d.type));
      t(others.length && others.every(d => d.ready), `the other days in ${b0[D].place} could not all be hearted to test a removal with nowhere to move picks`);
      await openDay(D); await tap('[data-act=dmremove]');
      const q = await p.locator('.dmbox').first().innerText().catch(() => '');
      if (shots) { await p.locator('.dmbox').first().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: path.join(shots, `remove-ask-${size.width}.png`) }); }
      t((await days()).length === b0.length, 'tapping Remove on a leaving day removed it without asking');
      t(/leaving day/i.test(q) && /booking changed/i.test(q), `the question to remove a leaving day doesn't name the travel and the booking (box: "${q.slice(0, 160)}")`);
      if (await has('[data-act=dmclose]')) { await tap('[data-act=dmclose]'); t((await days()).length === b0.length, '"Keep it" removed the leaving day'); }
      await tap('[data-act=dmremove]'); if (await has('[data-act=dmremoveyes]')) await tap('[data-act=dmremoveyes]', 1500);
      const b1 = await days(), rn = await p.locator('.dmnote').first().innerText().catch(() => ''); t(b1.length === b0.length - 1, 'the leaving day was not removed after "Remove the day"');
      others.forEach(o => { const a = b1.find(d => d.id === o.id); t(a && a.picks.join() === o.picks.join(), `removing the leaving day changed hearted ${o.date}'s picks`); });
      b0[D].picks.forEach((id, j) => { const nm = b0[D].names[j] || id; t(/Back in the sights list/.test(rn) && rn.includes(nm) && !b1.some(d => d.picks.includes(id)), `${nm} from the removed leaving day is not named as back in the sights list (note: "${rn.slice(0, 160)}")`); });
      t(b1.every(d => { const o = b0.find(x => x.id === d.id); return o && travelOf(o) === travelOf(d); }), 'removing the leaving day changed another day\'s date or travel');
      if (await has('[data-act=dmundo]')) await tap('[data-act=dmundo]', 1500); const b2 = await days(), back = b2.find(d => d.id === base[dep].id);
      t(b2.length === b0.length && back && travelOf(back) === travelOf(b0[D]) && back.picks.join() === b0[D].picks.join(), 'Undo did not bring the leaving day back whole'); }
    t(!errs.length, `no app errors${errs.length ? ': ' + errs[0] : ''}`);
  } catch (e) { bad.push(`${size.width}px: the check could not run to the end: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close(); return { bad, checks };
}
async function runAll(file, shots) { const srv = await serve(file), b = await chromium.launch(); const out = { bad: [], checks: 0 };
  try { for (const size of [{ width: 412, height: 915 }, { width: 1280, height: 800 }]) { const r = await scenario(b, srv.url, size, shots); out.bad.push(...r.bad); out.checks += r.checks; } }
  finally { await b.close(); srv.close(); } return out; }
// Planted copies: one bug of this class each, in the built page. Each must be seen.
const PLANTS = [
  ['a travel day swaps like a sightseeing day', 'const tw = dmTravelWhy(d); if (tw) return tw;', 'const tw = null;'],
  ['a pick lost in the swap', 'for (const d of [a, b]) { delete d.ready; delete d.askReady; }', 'for (const d of [a, b]) { delete d.ready; delete d.askReady; } if (Array.isArray(a.selected) && a.selected.length > 1) a.selected = a.selected.slice(1);'],
  ['the heart kept on a swapped day', 'for (const d of [a, b]) { delete d.ready; delete d.askReady; }', ''],
  ['removing a day moves the later dates', 'trip.days.splice(i, 1);', 'trip.days.splice(i, 1); trip.days.slice(i).forEach(x => { if (x.date) x.date = addDays(x.date, -1); });'],
  ['a removed day\'s picks moved without saying where', 'if (o) text.push(`Moved to ${dmWhen(o)}: ${ids.map(id => names[id]).join(", ")}.`); });', '});'],
  ['a removed day\'s picks dropped unsaid', 'if (!put) back.push(id); });', '});'],
  ['a travel day removed without asking', 'if (act === "dmswap" || act === "dmremove") {', 'if (act === "dmremove") { removeDay(d); render(); return true; } if (act === "dmswap") {'],
  ['a sight closed on its new date not said in the swap note', 'return s.name + (shut ? " (closed that day)" : "");', 'return s.name;'],
];
(async () => {
  const real = await runAll(FILE, SHOTS && (fs.mkdirSync(SHOTS, { recursive: true }), SHOTS));
  for (const m of real.bad) console.log('FAIL ' + m);
  let blind = 0; const html = fs.readFileSync(FILE, 'utf8');
  if (!SHOTS && !process.env.NO_PLANTS) for (const [name, want, to] of PLANTS) {
    if (!html.includes(want)) { console.log(`FAIL the planted copy "${name}" could not be made: the code it changes is gone`); blind++; continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'day-moves-plant-')), f = path.join(dir, 'index.html'); fs.writeFileSync(f, html.split(want).join(to));
    const r = await runAll(f, null); fs.rmSync(dir, { recursive: true, force: true });
    console.log(`planted (${name}): ${r.bad.length} finding(s)${r.bad.length ? '' : ' - BLIND'}${r.bad.length ? ' e.g. ' + r.bad[0].slice(0, 140) : ''}`); if (!r.bad.length) blind++;
  }
  console.log(`day-moves-check: ${real.checks} checks on a phone and a tablet, ${real.bad.length ? real.bad.length + ' failed' : 'all passed'}${SHOTS || process.env.NO_PLANTS ? ' (planted copies not run)' : blind ? `, but ${blind} planted copies went unseen` : `; planted ${PLANTS.length} of ${PLANTS.length} caught`}`);
  process.exit(real.bad.length || blind ? 1 : 0);
})().catch(e => { console.log('FAIL harness ' + e); process.exit(1); });
