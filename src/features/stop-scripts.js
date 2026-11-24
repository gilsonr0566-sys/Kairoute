// Hand-written stop scripts (Richard, Nov 15): a finished, researched guide script for a stop, played one part
// at a time in the traveler's chosen Kairoute guide voice (GUIDES in main.js). Each paragraph is recorded ahead in every
// guide voice with free Kokoro on GitHub's machines (stories/tools/record-scripts.mjs, workflow "Record stop scripts in the
// Kairoute voices") into audio/<id>/<Kokoro voice>/p<part>-<paragraph>.mp3, so they play at once, need no AI and cost
// nothing, and work offline once saved. A paragraph whose recording is missing is read by the device voice.
// The research behind each script (sources, confidence labels) is kept with the project's tour scripts; the words
// here are the spoken script only. Later every stop gets a script built the same way (see the narration template).
// Pronunciations for the voice only: the screen shows the real spelling.
const SAY = [[/\borloj\b/gi, "orloy"], [/Mikuláš of Kadaň/g, "Mikulash of Kadan"], [/Jan Šindel/g, "Yan Shindel"], [/Šindel/g, "Shindel"],
  [/Hanuš/g, "Hanush"], [/Jan Růže/g, "Yan Roozheh"], [/Zdeněk Horský/g, "Zdenyek Horskee"], [/Vojtěch Sucharda/g, "Voytyekh Sookharda"],
  [/Josef Mánes/g, "Yosef Mahness"], [/Mánes/g, "Mahness"], [/Alois Jirásek/g, "Alois Yirahsek"], [/Jan Hus\b/g, "Yan Hooss"], [/\bHus\b/g, "Hooss"], [/Týn/g, "Teen"],
  [/Agios Titos/g, "Ah-yos Tee-tos"], [/Nikephoros Phokas/g, "Nikiforos Fokas"], [/Chandax/g, "Handax"], [/Athanasios Moussis/g, "Athanasios Moussees"], [/Gortyn/g, "Gortin"]];
