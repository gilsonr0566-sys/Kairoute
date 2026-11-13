// Live trip features check (part of the safety net, also runs alone: node tools/live-check.cjs [index.html]).
// Uses the example trip, a stand-in server (no network), a fake clock and a fake GPS position to check:
//  - opening hours: no stop is planned outside its hours without a warning; a sight closed that day leaves the
//    plan and moves to an open day in one tap; "book ahead" shows on the Day plan
//  - weather: a rainy forecast offers the indoor swap, the swap uses indoor sights, outdoor stops avoid wet hours
//  - crowds: stops with a busy window show it, and the plan avoids the rush when it can
//  - running late: GPS at a stop well behind schedule re-plans the day from there, keeps the return time, Undo works
//  - back-to-the-ship alarm: live countdown, the bar on other screens, alerts at 30/15/5 minutes
//  - traveler ratings: stars and busy reports reach the server, loved stops rank higher
//  - "What am I looking at?": a photo plus GPS picks a real nearby place and shows its story
const path = require('path'), fs = require('fs');
const MOCK = 'https://mock.kairoute.test';
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

async function run({ chromium, FILE, log, OUT, shots }) {
  const S = 'Live features', K = 'live';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['geolocation'], geolocation: { latitude: 0, longitude: 0 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' && /^live/.test(m.text())) errs.push(m.text()); });
  const posted = [];
  await p.clock.install({ time: new Date('2027-07-06T08:00:00') });
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (/^file:/.test(u)) return r.continue();
    if (u.startsWith(MOCK)) {
      const pth = new URL(u).pathname, body = r.request().postData();
      if (body) posted.push({ pth, body: JSON.parse(body) });
      if (pth === '/rate') return r.fulfill({ json: { ok: true, avg: 4.8, n: 7 } });
      if (pth === '/ratings') return r.fulfill({ json: { ratings: {}, busy: {} } });
      if (pth === '/nearsights') return r.fulfill({ json: { sights: [{ name: 'A fountain nobody has heard of', lat: 0, lng: 0, kind: 'fountain' }] } });
      if (pth === '/identify') { const c = JSON.parse(body).cands; return r.fulfill({ json: { n: 1, sure: 'high', seen: c[0].name } }); }
      if (pth === '/route') return r.fulfill({ json: { routes: [null] } });
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
  await p.getByText('Continue trip').click().catch(() => {}); await p.waitForTimeout(300);
  const days = await p.evaluate(() => window.__kairouteDays());
  const L = (fn, arg) => p.evaluate(fn, arg);
  const shot = async (f, cap) => { await p.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 60 }); shots.push({ f, cap }); };

  // ---- Opening hours: every planned stop is inside its hours, or the Day plan warns ----
  { const bad = []; let known = 0, n = 0;
    for (const D of days) { if (D.type === 'sea' || !D.city) continue;
      await L(i => window.__kairouteTruth(i), D.i); const pl = await L(i => window.__kairouteLiveTest.plan(i), D.i); if (!pl) continue;
      for (const s of pl.stops) { n++; if (!s.oh || !s.oh.spans.length) continue; known++;
        const inside = s.oh.spans.some(([a, z]) => s.t >= a - 1 && s.t <= (s.oh.last != null ? s.oh.last : z) + 1);
        if (!inside && !s.late) bad.push(`${D.date} ${s.name} at ${s.t} outside ${JSON.stringify(s.oh.spans)} with no warning`); } }
    log(S, K, !bad.length, bad.length ? 'Opening hours: ' + bad.slice(0, 4).join('; ') : `Opening hours: all ${known} stops with known hours (of ${n}) are planned while open, or flagged on the Day plan`); }

  // ---- Closed day: a sight closed on the plan's weekday leaves the plan and moves to an open day ----
  { const bad = []; const bcn = days.filter(x => x.city === 'barcelona' && x.type !== 'sea');
    const D = bcn[0], other = bcn.find(x => x.i !== D.i);
    if (!D || !other) bad.push('no two Barcelona days in the example trip');
    else {
      // The first Barcelona day becomes a Monday, with the MNAC (closed Mondays) ticked.
      await L(i => window.__kairouteEdit(i, { date: '2027-07-19' }), D.i);
      const siteId = await L(i => window.__kairouteLiveTest.siteIdByName(i, 'MNAC'), D.i);
      if (!siteId) bad.push('MNAC not in the Barcelona guide');
      else {
        await L(([i, sid]) => { const t = window.__kairouteTruth(i); window.__kairouteEdit(i, { selected: t.selected.filter(x => x !== sid).concat(sid) }); }, [D.i, siteId]);
        await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
        const pl = await L(i => window.__kairouteLiveTest.plan(i), D.i);
        if (pl.stops.some(s => s.id === siteId)) bad.push('MNAC is planned on a Monday, when it is closed');
        const c = pl.closed.find(x => x.id === siteId);
        if (!c) bad.push('closed MNAC not reported'); else if (c.openOn < 0) bad.push('no open day offered for MNAC');
        const btn = await L(sid => !!document.querySelector(`[data-act="closedmove"][data-id="${sid}"]`), siteId);
        if (!btn || !c) bad.push('no "Move it" button on the Day plan');
        else { await shot('live-closed.jpg', 'Opening hours: a closed sight moves to an open day');
          await p.click(`[data-act="closedmove"][data-id="${siteId}"]`); await p.waitForTimeout(150);
          const sel = await L(i => window.__kairouteTruth(i).selected, c.openOn);
          if (!sel.includes(siteId)) bad.push('Move it did not tick MNAC on the open day');
          const still = await L(i => window.__kairouteTruth(i).selected, D.i); if (still.includes(siteId)) bad.push('MNAC still ticked on the closed day'); }
      }
      await L(([i, dt]) => window.__kairouteEdit(i, { date: dt }), [D.i, D.date]);
    }
    log(S, K, !bad.length, bad.length ? 'Closed days: ' + bad.join('; ') : 'Closed days: a sight closed that day leaves the plan, the Day plan says why and moves it to an open day in one tap'); }

  // ---- Book ahead ----
  { let shown = 0, should = 0;
    for (const D of days.filter(x => x.city === 'barcelona')) { await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(80);
      const r = await L(i => ({ want: window.__kairouteLiveTest.bookCount(i), got: document.querySelectorAll('.timeline .badge.book').length }), D.i); should += r.want; shown += r.got; }
    log(S, K, should === shown && should > 0, `Book ahead: ${shown} of ${should} stops whose ticket notes say to book ahead show the warning on the Day plan`); }

  // ---- Weather ----
  { const bad = []; const D = days.find(x => x.city === 'barcelona' && x.type === 'land') || days.find(x => x.city === 'barcelona');
    await p.clock.setFixedTime(new Date(D.date + 'T07:00:00'));
    const hours = []; for (let h = 7; h <= 21; h++) hours.push([h, 24, h >= 12 && h <= 17 ? 90 : 5, h >= 12 && h <= 17 ? 3 : 0]);
    await L(([c, dt, hrs]) => window.__kairouteLiveTest.setWx(c, { [dt]: { tmax: 24, tmin: 17, prob: 90, mm: 14, code: 63, hours: hrs } }), ['barcelona', D.date, hours]);
    await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
    const wx = await L(i => window.__kairouteLiveTest.wxFor(i), D.i);
    if (!wx || !wx.wet.length) bad.push('forecast not read'); else if (wx.wet[0][0] !== 720 || wx.wet[0][1] !== 1080) bad.push('wet hours read as ' + JSON.stringify(wx.wet));
    const chip = await L(() => (document.querySelector('.wxchip') || {}).innerText || '');
    if (!/90% rain/.test(chip)) bad.push('forecast chip missing: ' + chip);
    if (await L(() => !!document.getElementById('f-rain'))) bad.push('manual Rainy day switch shown next to a real forecast (duplicate)');
    const pl = await L(i => window.__kairouteLiveTest.plan(i), D.i);
    const wetOut = pl.stops.filter(s => !s.indoor && s.t < 1080 && s.t + s.len > 720).length;
    const offer = await L(() => !!document.querySelector('[data-act="wxswap"]'));
    const outdoorPicks = pl.stops.filter(s => !s.indoor && !s.must && !s.bonus).length;
    if (outdoorPicks && !offer) bad.push('no indoor swap offered for a rainy day');
    await shot('live-weather.jpg', 'Weather: rain forecast, swap offer');
    if (offer) { await p.click('[data-act="wxswap"]'); await p.waitForTimeout(150);
      const p2 = await L(i => window.__kairouteLiveTest.plan(i), D.i);
      if (!p2.swaps.length) bad.push('swap made no changes'); if (p2.swaps.some(s => !s[2])) bad.push('swapped in an outdoor sight');
      const txt = await L(() => [...document.querySelectorAll('.banner')].map(x => x.innerText).join(' | '));
      if (!/Because of rain/.test(txt)) bad.push('no "Because of rain" note after the swap');
      await p.click('[data-act="wxundo"]'); await p.waitForTimeout(100); }
    log(S, K, !bad.length, bad.length ? 'Weather: ' + bad.join('; ') : `Weather: rain 12:00–18:00 read from the forecast, ${wetOut} outdoor stop${wetOut === 1 ? '' : 's'} left in the wet hours, indoor swap offered and uses indoor sights only, Back to my picks undoes it`);
    await L(() => window.__kairouteLiveTest.clearWx()); }

  // ---- Crowds ----
  { let withTip = 0, shownTip = 0, inRush = 0;
    for (const D of days) { if (D.type === 'sea' || !D.city) continue; await L(i => window.__kairouteAt(i, 'plan'), D.i);
      const pl = await L(i => window.__kairouteLiveTest.plan(i), D.i); if (!pl) continue;
      const tips = pl.stops.filter(s => s.busy.length && !s.bonus); withTip += tips.length; inRush += tips.filter(s => s.busy.some(([a, z]) => Math.min(z, s.t + s.len) - Math.max(a, s.t) > 10)).length;
      shownTip += await L(() => [...document.querySelectorAll('.timeline .liveinfo')].filter(x => /busy|Busiest/.test(x.innerText)).length); }
    log(S, K, withTip === shownTip, `Crowds: ${shownTip} of ${withTip} stops with crowd information show it on the Day plan; ${withTip - inRush} of ${withTip} are planned outside their usual rush`); }

  // ---- Running late + back-to-the-ship alarm, on the day, with GPS ----
  { const bad = []; const D = days.find(x => x.type === 'port' && x.city);
    await p.clock.setFixedTime(new Date(D.date + 'T08:00:00'));
    await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
    const pr = await L(() => window.__kairouteLiveProbe());
    const before = await L(i => window.__kairouteLiveTest.plan(i), D.i);
    const big0 = await L(() => (document.getElementById('cdBig') || {}).innerText || '');
    if (!/h|min/.test(big0)) bad.push('no live countdown on the day (shows "' + big0 + '")');
    await ctx.setGeolocation({ latitude: pr.first.lat, longitude: pr.first.lng });
    const [hh, mm] = pr.lateAt.split(':').map(Number);
    await p.clock.setFixedTime(new Date(`${D.date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`));
    await L(() => document.querySelector('[data-act=livegps]').click()); await p.waitForTimeout(1200);
    await p.clock.runFor(21000); await p.waitForTimeout(500);
    const after = await L(i => window.__kairouteLiveTest.plan(i), D.i);
    if (!after.live) bad.push('falling 40 minutes behind at a stop did not re-plan the day');
    else {
      if (after.stops.some(s => s.name === pr.first.name)) bad.push('the stop you are at is planned again');
      if (after.over) bad.push('re-planned day runs past the time to be back at the ship');
      if (after.endBy !== before.endBy) bad.push('re-plan changed the back-at-the-ship time');
      const keptMust = before.stops.filter(s => s.must && s.name !== pr.first.name).every(s => after.stops.some(x => x.id === s.id));
      const tl = await L(() => (document.querySelector('.timeline .tl .nm') || {}).innerText || '');
      if (!/^Now/.test(tl)) bad.push('schedule does not start "Now" (' + tl + ')');
      const ban = await L(() => [...document.querySelectorAll('.livecard .banner')].map(x => x.innerText).join(' | '));
      if (!/re-planned/i.test(ban)) bad.push('no re-plan note');
      if (!keptMust && !/must-see/.test(ban)) bad.push('a must-see was left out without saying so');
      const al = await L(() => window.__kairouteLiveTest.alerts()); if (!al.some(a => /running late/i.test(a.t))) bad.push('no running-late alert');
      await shot('live-late.jpg', 'Running late: the day re-planned from where you are');
      await p.click('[data-act="liveundo"]'); await p.waitForTimeout(150);
      if ((await L(i => window.__kairouteLiveTest.plan(i), D.i)).live) bad.push('Undo did not restore the plan');
    }
    log(S, K, !bad.length, bad.length ? 'Running late: ' + bad.join('; ') : 'Running late: GPS at a stop 40 minutes behind re-plans the rest of the day from there, keeps the time back at the ship, says what was left out, Undo restores it');
    // Alarm: the bar on other screens and the alerts as leave-by approaches.
    const bad2 = [];
    await L(i => window.__kairouteAt(i, 'guide'), D.i); await p.clock.runFor(21000); await p.waitForTimeout(200);
    const bar = await L(() => { const x = document.getElementById('alarmBar'); return x && !x.hidden ? x.innerText : ''; });
    if (!/leave by/i.test(bar)) bad2.push('no countdown bar on the Guide screen');
    await shot('live-alarm-bar.jpg', 'Back to the ship: the countdown stays on top of every screen');
    const lb = await L(() => { const t = document.getElementById('alarmBar').innerText; const m = /leave by (\d\d):(\d\d)/i.exec(t); return m ? +m[1] * 60 + +m[2] : null; });
    if (lb == null) bad2.push('leave-by time not shown');
    else {
      const at = m => new Date(`${D.date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`);
      for (const [th, re] of [[29, /30 minutes/], [14, /15 minutes/], [4, /5 minutes/], [-1, /Time to go/]]) {
        await p.clock.setFixedTime(at(lb - th)); await p.clock.runFor(61000); await p.waitForTimeout(150);
        const al = await L(() => window.__kairouteLiveTest.alerts()); if (!al.some(a => re.test(a.b))) bad2.push(`no alert ${th >= 0 ? th + 1 + ' minutes before leave-by' : 'at leave-by'}`); }
      const cls = await L(() => document.getElementById('alarmBar').className); if (!/go/.test(cls)) bad2.push('bar does not turn urgent after leave-by');
    }
    log(S, K, !bad2.length, bad2.length ? 'Back-to-the-ship alarm: ' + bad2.join('; ') : 'Back-to-the-ship alarm: countdown bar on other screens, alerts at 30, 15 and 5 minutes and at leave-by, turns urgent when it is time to go');
  }

  // ---- Traveler ratings ----
  { const bad = []; await L(u => window.__kairouteLiveTest.setAI(u), MOCK);
    const D = days.find(x => x.type === 'land' && x.city === 'athens') || days.find(x => x.city);
    await p.clock.setFixedTime(new Date('2027-08-01T10:00:00')); // the day is in the past: rate what you saw
    await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
    const star = await p.$('.timeline [data-act="raterow"][data-n="5"]');
    if (!star) bad.push('no "Been here? Rate it" on a past day'); else { await star.click(); await p.waitForTimeout(200);
      if (!posted.some(x => x.pth === '/rate' && x.body.stars === 5)) bad.push('rating not sent to the server'); }
    await p.clock.setFixedTime(new Date(D.date + 'T20:30:00')); await L(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
    const busy = await p.$('.timeline [data-act="busyrow"][data-n="3"]');
    if (!busy) bad.push('no "How busy?" on the day'); else { await busy.click(); await p.waitForTimeout(200);
      if (!posted.some(x => x.pth === '/rate' && x.body.busy === 3 && x.body.hour === 20)) bad.push('busy report not sent with the hour'); }
    const mk = await L(() => { const s = window.__kairouteLive.allSites().filter(x => x.city === 'Athens').slice(0, 2); const m = {}; m[s[0].name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()] = { avg: 4.8, n: 9 }; m[s[1].name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()] = { avg: 2.0, n: 9 }; return window.__kairouteLiveTest.marks('athens', { ratings: m, busy: {} }); });
    if (mk.length !== 2 || !(mk[0].w > 1) || !(mk[1].w < 1)) bad.push('traveler ratings do not change the ranking: ' + JSON.stringify(mk));
    log(S, K, !bad.length, bad.length ? 'Traveler ratings: ' + bad.join('; ') : 'Traveler ratings: stars and "how busy" reach the server, loved stops rank higher and poorly rated ones lower');
  }

  // ---- What am I looking at? ----
  { const bad = []; const D = days.find(x => x.type === 'land' && x.city === 'athens') || days.find(x => x.city);
    await p.clock.setFixedTime(new Date(D.date + 'T11:00:00'));
    await L(i => window.__kairouteAt(i, 'guide'), D.i); await p.waitForTimeout(150);
    const geo = await L(i => window.__kairouteLiveTest.siteLL(i), D.i);
    await ctx.setGeolocation({ latitude: geo.lat + 0.0003, longitude: geo.lng });
    if (!(await p.$('[data-act="camopen"]'))) bad.push('no "What\'s this?" button on the Guide screen');
    await p.setInputFiles('#camFile', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: JPEG }).catch(e => bad.push('photo input: ' + e.message));
    await p.waitForTimeout(1500);
    const sh = await L(() => { const s = document.getElementById('camSheet'); return s ? { h: (s.querySelector('h3') || {}).innerText || '', play: !!s.querySelector('[data-act="camplay"]'), txt: s.innerText } : null; });
    const sent = posted.filter(x => x.pth === '/identify').pop();
    if (!sent) bad.push('photo not sent for matching'); else {
      if (!sent.body.cands.length || sent.body.cands.some(c => c.m > 700)) bad.push('candidates are not limited to real places near you');
      if (sent.body.cands[0].name !== geo.name) bad.push(`nearest candidate is ${sent.body.cands[0].name}, expected ${geo.name}`); }
    if (!sh) bad.push('no result shown'); else { if (sh.h !== geo.name) bad.push(`result "${sh.h}", expected ${geo.name}`); if (!sh.play) bad.push('no Play the story button'); }
    await shot('live-camera.jpg', 'What am I looking at? A photo matched to a real place near you');
    await L(() => { const c = document.querySelector('[data-act="camclose"]'); if (c) c.click(); });
    log(S, K, !bad.length, bad.length ? 'What am I looking at?: ' + bad.join('; ') : 'What am I looking at?: the photo is matched only against real places near your GPS position, and the story is ready to play');
  }
  log(S, K, !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
  await b.close();
}
module.exports = { run };
if (require.main === module) {
  const { chromium } = require('playwright'); const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
  const OUT = path.join(__dirname, '..', 'checks'); fs.mkdirSync(OUT, { recursive: true }); let fails = 0;
  run({ chromium, FILE, OUT, shots: [], log: (s, k, ok, what) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); } })
    .then(() => process.exit(fails ? 1 : 0)).catch(e => { console.error(e); process.exit(1); });
}
