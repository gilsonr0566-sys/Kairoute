// Group trips check (Richard, Nov 21 2026). Runs the built app in three phones (the trip's owner and two members)
// against the REAL group code of Kairoute's helper (worker/extras.js, its Group class with a stand-in for its storage),
// so the app and the helper are checked together. Nothing reaches the live helper. General rules, any trip:
//  - share: only the trip the owner picks is sent; their other trips never leave the phone;
//  - join: the code or the link opens the group trip on the member's phone;
//  - follow: a member following the group plan gets the same plan as the owner, and owner changes reach them;
//  - own day: a member who makes a day their own keeps their own sights when the owner's plan changes;
//  - meeting point: on every day of the trip, an own day (emptied, over-filled, or a copy) ends at the same place as
//    the group's plan, never after the group's meeting time; a change to the day's times reaches own days too;
//  - offer: a member offers their day, the owner uses it for everyone (followers get it), and undo puts it back;
//  - booked tour: a day the owner marks as a booked tour plans no sights for followers.
// Usage: node tools/beta2/group-check.cjs [beta2-site/index.html] [screenshot-dir]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'beta2-site', 'index.html')), SHOTS = process.argv[3] || '';
const W = 'https://mock-helper.example';
const fails = [], ok = m => console.log('  ok  ' + m), bad = m => { fails.push(m); console.log('  FAIL ' + m); };
const check = (c, m, why) => c ? ok(m) : bad(m + (why ? ' (' + why + ')' : ''));

// The helper's real group code, with an in-memory stand-in for a Durable Object's storage.
function fakeStorage() {
  const m = new Map();
  return {
    async get(k) { if (Array.isArray(k)) { const o = new Map(); k.forEach(x => { if (m.has(x)) o.set(x, structuredClone(m.get(x))); }); return o; } return m.has(k) ? structuredClone(m.get(k)) : undefined; },
    async put(k, v) { if (typeof k === 'object') { for (const x in k) m.set(x, structuredClone(k[x])); } else m.set(k, structuredClone(v)); },
    async delete(k) { m.delete(k); }, async deleteAll() { m.clear(); }
  };
}
let extras, sent = [];
const objs = new Map();
const env = { GROUPS: { idFromName: n => n, get: id => { if (!objs.has(id)) objs.set(id, new extras.Group({ storage: fakeStorage() })); const o = objs.get(id); return { fetch: (u, init) => o.fetch(new Request(u, init)) }; } } };
async function helper(url, method, body) {
  const u = new URL(url);
  if (u.pathname === '/status') return { status: 200, body: JSON.stringify({ ok: true, on: false }) };
  if (u.pathname !== '/x/group') return { status: 404, body: '{"error":"nf"}' };
  if (body) sent.push(body);
  const req = new Request(url, method === 'POST' ? { method: 'POST', body, headers: { 'content-type': 'application/json' } } : {});
  const r = await extras.extras(req, env, { waitUntil() {} }, u, {}, { origin: null, ALLOWED: [] });
  return { status: r.status, body: await r.text() };
}
async function phone(b, w, h, hash) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('b2:kairoute.intro1', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await ctx.route('**/*', async r => {
    const url = r.request().url();
    if (/^file:/.test(url)) return r.continue();
    if (/\/ai\.json$/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: W }) });
    if (url.startsWith(W)) { const o = await helper(url, r.request().method(), r.request().postData()); return r.fulfill({ status: o.status, contentType: 'application/json', body: o.body, headers: { 'access-control-allow-origin': '*' } }); }
    return r.abort();
  });
  await p.goto('file://' + FILE + (hash || '')); await p.waitForTimeout(2500);
  return p;
}
const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
// The plan of day i as a list of its stops (ids) and where/when it ends.
const planOf = (p, i) => p.evaluate(i => { const T = window.__kairouteGrpT, trip = T.trip, buildPlan = T.buildPlan; const d = trip.days[i], pl = buildPlan(d); const m = window.__kairouteGroup.meet(i); return { stops: (pl.stops || []).map(s => String(s.place.id)), end: pl.end, endBy: pl.endBy, meet: m, sel: d.selected, own: !!d.grpOwn, tour: !!d.grpTour, hours: d.hours, meals: (pl.items || []).filter(x => x.type === 'meal').length }; }, i);
const openDay = (p, i) => p.evaluate(i => { const T = window.__kairouteGrpT; T.trip.active = i; T.view = 'plan'; T.render(); window.scrollTo(0, 0); document.querySelectorAll('.pane').forEach(e => { e.scrollTop = 0; }); }, i);
const pollMember = async p => { const was = await p.evaluate(() => (window.__kairouteGroup.state() || {}).tripRev); await p.evaluate(() => window.__kairouteGroup.poll());
  for (let k = 0; k < 40; k++) { const now = await p.evaluate(() => (window.__kairouteGroup.state() || {}).tripRev); if (now !== was) break; await p.waitForTimeout(250); await p.evaluate(() => window.__kairouteGroup.poll()); }
  await settle(p); };