const sayText = t => SAY.reduce((a, [re, to]) => a.replace(re, to), String(t));
var STOP_SCRIPTS = [{ // var: cityFor can run while main.js is still starting, before this file has run
  id: "prague-clock", v: 1, title: "Prague Astronomical Clock", where: "Old Town Square, Prague",
  city: /\b(prague|praha|prag)\b/i, site: /astronomical clock|\borloj\b/i,
  show: { what: "The apostles' procession", every: 60, first: "09:00", last: "23:00", note: "Every hour on the hour; about a minute long" },
  parts: [
    {
      "name": "Arrival: where to stand",
      "stand": "Face the tall Gothic tower at the corner of Old Town Square. The clock is on its side wall. Don't push into the crowd right under it. Stand a dozen steps back and a little off to one side, where you can see the two big round dials and the two small windows above them.",
      "minutes": 3,
      "paras": [
        "Here we are. Look up at that tower. The big painted dial with the gold hands is the Prague Astronomical Clock, the orloj, as Czechs call it.",
        "This clock has been running since 1410. That's eighty-two years before Columbus sailed. And the people of Prague have kept it going, through fire, war and plenty of breakdowns, for more than six hundred years.",
        "In about ten minutes, on the hour, the little windows up top will open and the twelve apostles will walk past. So we've got just enough time for me to show you how to read this thing, because most people stare at it for one minute, watch the show, and walk off without knowing what they just saw. That's not going to be us.",
        "One quick thing first. Every hour a big crowd gathers on this exact spot, and crowds draw pickpockets. Zip your bag and keep your phone in your hand or a front pocket. Good. Let's look at the clock."
      ]
    },
    {
      "name": "How to read the dial",
      "stand": "the big upper dial.",
      "minutes": 6,
      "paras": [
        "Start with the big upper dial. It isn't really a clock face. It's a map of the sky, a mechanical astrolabe.",
        "See the colours behind the hands? The blue at the top is the sky in daytime. The black circle at the bottom is night. And the reddish-brown bands between them are dawn and dusk. The words on the left say aurora and ortus, dawn and sunrise. On the right, occasus and crepusculum, sunset and twilight.",
        "Now find the golden sun riding on one of the hands. Wherever the sun sits right now, over blue, red or black, that's where the real sun is in the sky. So the clock tells you whether it's day, night or twilight without anyone looking outside.",
        "Our time, the hours you know, is shown by the golden Roman numerals around the edge, I to XII twice. Read the hand with the golden hand-shaped pointer against those.",
        "Now look at the outermost ring, the narrow one with fancy golden numbers on black. That's Old Bohemian time. In this system the day ended at sunset. Twenty-four o'clock was the moment the sun went down, and the count started again from there. That's why that ring slowly turns through the year: in Prague, sunset falls around four in the afternoon in December and after eight at night in midsummer.",
        "Inside the dial there's a smaller ring with the signs of the zodiac. It's set off-centre on purpose, so it can carry the sun through the year as the sun moves through the stars. There's also a little golden star on it, which marks the spring equinox. With it, an astronomer could read star time.",
        "And here's my favourite detail. Find the silver-and-black ball. That's the moon. It turns to show the real phase of the moon tonight: full, half or a thin sliver. It's driven by nothing but a hanging weight and a screw thread, moving a tiny step each day. The clock's own descriptions call this arrangement unique among astronomical clocks.",
        "So this one face tracks our hours, the old sunset hours, the sun, the moon, the zodiac and the stars. In 1410, that was the most advanced thing for miles."
      ]
    },
    {
      "name": "Meet the figures",
      "stand": "the four small statues on either side of the upper dial.",
      "minutes": 3,
      "paras": [
        "Before the show, meet the cast. On both sides of the upper dial stand four figures. Each one is a warning about how we spend our time.",
        "Far left, the man with the mirror. That's Vanity, so busy admiring himself he forgets the hour.",
        "Next to him, holding a moneybag and a stick, is the Miser, greed.",
        "On the right side, the skeleton is Death. He holds an hourglass in one hand and a bell rope in the other. He's the oldest figure on the clock. The city's own records say he goes back to the late 1400s.",
        "And far right, the man with the lute, dressed as a Turk, stands for pleasure and indulgence. That's how Prague's tourism office explains him, though historians offer other readings too.",
        "When the hour strikes, Death will ring his bell and turn his hourglass. Watch the other three. They shake their heads, as if to say \"not yet, not me.\" Death doesn't argue. He just keeps ringing.",
        "Medieval people would have got the message instantly. Your time is running out, so don't waste it on vanity, money or pleasure. Here we are, five centuries later, still standing in a crowd watching the same lesson.",
        "Quick, phones ready. Here it comes."
      ]
    },
    {
      "name": "The hourly show",
      "stand": "the two small windows above the upper dial.",
      "minutes": 2,
      "paras": [
        "There, Death's ringing. Now look up at the two little windows.",
        "They open, and the apostles glide past one by one, each turning to face us. Twelve of them, each holding the object that identifies him in Christian art. Peter carries a key, because Jesus gave him \"the keys of the kingdom of heaven.\" Paul has a sword and a book. Andrew has his X-shaped cross. Bartholomew holds a skin, because tradition says he was flayed alive. Simon carries a saw, and Thomas a lance.",
        "Sharp eyes might notice something. Two of the twelve aren't from the original twelve disciples at all. Paul and Barnabas are up there. In Scripture both are called apostles, in the Book of Acts, but neither was one of the Twelve who walked with Jesus. Their places came from James the Greater and Matthew.",
        "Windows closing, and listen... the golden rooster above crows to end the show.",
        "And that's it! It's over in under a minute. Look around: half the crowd is saying \"was that it?\" Fair enough. Many visitors call it overrated. But you now know something they don't: the real show is the dial, and it never stops."
      ]
    },
    {
      "name": "The calendar dial",
      "stand": "the lower round dial, under the clock.",
      "minutes": 4,
      "paras": [
        "Now drop your eyes to the lower dial. This is the calendar.",
        "Around the outside are all 365 days of the year, each with its saint's name. Czechs traditionally celebrate their name day, the feast of the saint they're named for, almost like a second birthday. Today's date is under the little pointer at the top.",
        "Inside are twelve round paintings, one for each month, showing the farm year: sowing, harvest, the grape picking, butchering the pig for winter. Between them are the signs of the zodiac, and in the middle is the coat of arms of the Old Town.",
        "The original paintings are by Josef Mánes, one of the most loved Czech painters, from 1866. The original is safe indoors in the City of Prague Museum. What's on the wall is a copy.",
        "And here's a modern scandal for you. When the clock was restored in 2018, a new copy was painted. Four years later, a Prague heritage group compared it with Mánes's original and found faces, ages, hairstyles and clothes had been changed. The country's heritage inspectors agreed. In 2023 the city announced that the Academy of Fine Arts would paint a faithful new copy. So depending on when you're here, you may be looking at the 2018 version or its replacement. I couldn't confirm which one is up today.",
        "On either side of this dial there are four more figures. A philosopher with a book. The archangel Michael with a spear, pointing to the calendar. An astronomer with a telescope. And a chronicler with a quill. They were reworked by the sculptor Vojtěch Sucharda after the war, and the stone angel is a copy of one of the oldest sculptures on the clock."
      ]
    },
    {
      "name": "Who built it, and the blinded clockmaker",
      "stand": "the clock as a whole.",
      "minutes": 4,
      "paras": [
        "So who built this? We have the answer from the first written record, from October 1410. The clockmaker was Mikuláš of Kadaň, and the brains behind the astronomy was Jan Šindel, a professor of mathematics and astronomy at Prague's Charles University.",
        "For centuries, though, everyone in Prague would have told you a different name: Master Hanuš. And this is the story you'll hear in every Prague pub.",
        "The legend goes that Hanuš built the clock so beautifully that the city councillors feared he'd build an even better one for another town. So they had him blinded. Heartbroken, the old master asked to be led up into the clock one last time. He reached into the works, and the clock stopped. Nobody could fix it for a hundred years.",
        "It's a wonderful story, but it's a legend. The famous version was written down by the Czech novelist Alois Jirásek in his Old Czech Legends. There was a real clockmaster called Jan Růže, nicknamed Hanuš, who worked on the clock around 1490, and that's probably when this lower calendar dial and the Gothic stone decoration were added. But in 1962 the historian Zdeněk Horský showed from the old records that the clock was already running eighty years earlier, built by Mikuláš and Šindel. Hanuš didn't build it, and there's no evidence anyone was blinded.",
        "There's another legend Praguers still half-believe: if the clock is neglected or stops, bad times will fall on the city. So it's no surprise they keep it running."
      ]
    },
    {
      "name": "Fire and rebirth, May 1945",
      "stand": "the Town Hall to the left of the tower. You can see the open space where a whole wing once stood.",
      "minutes": 4,
      "paras": [
        "Look just to the left of the tower. See that open patch of green and the bare side wall? A whole wing of the Town Hall used to stand there.",
        "In May 1945, in the last days of the Second World War, the people of Prague rose up against the German occupation. During the fighting, German troops fired on this building. The Town Hall burned. The city archive went up in flames, and so did the clock's wooden apostles and the Mánes calendar on the wall.",
        "After the war, clockmakers and craftsmen brought it back. The sculptor Vojtěch Sucharda carved the new apostles you just watched, and the clock started running again in 1948. The burned wing was never rebuilt. The city left the gap, and you're looking at it.",
        "In 2018 the whole clock came down for most of a year for restoration. The electric drive installed after the war was removed, and the clock went back to running on a mechanism from the 1860s. On the evening of the 28th of September 2018 it started up again in front of a cheering crowd. Restorers say that roughly three-quarters of the clock's parts are still original. That's six hundred years old and still ticking."
      ]
    },
    {
      "name": "The 27 crosses and Jan Hus",
      "stand": "the pavement at the foot of the tower, then turn round to face the big monument in the middle of the square.",
      "minutes": 5,
      "paras": [
        "Before we go, look down at the paving stones near the base of the tower. You'll see white crosses set into the stones, and a plaque with names on the tower wall.",
        "They mark one of the darkest mornings in Czech history. On the 21st of June 1621, after the Protestant Czech nobles lost the Battle of White Mountain, twenty-seven of their leaders were executed right here in front of the Town Hall: three lords, seven knights and seventeen townsmen. One of them was Jan Jessenius, a famous physician and rector of the university, whose tongue was cut out before he died. Twelve of the heads were hung in iron cages on the Old Town Bridge Tower of Charles Bridge, and they stayed there for ten years.",
        "Please don't stand on the crosses. Locals step around them.",
        "Now turn round and look at the big dark monument in the middle of the square. That's Jan Hus, the church reformer burned at the stake in 1415, just five years after this clock first ticked. The monument went up in 1915, five hundred years after his death. Hus called for the Bible and worship in the people's own language, a century before Luther. In Czech history, the clock, the crosses and that statue all belong to the same long story of faith and freedom."
      ]
    },
    {
      "name": "Closing",
      "stand": "",
      "minutes": 2,
      "paras": [
        "So that's the Prague orloj. Think about everything this clock has outlasted. When it first ticked, Gutenberg had not yet printed his Bible, and Columbus wouldn't sail for another eighty years. Kings came and went, wars were fought, this very building burned, and the clock is still here.",
        "Six hundred years of Prague is written into this one wall: a medieval sky map, a lesson about time from Death himself, a legend that isn't true, a fire that was, and a city that just keeps winding it back up. In a city full of castles and cathedrals, one of its greatest treasures is a reminder that time is the one thing none of us can stop.",
        "If you've got the time, the tower is worth it. There's a lift, and the gallery gives you the best view of the whole square, Týn Church's twin spires included. If not, our next stop is just across the square.",
        "And one last tip: come back at night. The clock is lit, the crowds thin out, and you can watch the sun hand sitting on the black of night, exactly where the real sun is."
      ]
    }
  ]
}, {
  id: "heraklion-titus", v: 1, title: "Church of Saint Titus", where: "Agios Titos Square, Heraklion, Crete", allStand: true,
  city: /\b(heraklion|iraklio|iraklion)\b/i, site: /\b(saint|st\.?|agios) tit(us|os)\b/i,
  parts: [
    {
      "name": "Arrival: the square",
      "minutes": 2,
      "stand": "In Agios Titos Square, under the big plane tree, facing the church. The Venetian Loggia is the arcaded building just behind you.",
      "paras": [
        "Here we are. Find a bit of shade under this big plane tree and look at the church in front of you. This is the Church of Saint Titus, Agios Titos, as the people of Heraklion call it.",
        "It doesn't look like a typical Greek church, does it? No big domed bell tower, a rather formal stone front. Hold on to that thought, because the building itself is going to tell us a story about who has ruled this city over the last thousand years.",
        "But first, the man it's named for. Because this isn't a church to a distant legend. It's named for a real person who appears in the pages of the New Testament, a man the Apostle Paul trusted with some of his hardest jobs. And part of him is inside."
      ]
    },
    {
      "name": "Who was Titus?",
      "minutes": 3,
      "stand": "Still in the square, facing the church front.",
      "paras": [
        "So, who was Titus? He was a Greek, not a Jew, which mattered a great deal in the earliest years of the church. Paul took him along to Jerusalem to meet the leaders there. And in his letter to the Galatians, Paul makes a point of it: \"But neither Titus, who was with me, being a Greek, was compelled to be circumcised.\" In other words, Titus was living proof that a Greek could follow Christ without first becoming Jewish.",
        "Paul used him as his troubleshooter. When the church in Corinth was in turmoil, it was Titus who carried Paul's difficult letter there, and Titus who came back with good news. Paul was so relieved he wrote, \"God, that comforteth those that are cast down, comforted us by the coming of Titus.\" That's Second Corinthians, chapter seven.",
        "And then Paul gave him Crete."
      ]
    },
    {
      "name": "Paul, Crete and a letter",
      "minutes": 3,
      "stand": "Facing the church. You can sit on the steps or a bench while you listen.",
      "paras": [
        "Paul himself knew this coast. In the Book of Acts, chapter twenty-seven, Paul is a prisoner on a ship bound for Rome. Storms push them along the south side of Crete, to a harbor called Fair Havens. Paul warns them to stay for the winter. They don't listen, sail on, and end up shipwrecked on Malta.",
        "Later, Paul left Titus here with a job to do, and wrote him a letter about it. That letter is the Book of Titus, in your Bible today. It opens like this: \"For this cause left I thee in Crete, that thou shouldest set in order the things that are wanting, and ordain elders in every city.\" So Titus was the man organizing the first churches on this island.",
        "And here's a line locals still smile about. In chapter one, Paul quotes one of the Cretans' own poets: \"The Cretians are alway liars.\" Tradition says the poet was Epimenides, a Cretan from about six hundred years before Paul. The people of Heraklion know the verse well. They'll tell you it's the one Bible verse they're happy to argue with.",
        "Early church tradition says Titus became the first bishop of Crete, and that he died here as an old man, at Gortyn in the south of the island. The New Testament itself doesn't record his death, so that part comes to us from tradition."
      ]
    },
    {
      "name": "A church that changed hands",
      "minutes": 4,
      "stand": "Step back a little so you can see the whole front of the church.",
      "paras": [
        "Now, back to the building, and why it looks the way it does.",
        "In the year 961 the Byzantine general Nikephoros Phokas took Crete back from Arab rule, and a new cathedral to Titus was built in this city, then called Chandax. Most accounts date the first church here to that time.",
        "Then the Venetians arrived. They ruled Crete for more than four centuries and called this city Candia. They rebuilt the church as a grand three-aisled basilica, opened in 1446. A fire destroyed it in the sixteenth century, and they rebuilt it again in 1557.",
        "In 1669, after one of the longest sieges in history, Candia fell to the Ottoman Turks. As they left, the Venetians took the most precious relic of this church with them: the skull of Saint Titus. The church itself became a mosque.",
        "Then nature had its say. A great earthquake in 1856 almost completely destroyed the building. What you're looking at now was begun in 1869, as a mosque, designed by the architect Athanasios Moussis. That's why it has this formal, square look rather than the shape of a Byzantine church. There was once a tall minaret beside it.",
        "In the 1920s, after the exchange of populations between Greece and Turkey, the minaret came down, and in 1925 the building was dedicated again as an Orthodox church. Byzantine, Venetian, Ottoman, and Greek again. One plot of ground, four worlds."
      ]
    },
    {
      "name": "The relic that came home",
      "minutes": 4,
      "stand": "Inside the church, if it's open. Shoulders and knees covered, voices low. The silver reliquary is kept inside.",
      "paras": [
        "Let's step inside. Remember, this is a working church: cover shoulders and knees, keep your voice low, and check the signs before taking photos.",
        "Look for the silver reliquary. It holds the skull of Saint Titus. Remember, the Venetians took it away in 1669. It stayed in Venice for almost three hundred years.",
        "Then, after talks that lasted years, the city of Venice gave it back. On the fifteenth of May 1966, the relic arrived at Heraklion's harbor, the same harbor where your ship docked this morning, and crowds turned out to carry it home to this church.",
        "Whatever your own faith, take a moment here. People come to this spot to pray, to light a candle, to give thanks. Titus is the patron saint of Crete, and his feast day, on the twenty-fifth of August, is one of the biggest days of the year in this city."
      ]
    },
    {
      "name": "Closing",
      "minutes": 2,
      "stand": "Back outside in the square, under the plane tree.",
      "paras": [
        "So think about it for a moment. Two thousand years ago, a tentmaker from Tarsus wrote a short letter to a Greek friend he'd left on this island, telling him to set things in order. That letter is still read aloud in churches all over the world, every week.",
        "And the church named for that friend was burned, shaken to the ground, turned into a mosque, rebuilt, and given back. His relic was carried away and, three centuries later, carried home.",
        "Empires came and went across this square. The faith Titus was sent here to plant outlasted every one of them. Some things, it turns out, find their way home."
      ]
    }
  ]
}];
// The hello the Settings page plays for "Hear this voice": recorded in every guide voice like the scripts, never put on a stop.
STOP_SCRIPTS.push({ id: "voice-sample", v: 1, city: /(?!)/, site: /(?!)/, title: "Voice sample", where: "Settings", parts: [{ name: "Hello", minutes: 1, stand: "",
  paras: ["Hi, I'm your Kairoute guide. Let's walk over to the old harbor together. Look up, just there. See that stone lion above the gate? People have walked under it for centuries."] }] });
