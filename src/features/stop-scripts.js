// Hand-written stop scripts (Richard, Nov 15): a finished, researched guide script for a stop, played one part
// at a time in Kairoute's own recorded voice (Aurora). Each part's words are recorded ahead (tools/voice-render.mjs,
// workflow "Record stop scripts") into audio/<id>/p<part>-<paragraph>.mp3, so they play at once, need no AI helper,
// and work offline after the first play. A paragraph whose recording is missing is read by the device voice.
// The research behind each script (sources, confidence labels) is kept with the project's tour scripts; the words
// here are the spoken script only. Later every stop gets a script built the same way (see the narration template).
// Pronunciations for the voice only: the screen shows the real spelling.
const SAY = [[/\borloj\b/gi, "orloy"], [/Mikuláš of Kadaň/g, "Mikulash of Kadan"], [/Jan Šindel/g, "Yan Shindel"], [/Šindel/g, "Shindel"],
  [/Hanuš/g, "Hanush"], [/Jan Růže/g, "Yan Roozheh"], [/Zdeněk Horský/g, "Zdenyek Horskee"], [/Vojtěch Sucharda/g, "Voytyekh Sookharda"],
  [/Josef Mánes/g, "Yosef Mahness"], [/Mánes/g, "Mahness"], [/Alois Jirásek/g, "Alois Yirahsek"], [/Jan Hus\b/g, "Yan Hooss"], [/\bHus\b/g, "Hooss"], [/Týn/g, "Teen"],
  [/Agios Titos/g, "Ah-yos Tee-tos"], [/Nikephoros Phokas/g, "Nikiforos Fokas"], [/Chandax/g, "Handax"], [/Athanasios Moussis/g, "Athanasios Moussees"], [/Gortyn/g, "Gortin"],
  [/Propylaia/g, "Propy-lay-ah"], [/Erechtheion/g, "Erek-thee-on"], [/Mnesikles/g, "Mnee-sih-kleez"], [/Iktinos/g, "Ik-tee-nos"], [/Kallikrates/g, "Kal-lick-ra-teez"], [/Pheidias/g, "Fye-dee-as"], [/Pentelikon/g, "Pen-tell-ih-kon"], [/Panagia Atheniotissa/g, "Panah-yee-ah Athee-nee-oh-tissa"], [/Peirene/g, "Pie-ree-nee"], [/Lechaion/g, "Leh-kay-on"], [/\bbema\b/g, "beema"], [/Achaea/g, "Ah-kee-ah"]];
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
}, {
  id: "athens-acropolis", v: 1, title: "The Acropolis and the Parthenon", where: "Acropolis, Athens",
  city: /\b(athens|athina|athen)\b/i, site: /^(the )?(acropolis|parthenon)\b(?!\s*(museum|promenade))/i,
  parts: [
    {
      "name": "Arrival: where to stand",
      "minutes": 3,
      "stand": "Just past the ticket gate at the west entrance, before the marble steps begin. Step to the side of the path, out of the stream of people, where you can look up at the big gateway of columns ahead and the small temple on its bastion to the right.",
      "paras": [
        "Here we are, at the foot of the most famous hill in Europe. Acropolis just means the high city, and for thousands of years this rock was the heart of Athens: its fortress, its treasury and, above all, its holy ground.",
        "Everything you're about to see up top was built in one burst of confidence in the four hundreds BC. In 480 BC the Persian army had captured Athens and burned the temples on this hill. A generation later, under the statesman Pericles, the Athenians rebuilt it all, bigger and finer than before.",
        "Two practical things before we climb. The marble on this hill has been polished by millions of feet, and it's slippery, even when it's dry. Take the steps slowly and hold the rail where there is one. And there's almost no shade up there, so have a sip of water now and keep your hat on.",
        "Right. Let's walk up through the front door of the ancient city."
      ]
    },
    {
      "name": "The gateway and the little temple of Victory",
      "minutes": 4,
      "stand": "the gateway of columns, the Propylaia, and the small temple on the bastion to your right.",
      "paras": [
        "This great gateway is the Propylaia. It was designed by the architect Mnesikles and built from 437 to 432 BC. Every procession in honour of Athena came through here, the way you're coming through now.",
        "Here's something most people walk straight past. The Propylaia was never finished. If you look closely at some of the outer walls, you can still see knobs of stone left sticking out, the lifting bosses that builders used to haul and set the blocks. Normally they were chiselled off at the end. Here, the work simply stopped in 432 BC, and nobody's sure exactly why. Cost, war, arguments about the sacred ground, maybe all three.",
        "Now look to your right, at the little temple perched on its own bastion. That's the Temple of Athena Nike, Athena of Victory, by the architect Kallikrates, finished around 420 BC. It's small, but it stands right at the edge, so anyone coming up the hill saw victory first.",
        "It's often wrapped in scaffolding or closed. Restoring this hill never really stops. Let's go on through the gateway."
      ]
    },
    {
      "name": "The Parthenon: a building with no straight lines",
      "minutes": 5,
      "stand": "On the open rock just past the gateway, a little to the left, where you see the west end of the Parthenon at an angle.",
      "paras": [
        "And there it is. The Parthenon, the temple of Athena Parthenos, Athena the Maiden, patron of this city.",
        "It went up fast. The building was raised between 447 and 438 BC, and its sculptures were finished by about 432. The architects were Iktinos and Kallikrates, and the great sculptor Pheidias oversaw all the carving. The marble is Pentelic marble, quarried on Mount Pentelikon, the mountain you can see on the skyline to the northeast on a clear day.",
        "Now here's the secret of this building. It looks perfectly straight, but almost nothing in it is. The platform the columns stand on rises gently towards the middle, about ten centimetres over seventy metres, so it doesn't look as if it sags. The columns swell very slightly as they rise, and they lean a little inward.",
        "Crouch down at the corner of the platform, if the ropes allow, and sight along the edge. You may just catch that gentle curve. The builders bent the stone so that your eye would see it straight. Two and a half thousand years later, it still works on us."
      ]
    },
    {
      "name": "What stood inside",
      "minutes": 4,
      "stand": "the long side of the Parthenon, looking at the gap between the columns.",
      "paras": [
        "Picture this building whole. Inside stood a colossal statue of Athena by Pheidias, made of gold and ivory. The historian Thucydides records that it carried forty talents of pure gold, and the Athenians thought of that gold as a reserve the city could draw on if it ever had to. The statue itself is long gone. We know it only from smaller ancient copies.",
        "Up under the roof ran a carved frieze of a great procession of riders, musicians and people bringing offerings to the goddess. The sculptures at the west end showed Athena and Poseidon competing to be the patron of the city.",
        "Many of those sculptures are no longer here. In the early 1800s, agents of the British ambassador, Lord Elgin, took down a large share of them and shipped them to England. They're in the British Museum today, and Greece has asked for many years for them to come home.",
        "What survives here in Athens is kept in the Acropolis Museum, at the foot of this hill. If you're going there, look for the frieze laid out at the same height and in the same order as it ran around this building."
      ]
    },
    {
      "name": "The Parthenon's other lives",
      "minutes": 4,
      "stand": "the middle of the Parthenon's long side, where the columns are missing.",
      "paras": [
        "Here's a part of the story most visitors never hear. The Parthenon wasn't a pagan temple for most of its life.",
        "By the end of the five hundreds AD it had become a Christian church, dedicated to the Virgin Mary. Later it was known as the church of the Panagia Atheniotissa, Our Lady of Athens, and for a time it was the city's cathedral. Christians worshipped under this roof for close to nine hundred years.",
        "Then the rulers changed. Crusader lords held Athens from 1204, and the Ottomans took the city in the 1450s. Within a few decades the building had been turned into a mosque.",
        "Now look at this gap in the middle. On the twenty-sixth of September 1687, a Venetian army under Francesco Morosini was bombarding the hill. The Ottoman garrison was storing gunpowder inside the Parthenon. A shell hit, the powder exploded, and the middle of the building was blown apart. What you're looking at is the scar of that one afternoon.",
        "The cranes and the scaffolding you see belong to Greece's restoration team, working here since 1975, putting back fallen marble block by block, and filling gaps with new marble from the same mountain. That's the lighter stone."
      ]
    },
    {
      "name": "The Erechtheion and the Maidens",
      "minutes": 4,
      "stand": "Across the rock to the north side, facing the porch held up by six statues of young women.",
      "paras": [
        "Now walk across to this smaller, stranger temple. It's the Erechtheion, built in the last decades of the four hundreds BC. It sits on uneven ground, so it has levels and porches on different sides, and it held some of the oldest, holiest places on the hill.",
        "And here are the Maidens, the Caryatids. Six young women carrying the roof on their heads, as calmly as if they were carrying water jars. The figures you see are copies. The originals were moved indoors to protect them. Five are in the Acropolis Museum, and the sixth was taken to London with Lord Elgin's collection.",
        "This is also where the Athenians placed their founding legend. As the story goes, Athena and Poseidon competed for the city. Poseidon struck the rock with his trident and brought up salt water. Athena gave an olive tree. The people chose the olive, and the city took her name.",
        "It's a legend, not history, but the Athenians took it seriously. The precinct beside this temple held the sacred olive of Athena, and marks in the rock under the north porch were pointed to as the strike of Poseidon's trident. Look for the olive tree growing beside the temple today. It was planted in modern times, standing in for the one in the story."
      ]
    },
    {
      "name": "The view, and the hill where Paul spoke",
      "minutes": 3,
      "stand": "At the railing on the northwest edge of the rock, looking down towards the bare rocky hill just below the entrance.",
      "paras": [
        "Come to the edge here and look down. That low, bare, rocky hill just below the entrance, the one with people standing on top, is the Areopagus. In English Bibles it's called Mars' hill.",
        "In the first century AD, the apostle Paul stood there and spoke to the people of Athens. The book of Acts, chapter seventeen, records his opening words in the King James Version: \"Ye men of Athens, I perceive that in all things ye are too superstitious. For as I passed by, and beheld your devotions, I found an altar with this inscription, TO THE UNKNOWN GOD.\"",
        "Think of what he could see while he spoke. He would have been looking up at this hill, at the Parthenon, gleaming and complete, with its golden goddess inside. And he told them that the God who made the world doesn't live in temples made with hands.",
        "For a photo, step back from the rail and catch the Parthenon at an angle from its western corner. You get the depth of the columns and that gentle curve all in one frame."
      ]
    },
    {
      "name": "Closing",
      "minutes": 2,
      "stand": "Back on the path down, before the gateway.",
      "paras": [
        "Before you head down, take one last look back at the Parthenon.",
        "It's been a temple, a treasury, a church of the Virgin Mary, a cathedral, a mosque and a gunpowder store. It's been blown apart, carried off in pieces, and patiently put back together by people who will never see the job finished.",
        "The people who built it thought they were building for their goddess. The people who prayed in it for close to nine hundred years thought it belonged to Christ. Every generation has found something worth saving in it. And now, for a few minutes, it was yours.",
        "Take the steps down slowly. Mars' hill, where Paul spoke, is just a few minutes' walk below the entrance."
      ]
    }
  ]
}, {
  id: "ancient-corinth", v: 1, title: "Ancient Corinth", where: "Ancient Corinth, Peloponnese",
  city: /\b(athens|athina|athen|corinth|korinthos|korinth)\b/i, site: /^(ancient|old|archaia) corinth\b/i,
  parts: [
    {
      "name": "Arrival: where to stand",
      "minutes": 3,
      "stand": "On the low hill beside the Temple of Apollo, the seven tall stone columns, just inside the site. Face the columns, with the wide open ruins of the Roman forum below you and the huge rock of Acrocorinth rising behind.",
      "paras": [
        "Here we are in Ancient Corinth. Look up first, at that enormous rock behind the town. That's Acrocorinth, the citadel of Corinth, and people held it as a fortress for well over two thousand years.",
        "Corinth sat on the narrow neck of land between mainland Greece and the Peloponnese, with a port on each sea, and that made it one of the richest cities in the Greek world.",
        "But the Corinth Saint Paul walked into wasn't that old Greek city. In 146 BC a Roman army under Lucius Mummius captured it and burned it. For about a century it lay mostly empty. Then, in 44 BC, Julius Caesar refounded it as a Roman colony, and it became the capital of the Roman province of Achaea.",
        "So the ruins below you are mostly a Roman city: busy, mixed, ambitious and new. Paul came to this city to preach, and stayed a year and a half. Let's start with the oldest thing still standing."
      ]
    },
    {
      "name": "The Temple of Apollo",
      "minutes": 3,
      "stand": "the seven columns of the Temple of Apollo.",
      "paras": [
        "These seven columns belong to the Temple of Apollo, a Doric temple built around 540 BC. They're older than the Parthenon in Athens by about a century.",
        "Look closely at one column. No drums stacked on top of each other, the way most Greek columns are built. Each one is a single piece of limestone, carved from one block. There were once thirty-eight of them all the way round. Earthquakes brought down the rest.",
        "This temple was here when Mummius burned the city, and it was still here when the Romans rebuilt around it. When Paul walked past, it was already about six hundred years old. Now let's go down into the forum, where the real story of this place happened."
      ]
    },
    {
      "name": "The forum and the judgment seat",
      "minutes": 5,
      "stand": "In the middle of the forum, in front of the raised stone platform in the row of shops along the south side.",
      "paras": [
        "This big open space was the forum, the market and civic centre of Roman Corinth. Shops, offices and temples ran all round it.",
        "And this raised stone platform in the middle of the south side is the bema, the speaker's platform where Roman officials sat in judgment. Excavators identified it as the judgment seat in the book of Acts. Nothing written on it says so, but it is the right kind of platform in the right place, and most scholars accept that this is very likely the spot.",
        "Here's what happened, from Acts, chapter eighteen. Paul's opponents brought him before the Roman governor, the proconsul Gallio, and accused him of persuading people to worship God against the law. Before Paul could even answer, Gallio cut them off. In the King James Version he says: \"If it were a matter of wrong or wicked lewdness, O ye Jews, reason would that I should bear with you: But if it be a question of words and names, and of your law, look ye to it; for I will be no judge of such matters.\" And he drove them from the judgment seat.",
        "Then, the text says, the crowd seized Sosthenes, the chief ruler of the synagogue, and beat him in front of the judgment seat, \"and Gallio cared for none of those things.\" Stand here a moment. You're standing where that scene very probably played out."
      ]
    },
    {
      "name": "The date carved in stone",
      "minutes": 3,
      "stand": "Still at the platform, looking out over the forum.",
      "paras": [
        "Here's why this little scene matters so much to historians. That governor, Gallio, is named in a letter from the Emperor Claudius, carved in stone and found at Delphi, across the gulf from here. The letter dates to about AD 52.",
        "That means Gallio's time here can be pinned down to around AD 51 to 52, and so can Paul's stay in Corinth. It's one of the firmest dates we have anywhere in Paul's life. Much of the timeline of his journeys is worked out from this one meeting in this one forum.",
        "And Acts tells us how Paul lived while he was here. He met a Jewish couple, Aquila and Priscilla, newly arrived from Rome, and because they shared a trade, he stayed with them and worked. They were tentmakers. Paul stayed in Corinth \"a year and six months, teaching the word of God among them.\""
      ]
    },
    {
      "name": "Peirene fountain",
      "minutes": 3,
      "stand": "At the Peirene fountain, the arched fountain house on the east side of the old Lechaion Road, at the north edge of the forum.",
      "paras": [
        "Walk with me to the north edge of the forum. That paved road running north is the Lechaion Road, which led down to Corinth's port on the Gulf of Corinth.",
        "And this deep, arched fountain house is Peirene, the most famous spring in Corinth. Water has fed it since long before the Romans. What you see today was rebuilt and decorated in the second century AD by the wealthy Athenian benefactor Herodes Atticus.",
        "This was the water supply of the city. Whoever came to draw water here in Paul's day, the slaves, the shopkeepers, the craftsmen, these were exactly the kind of people his letters were written to."
      ]
    },
    {
      "name": "The name in the pavement",
      "minutes": 3,
      "stand": "Near the theatre, at the paved square with the Latin inscription in the stone, if it is open to visitors.",
      "paras": [
        "Near the old theatre there's a paved square with a short Latin inscription set in the stone. It says, more or less: Erastus, in return for his aedileship, laid this pavement at his own expense. An aedile was a city official in charge of public works.",
        "Now, in his letter to the Romans, written from Corinth, Paul sends greetings from \"Erastus the chamberlain of the city.\" Is that the same man? Some scholars think so, and the pavement dates from around the right time. Others point out that the titles don't quite match, and Erastus was a common name.",
        "So the honest answer is: possibly. But it's a thrilling possibility, a name from the New Testament, carved by his own order, still lying in the ground."
      ]
    },
    {
      "name": "Closing: the letter to this city",
      "minutes": 3,
      "stand": "Back by the Temple of Apollo, looking down over the forum.",
      "paras": [
        "Before you go, look out over the forum one more time. This city was rich, crowded and divided, and Paul's letters to the church here are full of their quarrels.",
        "And yet it was to these people, in this city, that he wrote the words now read at weddings all over the world. In the King James Version: \"Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.\" And at the end: \"And now abideth faith, hope, charity, these three; but the greatest of these is charity.\"",
        "He didn't write that to a perfect church. He wrote it to the people who argued in this market, drew water at that fountain and stood in this crowd. Two thousand years later, the temples are broken columns. The words are still going."
      ]
    }
  ]
}];
// The script that belongs to a stop, if any.
const scriptFor = (s, city) => s && city && STOP_SCRIPTS.find(sc => sc.city.test(city.city || "") && sc.site.test(s.name + " " + (s.local || "")));
// Puts the script on the stop as its parts (the same parts the voice tour and the day plan already show). The AI
// walk-through never rewrites a stop with a script. Cheap and safe to call often.
function scriptStops(city) {
  if (!city || !STOP_SCRIPTS || !STOP_SCRIPTS.some(sc => sc.city.test(city.city || ""))) return;
  for (const s of city.sites || []) {
    const sc = scriptFor(s, city); if (!sc || s.scriptV === sc.id + sc.v) continue;
    s.parts = sc.parts.map(p => ({ name: p.name, spot: true, local: "", lat: s.lat, lng: s.lng, minutes: p.minutes, stand: p.stand, next: "", guide: p.paras.join("\n\n"), lookFor: "" }));
    s.partsOff = []; s.intro = ""; s.wrap = ""; s.extrasV = 99; s.scriptV = sc.id + sc.v;
    if (sc.show) s.show = Object.assign({ part: null }, sc.show);
  }
}
const scriptAudio = (sc, k, i) => `audio/${sc.id}/p${k}-${i}.mp3`;
// A scripted stop says exactly its script: no AI rewrite, no added opening.
const partSpeech0 = partSpeech;
partSpeech = function (s, k, first) { const sc = s && s.scriptV && STOP_SCRIPTS.find(x => s.scriptV === x.id + x.v); return sc && sc.parts[k] ? sc.parts[k].paras.join("\n\n") : partSpeech0(s, k, first); };
// Plays the recorded paragraphs of the given parts in order, with a guide's pause between them.
async function speakScript(id, sc, ks) {
  speakingId = id; audioMsg = "";
  kairouteSound(); // set up on the tap itself, which browsers require for audio
  try { natAudio.src = SILENT; natAudio.play().catch(() => {}); } catch (e) {} // claim the tap so the recording can play
  const g = GUIDES.find(x => x[0] === "aurora");
  for (let n = 0; n < ks.length; n++) {
    const paras = sc.parts[ks[n]].paras;
    for (let i = 0; i < paras.length; i++) {
      if (speakingId !== id) return;
      const ok = await new Promise(res => { natAudio.onended = () => res(true); natAudio.onerror = () => res(false);
        natAudio.src = scriptAudio(sc, ks[n], i); natAudio.preservesPitch = true; natAudio.defaultPlaybackRate = natAudio.playbackRate = GUIDE_PACE;
        natAudio.play().then(() => { voiceNow = `${g ? g[1] : "Aurora"}, natural voice`; ttsState = "speaking"; updateAudioUI(); }).catch(() => res(false)); });
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
<h2>${esc(sc.title)}</h2><p class="lede">${sc.parts.length} short parts, told by Aurora. Play it all, or tap any part to hear just that one.</p>
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
if (typeof window !== "undefined") window.__kairouteScripts = { STOP_SCRIPTS, sayText, scriptStops, speech: (s, k) => partSpeech(s, k, true), play: s => speakSite(s), state: () => ({ speakingId, ttsState, voiceNow }) };
