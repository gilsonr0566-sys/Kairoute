// Beta 2 engine, part 4: the trip-wide ledger of what's used. Every sight and every place to eat is claimed once,
// here, and every step of the plan asks here (lesson 4: "one day per sight" used to be checked in several places
// with different lists, and sights and restaurants repeated across days). Claims are by id, never by name.
(function (E) {
  E.makeLedger = () => {
    const sights = new Map(), eats = new Map();
    const claim = (m, id, day, how) => { if (id == null) return false; const k = String(id), was = m.get(k); if (was && was.day !== day) return false; if (!was) m.set(k, { day, how }); return true; };
    return {
      claimSight: (id, day, how) => claim(sights, id, day, how || "stop"),
      claimEat: (id, day, how) => claim(eats, id, day, how || "meal"),
      sightFree: (id, day) => { const w = sights.get(String(id)); return !w || w.day === day; },
      eatFree: (id, day) => { const w = eats.get(String(id)); return !w || w.day === day; },
      sightDay: id => { const w = sights.get(String(id)); return w ? w.day : null; },
      release: (id, day) => { const w = sights.get(String(id)); if (w && w.day === day) sights.delete(String(id)); },
      releaseEat: (id, day) => { const w = eats.get(String(id)); if (w && w.day === day) eats.delete(String(id)); },
      snapshot: () => ({ sights: [...sights].sort(), eats: [...eats].sort() })
    };
  };
})(KEngine);