function playVoiceSample() { const sc = STOP_SCRIPTS.find(x => x.id === "voice-sample"); speakScript("voice-sample", sc, [0]); }
// Where a library story's facts come from (stop-stories.js): shown under the story, so the traveler can check it.
function scriptSources(s) {
  const sc = s && s.scriptV && STOP_SCRIPTS.find(x => s.scriptV === x.id + x.v); if (!sc || !sc.sources || !sc.sources.length) return "";
  return `<details class="more howknow"><summary>How we know</summary><p class="sub">Every fact in this story is checked against these sources (read ${esc(sc.checked || "")}). Where historians disagree, or a story is a legend, the guide says so.</p>
<ul class="tips">${sc.sources.map(x => `<li><span>${esc(x.pub)}: <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></span></li>`).join("")}</ul></details>`;
}
// The script that belongs to a stop, if any.
// Each city and stop name is matched against the scripts once (cityFor calls this on every screen draw, and with the story
// library a tick on a big city's list read every script's patterns for every sight: tap speed, Nov 23). The answer is kept
// by the names it reads, and worked out again when a script is added.
var scriptMemo = { n: -1, city: new Map(), site: new Map() }; // var, like STOP_SCRIPTS
function scriptMemoFresh() { if (scriptMemo.n !== STOP_SCRIPTS.length) { scriptMemo.n = STOP_SCRIPTS.length; scriptMemo.city.clear(); scriptMemo.site.clear(); } }
var scriptSeen = new WeakMap(); // site -> the names it was matched by, and the answer
const scriptFor = (s, city) => { if (!(s && city)) return s && city; scriptMemoFresh();
  const seen = typeof s === "object" ? scriptSeen.get(s) : null; if (seen && seen.n === scriptMemo.n && seen.c === city.city && seen.name === s.name && seen.local === s.local) return seen.v;
  const v0 = scriptForKey(s, city); if (typeof s === "object") scriptSeen.set(s, { n: scriptMemo.n, c: city.city, name: s.name, local: s.local, v: v0 }); return v0; };