// Waits until the app has finished changing the open trip (two reads of its days the same, half a second apart).
const settle = async p => { let a = ''; for (let k = 0; k < 20; k++) { const b = await p.evaluate(() => JSON.stringify(window.__kairouteGrpT.trip.days.map(d => [d.selected, d.hours]))); if (b === a) return; a = b; await p.waitForTimeout(500); } };
const pushLead = async p => { await p.evaluate(() => window.__kairouteGroup.push()); await p.waitForTimeout(400); };

(async () => {
  extras = await import(path.resolve(__dirname, '..', '..', 'worker', 'extras.js'));
  const b = await chromium.launch();
  const lead = await phone(b, 1280, 800);
  // The owner has a second, private trip: it must never be sent.
  await lead.evaluate(() => { const T = window.__kairouteGrpT; const t = JSON.parse(JSON.stringify(T.trip)); t.id = 'private-trip'; t.name = 'PRIVATE-TRIP-NAME'; T.storeInLibrary(); T.library.push({ id: t.id, name: t.name, updated: Date.now(), trip: t }); T.save(); T.view = 'settings'; T.setSec = 'group'; T.render(); });
  await shot(lead, 'tablet-group-pick-trip');
  const pick = await lead.$$eval('[data-grp="lead"]', bs => bs.map(x => x.dataset.trip));
  check(pick.length >= 2, 'the owner picks which trip to share (' + pick.length + ' trips offered)');
  const shareId = await lead.evaluate(() => window.__kairouteGrpT.trip.id);
  await lead.click(`[data-grp="lead"][data-trip="${shareId}"]`); await lead.waitForTimeout(800);
  const g = await lead.evaluate(() => window.__kairouteGroup.state());
  check(g && g.code && g.role === 'lead' && g.tripId === shareId, 'sharing gives a code for that trip', JSON.stringify(g));
  await shot(lead, 'tablet-group-code');
  check(!sent.some(x => x.includes('PRIVATE-TRIP-NAME')), 'the owner\'s other trip is never sent');

  console.log('Join');
  const m1 = await phone(b, 412, 915, '#join=' + g.code), m2 = await phone(b, 412, 915);
  await m2.evaluate(c => { const T = window.__kairouteGrpT; T.view = 'settings'; T.setSec = 'group'; T.render(); document.getElementById('grp-code').value = c; }, g.code.slice(0, 3) + '-' + g.code.slice(3));
  await m2.click('[data-grp="join"]'); await m2.waitForTimeout(800);
  for (const [p, n] of [[m1, 'link'], [m2, 'code']]) {
    const s = await p.evaluate(() => { const T = window.__kairouteGrpT, trip = T.trip; return { id: trip.id, n: trip.days.length, lib: T.library.map(x => x.name).join('|'), journal: Object.keys(trip.journal || {}).length }; });
    check(s.id === 'grp-' + g.code, `joining by ${n} opens the group trip`, s.id);
    check(!/PRIVATE-TRIP-NAME/.test(s.lib), `a member joining by ${n} never gets the owner's other trips`);
  }
  await m1.evaluate(() => window.__kairouteGroup.hello()); await m2.evaluate(() => window.__kairouteGroup.hello());

  // Days with sights: land and port days with a guide.
  const days = await lead.evaluate(() => { const T = window.__kairouteGrpT; return T.trip.days.map((d, i) => ({ i, ok: !T.noShore(d) && !!T.cityFor(d) && /^(land|port)$/.test(d.type) })).filter(x => x.ok).map(x => x.i); });
  check(days.length >= 3, 'the trip has days to plan (' + days.length + ')');
  const D = days[0], D2 = days[1];

  console.log('Follow the group plan');
  for (const i of days) {
    const a = await planOf(lead, i), c = await planOf(m2, i);
    if (a.stops.join() !== c.stops.join() || a.end !== c.end) { bad(`day ${i}: a member following the group gets a different plan (${a.stops.join()} vs ${c.stops.join()})`); }
  }
  ok('every day a member follows is the owner\'s plan (' + days.length + ' days)');
  await openDay(m1, D); await shot(m1, 'phone-group-follow-day');
  check(await m1.$('[data-grpday="follow"]'), 'a following member sees "Following the group\'s plan" and "Make my own day"');

  console.log('Make my own day');
  await m1.click('[data-grp="ownday"]'); await m1.waitForTimeout(500);
  check(await m1.evaluate(() => window.__kairouteGrpT.view === 'sites' && !!window.__kairouteGrpT.day().grpOwn), 'Make my own day opens Choose sights for that day');
  // Before any tick, the own day is the group's plan as it was, kept as the member's own list (Nov 22 gate: still marked
  // as the app's seeding, its sights were swapped by the planner when the owner's day changed).
  { const a = await planOf(lead, D), c = await planOf(m1, D);
    check(c.stops.join() === a.stops.join() && await m1.evaluate(() => !!window.__kairouteGrpT.day().ownList), 'Make my own day starts from the group\'s sights, kept as the member\'s own list', `${a.stops} / ${c.stops}`); }
  const box = await m1.$('input[data-site]:not(:checked)');
  if (box) { await box.click().catch(() => {}); await m1.waitForTimeout(400); }
  const own1 = await planOf(m1, D);
  check(own1.own && box, 'the member ticks a sight of their own');
  await openDay(m1, D); await shot(m1, 'phone-group-own-day');
  check(await m1.$('[data-grpday="own"]'), 'an own day says "Your own day" and where the group meets');

  console.log('Meeting point on every day (own days end where and when the group does)');
  let meetBad = 0, meetN = 0;
  for (const i of days) {
    const g0 = await planOf(lead, i);
    for (const kind of ['copy', 'empty', 'all']) {
      const r = await m2.evaluate(([i, kind]) => {
        const T = window.__kairouteGrpT, trip = T.trip, buildPlan = T.buildPlan, allSites = T.allSites, cityFor = T.cityFor; const d = trip.days[i], keep = JSON.parse(JSON.stringify(d)); d.grpOwn = true;
        if (kind === 'empty') { d.selected = []; d.cleared = true; } if (kind === 'all') { d.selected = allSites(cityFor(d)).map(x => x.id); d.ownList = true; delete d.cleared; }
        let out; try { const pl = buildPlan(d), m = window.__kairouteGroup.meet(i); out = { end: pl.end, meet: m, err: pl.error || null }; } catch (e) { out = { err: e.message }; }
        trip.days[i] = keep; return out;
      }, [i, kind]);
      meetN++;
      if (r.err) { meetBad++; bad(`day ${i} ${kind}: ${r.err}`); continue; }
      if (!g0.meet || !r.meet) continue;
      if (r.meet.where !== g0.meet.where || r.meet.time !== g0.meet.time) { meetBad++; bad(`day ${i} ${kind}: own day meets at ${r.meet.where} ${r.meet.time}, the group at ${g0.meet.where} ${g0.meet.time}`); }
      if (r.meet.known && r.end > r.meet.time) {
        // The plan may not end late without saying so: the card names the overrun.
        meetBad++; bad(`day ${i} ${kind}: own day ends ${r.end - r.meet.time} min after the group meets`);
      }
    }
  }
  check(!meetBad, `own days meet the group at the same place, never late (${meetN} day plans)`);

  console.log('The owner changes the plan');
  await settle(m1); const before1 = await planOf(m1, D);
  await openDay(lead, D);
  await lead.evaluate(i => { const T = window.__kairouteGrpT, buildPlan = T.buildPlan; const d = T.trip.days[i]; const pl = buildPlan(d); const ids = (pl.stops || []).map(s => s.place.id); d.selected = ids.slice(0, Math.max(1, ids.length - 1)); d.ownList = true; d.hours = Math.max(5, (+d.hours || 8) - 1); T.save(); }, D);
  await pushLead(lead); await pollMember(m2); await pollMember(m1);
  const L = await planOf(lead, D), F = await planOf(m2, D), O = await planOf(m1, D);
  check(L.stops.join() === F.stops.join() && L.end === F.end, 'a following member gets the owner\'s changed plan', `${L.stops} / ${F.stops}`);
  // The owner's shorter day reaches the own day too, so the app may take off an own sight that no longer fits: every
  // sight left must be one the member had, never one the owner's plan brought in.
  const had = new Set((before1.sel || []).map(String)), extra = (O.sel || []).map(String).filter(x => !had.has(x));
  check(O.own && !extra.length && (O.sel || []).length > 0, 'an own day keeps the member\'s own sights when the owner changes theirs', `had ${[...had]}, now ${O.sel}, owner ${L.sel}`);
  check(O.hours === L.hours && (!O.meet || !L.meet || (O.meet.time === L.meet.time && O.meet.where === L.meet.where)), 'a change to the day\'s hours reaches own days too (same meeting time)', `${O.hours}/${L.hours}`);
  check(!O.meet || !O.meet.known || O.end <= O.meet.time, 'the own day still ends by the new meeting time');

  console.log('Offer a day to the group');
  await openDay(m1, D); await m1.fill('#grp-me', 'Sam').catch(() => {}); await m1.click('[data-grp="offer"]'); await m1.waitForTimeout(500);
  await lead.evaluate(() => window.__kairouteGrpLeadPoll()); await lead.waitForTimeout(600);
  await openDay(lead, D); await shot(lead, 'tablet-group-offer');
  const off = await lead.$('[data-grp="useoffer"]');
  check(off, 'the owner sees the offered day with "Use it for everyone"');
  check(/Sam/.test(await lead.$eval('[data-grpday]', e => e.innerText).catch(() => '')), 'the offer names who it is from');
  if (off) {
    const prev = (await planOf(lead, D)).sel;
    await off.click(); await lead.waitForTimeout(400);
    const after = await planOf(lead, D);
    check(JSON.stringify(after.sel) === JSON.stringify(O.sel), 'the owner\'s day now has the member\'s sights');
    check(after.hours === L.hours && (!after.meet || after.meet.time === L.meet.time), 'the swapped-in day keeps the group\'s meeting time');
    await pushLead(lead); await pollMember(m2);
    const f2 = await planOf(m2, D);
    check(f2.stops.join() === after.stops.join(), 'followers get the swapped-in day');
    const o2 = await planOf(m1, D); check(o2.own, 'the member who offered it keeps their own day');
    await lead.click('[data-grp="undoday"]'); await lead.waitForTimeout(300);
    const und = await planOf(lead, D);
    check(JSON.stringify(und.sel) === JSON.stringify(prev), 'undo puts the group\'s earlier plan back');
  }

  console.log('Back to the group plan');
  await openDay(m1, D); await m1.click('[data-grp="follow"]'); await m1.waitForTimeout(300);
  await pushLead(lead); await pollMember(m1);
  const back = await planOf(m1, D), lnow = await planOf(lead, D);
  check(!back.own && back.stops.join() === lnow.stops.join(), 'Back to the group\'s plan gives the owner\'s plan again');

  console.log('Booked tour with the group');
  await openDay(lead, D2);
  await lead.evaluate(() => { const det = document.querySelector('details.planmore'); if (det) det.open = true; });
  const tb = await lead.$('[data-grp="tourday"]'); check(tb, 'the owner can mark a day as a booked tour');
  if (tb) { await tb.click(); await lead.waitForTimeout(300); }
  await pushLead(lead); await pollMember(m2);
  const tz = await planOf(m2, D2);
  check(tz.tour && tz.stops.length === 0 && tz.meals === 0, 'a booked tour day plans no sights and no lunch for followers', JSON.stringify([tz.stops, tz.meals]));
  await openDay(m2, D2); await shot(m2, 'phone-group-booked-tour');
  const L2 = await planOf(lead, D2);
  check(!L2.meet || !tz.meet || L2.meet.time === tz.meet.time, 'the booked tour day keeps the meeting point');

  console.log('Leader sees who planned their own day');
  await m2.evaluate(i => { const T = window.__kairouteGrpT; T.trip.days[i].grpOwn = true; T.save(); return window.__kairouteGroup.hello(); }, D); await m2.waitForTimeout(300);
  await lead.evaluate(() => window.__kairouteGrpLeadPoll()); await lead.waitForTimeout(500);
  const st = await lead.evaluate(() => window.__kairouteGroup.state());
  check(st.members === 2 && (st.ownDays || {})[await lead.evaluate(i => window.__kairouteGrpT.trip.days[i].id, D)] === 1, 'the owner sees 2 members, 1 on their own day', JSON.stringify([st.members, st.ownDays]));
  await openDay(lead, D); await shot(lead, 'tablet-group-day-lead');
  await openDay(m1, D); await m1.setViewportSize({ width: 412, height: 915 });

  check(!sent.some(x => x.includes('PRIVATE-TRIP-NAME')), 'after all of it, the owner\'s other trip was never sent');
  for (const [p, n] of [[lead, 'owner'], [m1, 'member 1'], [m2, 'member 2']]) check(!p.errs.length, n + ': no page errors', p.errs.join(' | '));
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nGroup trips check passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