const scriptForKey = (s, city) => { const k = (city.city || "") + "\u0000" + s.name + " " + (s.local || "");
  if (scriptMemo.site.has(k)) return scriptMemo.site.get(k);
  const v = STOP_SCRIPTS.find(sc => sc.city.test(city.city || "") && sc.site.test(s.name + " " + (s.local || ""))); scriptMemo.site.set(k, v); return v; };
// ONE STORY, ONE STOP (rules registry R-16, Nov 24: Richard's Chania screenshot showed the old-town walk's five
// chapters on two stops in a row, the Etz Hayyim Synagogue and the old-town walk, because the story's pattern names
// the synagogue so it can be found under any of its names). A story is about one place: of the sights its pattern
// matches, it goes only to the one it is about, the sight whose name is most of the story's title (a sight named by
// one of the story's chapters is a stop on the walk, not the walk). Every other sight keeps its own words. A sight a
// story's chapter is named for, close to the story's own stop, is ON THAT WALK (s.onWalk): the planner folds it into
// the walk when both are planned the same day, so the walk is never told twice.
const SCRIPT_SKIP = new Set(["the", "and", "of", "a", "an", "de", "la", "le", "di", "del", "della", "in", "at", "on", "to", "s"]);
const scriptWords = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(w => w && !SCRIPT_SKIP.has(w));
// A chapter is named for the sight: the chapter's name holds the sight's whole name, word for word ("Kastelli hill"
// for "Kastelli"; "Etz Hayyim Synagogue" for itself).
const scriptPartFor = (sc, s) => { const n = scriptWords(s.name); if (!n.length) return -1;
  return sc.parts.findIndex(p => { const w = scriptWords(p.name); return w.length && n.every(x => w.includes(x)) && (n.length >= 2 || n[0].length >= 5); }); };
// How much of the story's title the sight's name is (0 to 1).
const scriptTitleFit = (sc, s) => { const t = new Set(scriptWords(sc.title + " " + (sc.where || ""))), n = scriptWords(s.name); return n.length ? n.filter(w => t.has(w)).length / n.length : 0; };
const SCRIPT_WALK_KM = 1; // a chapter's sight further than this from the story's stop is another place of that name
// The sight a story belongs to, of those its pattern matches: the best fit to its title, a chapter's own sight only when
// no other fits; none when the only matches are chapters' sights (the synagogue alone never gets the whole old-town walk).
function scriptOwner(sc, cands) {
  const r = cands.map(s => ({ s, fit: scriptTitleFit(sc, s), part: scriptPartFor(sc, s) >= 0 }))
    .sort((a, b) => (a.part - b.part) || (b.fit - a.fit) || ((b.s.minutes || 0) - (a.s.minutes || 0)) || String(a.s.id).localeCompare(String(b.s.id)));
  const best = r[0]; return best && (!best.part || best.fit > 0) ? best.s : null;
}
var scriptOwnMemo = new WeakMap(); // city -> { sig, owner: script id -> site, walk: site -> [owner ids] }
function scriptOwners(city) {
  const sites = city.sites || [], sig = scriptMemo.n + "|" + (city.city || "") + "|" + sites.map(s => s.id + "~" + s.name + "~" + (s.local || "")).join("|");
  const kept = scriptOwnMemo.get(city); if (kept && kept.sig === sig) return kept;
  const by = new Map(); for (const s of sites) { const sc = scriptFor(s, city); if (sc) { if (!by.has(sc)) by.set(sc, []); by.get(sc).push(s); } }
  const owner = new Map(), walk = new Map();
  for (const [sc, cands] of by) { const o = scriptOwner(sc, cands); if (!o) continue; owner.set(sc.id, o);
    for (const s of sites) if (s !== o && isFinite(+s.lat) && isFinite(+o.lat) && hav(s, o) <= SCRIPT_WALK_KM && scriptPartFor(sc, s) >= 0) { if (!walk.has(s)) walk.set(s, []); walk.get(s).push(o.id); } }
  const out = { sig, owner, walk }; scriptOwnMemo.set(city, out); return out;
}
// Puts the script on the stop as its parts (the same parts the voice tour and the day plan already show). The AI
// walk-through never rewrites a stop with a script. Cheap and safe to call often.
function scriptStops(city) {
  if (!city || !STOP_SCRIPTS || !scriptMemo) return; scriptMemoFresh();
  const ck = city.city || ""; let any = scriptMemo.city.get(ck); if (any === undefined) scriptMemo.city.set(ck, any = STOP_SCRIPTS.some(sc => sc.city.test(ck))); if (!any) return;
  const own = scriptOwners(city);
  for (const s of city.sites || []) {
    const w = own.walk.get(s); if (w) s.onWalk = w.slice(); else if (s.onWalk) delete s.onWalk;
    const sc0 = scriptFor(s, city), sc = sc0 && own.owner.get(sc0.id) === s ? sc0 : null;
    // A sight given a story it isn't about (a saved trip from before this rule) gets its own words back.
    if (!sc) { if (s.scriptV) { delete s.parts; delete s.scriptV; s.partsOff = []; delete s.extrasV; } continue; }
    if (s.scriptV === sc.id + sc.v) continue;
    s.parts = sc.parts.map(p => ({ name: p.name, spot: true, local: "", lat: s.lat, lng: s.lng, minutes: p.minutes, stand: p.stand, next: "", guide: p.paras.join("\n\n"), lookFor: "" }));
    s.partsOff = []; s.intro = ""; s.wrap = ""; s.extrasV = 99; s.scriptV = sc.id + sc.v;
    if (sc.show) s.show = Object.assign({ part: null }, sc.show);
  }
}
const scriptAudio = (sc, k, i, v) => `audio/${sc.id}/${v || guideVoice().speaker}/p${k}-${i}.mp3`;
// Every recording of a script in one voice (for saving a trip for offline use).
const scriptFiles = (sc, v) => sc.parts.flatMap((p, k) => p.paras.map((t, i) => scriptAudio(sc, k, i, v)));
// A scripted stop says exactly its script: no AI rewrite, no added opening.
const partSpeech0 = partSpeech;
partSpeech = function (s, k, first) { const sc = s && s.scriptV && STOP_SCRIPTS.find(x => s.scriptV === x.id + x.v); return sc && sc.parts[k] ? sc.parts[k].paras.join("\n\n") : partSpeech0(s, k, first); };
// Plays the recorded paragraphs of the given parts in order, with a guide's pause between them.
async function speakScript(id, sc, ks) {
  speakingId = id; audioMsg = "";
  kairouteSound(); // set up on the tap itself, which browsers require for audio
  try { natAudio.src = SILENT; natAudio.play().catch(() => {}); } catch (e) {} // claim the tap so the recording can play
  const v = guideVoice();
  for (let n = 0; n < ks.length; n++) {
    const paras = sc.parts[ks[n]].paras;
    for (let i = 0; i < paras.length; i++) {
      if (speakingId !== id) return;
      const ok = await new Promise(res => { natAudio.onended = () => res(true); natAudio.onerror = () => res(false);
        natAudio.src = scriptAudio(sc, ks[n], i, v.speaker); natAudio.preservesPitch = true; natAudio.defaultPlaybackRate = natAudio.playbackRate = GUIDE_PACE;
        natAudio.play().then(() => { voiceNow = `${v.name}, Kairoute voice`; ttsState = "speaking"; updateAudioUI(); }).catch(() => res(false)); });
      if (speakingId !== id) return;
      // No recording (or it couldn't play): the device voice reads the rest of the script from here.
      if (!ok) { speakDevice(id, paras.slice(i).concat(...ks.slice(n + 1).map(k => sc.parts[k].paras)).map(sayText), null); return; }
      await new Promise(r => setTimeout(r, i + 1 < paras.length ? 650 : 1100));
    }
  }
  if (speakingId === id) { speakingId = null; ttsState = "idle"; updateAudioUI(); }
}
const speakText0 = speakText, speakSite0 = speakSite;
speakText = function (id, text) {
  const m = /^part:(.+):(\d+)$/.exec(String(id)), city = m && cityFor(day()), s = city && allSites(city).find(x => x.id === m[1]), sc = s && s.scriptV && STOP_SCRIPTS.find(x => s.scriptV === x.id + x.v);
  if (!sc || !natAudio || (P().lang || "English") !== "English" || appSet.natvoice === "off") return speakText0(id, text);
  if (speakingId === id) { stopAudio(); return; }
  stopAudio(); speakScript(id, sc, [+m[2]]);
};
speakSite = function (site) {
  const sc = site && site.scriptV && STOP_SCRIPTS.find(x => site.scriptV === x.id + x.v);
  if (!sc || !natAudio || (P().lang || "English") !== "English" || appSet.natvoice === "off") return speakSite0(site);
  if (speakingId === site.id) { stopAudio(); return; }
  stopAudio(); speakScript(site.id, sc, partsOn(site).map(p => site.parts.indexOf(p)));
};
// A scripted stop on its own page, for demonstrations: the website with ?stop=<script id> (for example
// ?stop=prague-clock) opens the stop over the app, with one Play button per part and one for the whole stop.
const sdId = (sc, k) => "script:" + sc.id + ":" + k;
function scriptDemo() {
  let id = ""; try { id = new URLSearchParams(location.search).get("stop") || ""; } catch (e) {}
  const sc = STOP_SCRIPTS.find(x => x.id === id); if (!sc || document.getElementById("scriptdemo")) return;
  const el = document.createElement("div"); el.id = "scriptdemo"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", sc.title);
  el.innerHTML = `<style>#scriptdemo{position:fixed;inset:0;z-index:9000;overflow:auto;background:var(--paper,#F3F5F1);color:var(--ink,#123C3A);padding:16px}
#scriptdemo .sd{max-width:760px;margin:0 auto;background:var(--card,#fff);border:1px solid var(--line,#D8DED8);border-radius:var(--r,10px);padding:18px}
#scriptdemo h2{font-family:var(--font-display,system-ui);margin:4px 0 2px}#scriptdemo .sdtop{display:flex;justify-content:space-between;align-items:center;gap:8px}
#scriptdemo ol.parts{font-size:1rem;padding-left:1.4em}#scriptdemo ol.parts li{margin:10px 0}#scriptdemo details{margin:4px 0}#scriptdemo summary{cursor:pointer;color:var(--route,#146B61)}
#scriptdemo .state{display:block;color:var(--muted,#56636C);font-size:.9rem;margin-top:4px;min-height:1.2em}</style>
<div class="sd"><div class="sdtop"><span class="eyebrow">${esc(sc.where)}</span><button class="btn ghost small" data-sdclose>✕ Close</button></div>
<h2>${esc(sc.title)}</h2><p class="lede">${sc.parts.length} short parts, told by your Kairoute guide. Play it all, or tap any part to hear just that one.</p>${voicePick({ scriptV: sc.id })}
${sc.show ? `<p class="sub show">⏱ ${esc(sc.show.what)}: every hour, 9 AM to 11 PM. Start part 1 about 10 minutes before the hour.</p>` : ""}
<div class="audio"><button class="btn bigplay" data-sp="${sdId(sc, "all")}" data-label="▶ Play the whole stop">▶ Play the whole stop</button><span class="state" aria-live="polite"></span></div>
<ol class="parts">${sc.parts.map((p, k) => `<li><b>${esc(p.name)}</b> <small>${p.minutes} min</small>${p.stand ? `<span class="cue"><b>${k && !sc.allStand ? "Look at" : "Stand here"}:</b> ${esc(p.stand)}</span>` : ""}
<div class="audio"><button class="btn ghost small" data-sp="${sdId(sc, k)}" data-label="▶ Play part ${k + 1}">▶ Play part ${k + 1}</button><span class="state" aria-live="polite"></span></div>
<details><summary>Read the words</summary>${p.paras.map(t => `<p>${esc(t)}</p>`).join("")}</details></li>`).join("")}</ol></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", ev => {
    const t = ev.target.closest("[data-sp],[data-sdclose]"); if (!t) return;
    if (t.hasAttribute("data-sdclose")) { stopAudio(); el.remove(); try { const u = new URL(location.href); u.searchParams.delete("stop"); history.replaceState(null, "", u.href); } catch (e) {} return; }
    const pid = t.dataset.sp, k = pid.split(":").pop();
    if (speakingId === pid) { stopAudio(); return; }
    stopAudio(); speakScript(pid, sc, k === "all" ? sc.parts.map((p, i) => i) : [+k]);
  });
  updateAudioUI();
}
// The demo page's buttons show what's playing, like every other Play button.
const updateAudioUI0 = updateAudioUI;
updateAudioUI = function () {
  updateAudioUI0();
  document.querySelectorAll("[data-sp]").forEach(b => { const on = b.dataset.sp === speakingId; b.textContent = on ? "■ Stop" : b.dataset.label; b.setAttribute("aria-pressed", on ? "true" : "false");
    const st = b.parentElement.querySelector(".state"); if (st) st.textContent = on ? (ttsState === "starting" ? "Starting…" : `Playing${voiceNow ? " · " + voiceNow : ""}`) : ""; });
};
if (typeof window !== "undefined" && typeof document !== "undefined") setTimeout(scriptDemo, 200);
if (typeof window !== "undefined") window.__kairouteScripts = { STOP_SCRIPTS, stops: c => { scriptStops(c); return (c.sites || []).map(s => ({ id: s.id, story: s.scriptV || '', onWalk: s.onWalk || null })); }, owners: c => { const o = scriptOwners(c); return { owner: [...o.owner].map(([k, v]) => [k, v.id]), walk: [...o.walk].map(([k, v]) => [k.id, v]) }; }, voices: GUIDES.map(g => g[3]), sayText, scriptStops, speech: (s, k) => partSpeech(s, k, true), play: s => speakSite(s), state: () => ({ speakingId, ttsState, voiceNow }) };
