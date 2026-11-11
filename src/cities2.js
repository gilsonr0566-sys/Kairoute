const CITY_SANTORINI = {
  city: "Santorini", country: "Greece", basics: GREECE_BASICS,
  starts: {
    cruise: [{ name: "Fira old port (tender landing)", lat: 36.4195, lng: 25.4270, note: "Tenders land below Fira. Ride the cable car up (expect lines) or walk the 600 steps. Allow an hour back down in the afternoon." }],
    hotel: [{ name: "Hotel in Fira", lat: 36.4167, lng: 25.4317 }, { name: "Hotel in Oia", lat: 36.4618, lng: 25.3753 }],
    point: [{ name: "Fira cable car top station", lat: 36.4170, lng: 25.4300 }]
  },
  sites: [
    { id: "fira", name: "Fira caldera path", lat: 36.4170, lng: 25.4310, minutes: 60, kind: "touristy", mustSee: true, category: "Viewpoint",
      summary: "The island's capital, on the rim of a drowned volcano.",
      guide: "You are standing on the rim of a volcano. About 3,600 years ago, one of the largest eruptions in human history blew the middle out of this island, and the sea rushed in to fill the crater, the caldera, 400 meters deep below you. Some believe it inspired the legend of Atlantis. Fira's white houses cling to the cliff edge. Walk north along the caldera path past the Orthodox cathedral and the blue-domed churches toward Firostefani, where the views get even better and the crowds thinner. Across the water you'll see the black lava islands of Nea Kameni, the volcano's still-active heart.",
      lookFor: ["The layered cliffs: red, black and white bands from different eruptions.", "Nea Kameni, the dark volcanic island in the middle of the caldera.", "Your ship, tiny, anchored far below."],
      photoTip: "From Firostefani, shoot back toward Fira with the caldera below.",
      hours: "Any time", tickets: "Free.", crowds: "Very busy 10:00–16:00 on multi-ship days.", cost: 0, indoor: false, access: "Many steps and narrow paths.",
      picks: [{ k: "timing", t: "Take the earliest tender you can. The cable car line back down can be over an hour by mid-afternoon, so head back early." }, { k: "spot", t: "Walk 15 minutes north to Firostefani for the same views with half the people." }] },
    { id: "oia", name: "Oia village", lat: 36.4618, lng: 25.3753, minutes: 120, kind: "touristy", mustSee: true, category: "Village",
      summary: "The famous blue domes and white houses at the island's tip.",
      guide: "Oia is the Santorini on every postcard: white cave houses carved into the cliff, windmills, and the blue domes of the Anastasi church. It was a village of sea captains in the 1800s, and you can still see their grand mansions. After an earthquake in 1956 it was nearly abandoned, then reborn with tourism. Walk the main marble lane, then down to the castle ruins at the far end, where crowds gather for the sunset. Below, steps lead to Ammoudi Bay, a little fishing harbor with seafood tavernas.",
      lookFor: ["The three blue domes of the Anastasi church.", "The windmills on the ridge.", "Ammoudi Bay far below the castle."],
      photoTip: "Above the Anastasi church on the main lane is the classic blue-dome shot.",
      hours: "Any time", tickets: "Free.", crowds: "Packed at sunset; easier mid-morning.", cost: 0, indoor: false, access: "Marble lanes and many steps.",
      picks: [{ k: "spot", t: "For the famous blue-dome photo, find the little lane just above the Anastasi church and the Saint Spyridon dome." }, { k: "timing", t: "Sunset is magical but risky on a port day; check your all-aboard time and the tender lines before staying." }] },
    { id: "akrotiri", name: "Akrotiri prehistoric town", lat: 36.3517, lng: 25.4033, minutes: 75, kind: "touristy", mustSee: false, category: "Ancient site",
      summary: "A Bronze Age town buried by the eruption, the 'Pompeii of the Aegean'.",
      guide: "When the volcano erupted 3,600 years ago, it buried this Minoan-era town under ash, preserving two- and three-story houses, streets and storage jars. Unlike Pompeii, no bodies were found, so the people probably had warning and escaped. Today a huge roof covers the site and you walk on raised walkways above the streets. The famous wall paintings of fishermen, boxing boys and swallows are in museums in Fira and Athens.",
      lookFor: ["Houses still standing three stories high.", "Huge clay storage jars still in place.", "The cracked staircase split by an earthquake before the eruption."],
      photoTip: "From the walkway, shoot down the main street of houses.",
      hours: "8:00–20:00 in summer", tickets: "About €20.", crowds: "Busiest midday.", cost: 20, indoor: true, access: "Walkways with ramps.",
      picks: [{ k: "spot", t: "Pair it with the Red Beach, a 10-minute walk away, for a dramatic photo stop." }] },
    { id: "pyrgos", name: "Pyrgos village", lat: 36.3833, lng: 25.4500, minutes: 60, kind: "local", mustSee: false, category: "Village",
      summary: "A quiet medieval hill village with 360-degree views.",
      guide: "Pyrgos is what Santorini looked like before the crowds. This medieval village spirals up a hill to a Venetian castle, with tiny churches at every turn. From the top you can see the whole island, the caldera on one side and the vineyards and sea on the other.",
      lookFor: ["The Venetian castle walls at the top.", "Church bells in the arches.", "The whole island from the summit."], photoTip: "From the top, looking over the white roofs to the caldera.",
      hours: "Any time", tickets: "Free.", crowds: "Quiet.", cost: 0, indoor: false, access: "Steep lanes and steps.",
      picks: [{ k: "taste", t: "Stop at a winery nearby, like Santo Wines, to taste Assyrtiko wine with caldera views." }] },
    { id: "prehistmus", name: "Museum of Prehistoric Thera", lat: 36.4155, lng: 25.4320, minutes: 45, kind: "local", mustSee: false, category: "Museum",
      summary: "The frescoes and finds from Akrotiri, right in Fira.",
      guide: "This small museum in Fira holds the best finds from Akrotiri: the lively wall paintings of blue monkeys and ladies gathering saffron, painted pottery, and a small gold ibex figurine. It's air-conditioned and a good break from the sun.",
      lookFor: ["The blue monkeys fresco.", "The gold ibex figurine."], photoTip: "No flash allowed.",
      hours: "8:00–15:00 (closed Tue)", tickets: "About €10.", crowds: "Quiet.", cost: 10, indoor: true, access: "Step-free.",
      picks: [{ k: "timing", t: "Visit right before going back down, if you have time to spare." }] }
  ],
  farther: [],
  restaurants: [
    { name: "Lucky's Souvlakis (Fira)", lat: 36.4165, lng: 25.4325, kind: "local", cuisine: "Souvlaki", price: "€", why: "Cheap, fast and much loved." },
    { name: "Ammoudi Fish Tavern", lat: 36.4600, lng: 25.3720, kind: "touristy", cuisine: "Seafood", price: "€€€", why: "On the water at Ammoudi Bay below Oia." },
    { name: "Metaxi Mas (Exo Gonia)", lat: 36.4035, lng: 25.4600, kind: "local", cuisine: "Cretan and Santorini", price: "€€", why: "Locals' favorite taverna in the hills." }
  ],
  gettingAround: [
    { mode: "Tender and cable car", tip: "Tenders land at Fira old port. The cable car takes 3 minutes but lines get long; tickets on board the ship sometimes give priority." },
    { mode: "Bus", tip: "KTEL buses run from Fira to Oia about every 20 to 30 minutes, 25 minutes each way." },
    { mode: "Taxi", tip: "Few taxis and long lines. Book a private driver for the day if you want to see several villages." }
  ]
};

const CITY_MYKONOS = {
  city: "Mykonos", country: "Greece", basics: GREECE_BASICS,
  starts: {
    cruise: [{ name: "Mykonos new port (Tourlos)", lat: 37.4600, lng: 25.3260, note: "Sea bus to the old harbor every 20 to 30 minutes, about 10 minutes." }],
    hotel: [{ name: "Hotel in Mykonos Town", lat: 37.4467, lng: 25.3289 }],
    point: [{ name: "Old harbor, Mykonos Town", lat: 37.4467, lng: 25.3289 }]
  },
  sites: [
    { id: "chora", name: "Mykonos Town (Chora) lanes", lat: 37.4455, lng: 25.3270, minutes: 75, kind: "touristy", mustSee: true, category: "Old town",
      summary: "A maze of whitewashed lanes, blue shutters and bougainvillea.",
      guide: "The lanes of Mykonos Town were built as a maze on purpose: the twisting alleys were meant to confuse pirates who raided the island. Today they confuse everyone, which is half the fun. Look for the white stone outlines painted around the paving, a local tradition, and the outdoor staircases painted bright blue, red and green. Matoyianni Street is the main shopping lane; wander off it to find tiny family chapels. The island has over 600 churches, many built by sailors to thank a saint for a safe voyage.",
      lookFor: ["The white outlines painted around each paving stone.", "Colored wooden balconies and staircases.", "The tiny family chapels, some barely big enough for two people."],
      photoTip: "Shoot down a narrow lane in the morning, before the shops open.",
      hours: "Any time", tickets: "Free.", crowds: "Lanes jam midday when several ships are in.", cost: 0, indoor: false, access: "Narrow, uneven lanes with steps.",
      picks: [{ k: "timing", t: "Wander early, between 8:00 and 10:00, when the lanes are empty and the light is soft." }, { k: "spot", t: "Look for Petros the pelican, the island's mascot, around the harbor." }] },
    { id: "windmills", name: "Kato Mili windmills", lat: 37.4440, lng: 25.3260, minutes: 30, kind: "touristy", mustSee: true, category: "Landmark",
      summary: "The row of white windmills on the ridge over Little Venice.",
      guide: "These windmills are the symbol of Mykonos. Most were built by the Venetians in the 1500s to grind wheat, using the island's strong north wind, the meltemi. Mykonos was a stop on the trade route, and ships loaded flour and bread here. Sixteen windmills once turned on the island; five stand on this ridge. One has been restored as a small museum.",
      lookFor: ["The thatched roofs and wooden sails.", "Little Venice's houses right on the water below.", "The meltemi wind; you'll feel it."],
      photoTip: "From the path below, shoot up at the windmills against the sky.",
      hours: "Any time", tickets: "Free.", crowds: "Busy at sunset.", cost: 0, indoor: false, access: "A short uphill path.",
      picks: [{ k: "timing", t: "Come before 10:00 for photos without crowds." }] },
    { id: "littlevenice", name: "Little Venice", lat: 37.4455, lng: 25.3255, minutes: 40, kind: "touristy", mustSee: true, category: "Waterfront",
      summary: "Captains' houses with balconies hanging right over the sea.",
      guide: "In the 1700s, wealthy sea captains built these houses with balconies hanging right over the water. Locals say pirates and smugglers could unload goods straight into their cellars. Today the houses are cafés and bars, and waves splash up under the tables on windy days. It's the best place on the island for an afternoon drink with the windmills in view.",
      lookFor: ["Balconies hanging over the water.", "Waves breaking against the house walls.", "The windmills on the hill across the bay."], photoTip: "From the windmill hill, shoot down at the houses on the water.",
      hours: "Any time", tickets: "Free.", crowds: "Packed at sunset.", cost: 0, indoor: false, access: "Narrow lanes.",
      picks: [{ k: "taste", t: "Grab a frappé, the iced Greek coffee, at a waterfront table late morning." }] },
    { id: "paraportiani", name: "Panagia Paraportiani church", lat: 37.4463, lng: 25.3255, minutes: 20, kind: "touristy", mustSee: false, category: "Church",
      summary: "A sculpted white church made of five chapels joined together.",
      guide: "Panagia Paraportiani is one of the most photographed churches in Greece. It's really five churches joined together, built between the 1400s and 1600s: four at ground level and one on top. Its soft, lumpy white walls look almost sculpted by hand, which they were, coat after coat of whitewash over centuries. Its name means 'Our Lady of the side gate', because it stood by the gate of the old castle.",
      lookFor: ["The five chapels joined into one shape.", "The thick, soft whitewash.", "The little bell tower."], photoTip: "From the sea side for the full sculpted shape.",
      hours: "Open at times; best seen outside", tickets: "Free.", crowds: "Busy midday.", cost: 0, indoor: false, access: "Flat.",
      picks: [{ k: "spot", t: "The best angle is from the low wall on the seaward side." }] }
  ],
  farther: [
    { id: "delos", name: "Delos island", lat: 37.3960, lng: 25.2680, minutes: 150, kind: "touristy", far: true, category: "Half-day",
      travel: "About 30 to 40 minutes each way by boat from the old harbor. Boats leave from about 9:00.",
      summary: "The sacred island, birthplace of Apollo, covered in ancient ruins.",
      guide: "Delos was the holiest island in ancient Greece, where Apollo and Artemis were said to be born. For centuries it was also a booming free port with tens of thousands of people. Now nobody lives here, and the whole island is an open-air museum. Walk past the famous Terrace of the Lions, the marble houses with mosaic floors, and climb Mount Kynthos for the view.",
      lookFor: ["The Terrace of the Lions.", "The House of Dionysus mosaic.", "The view from Mount Kynthos."], photoTip: "Shoot the lions with the sea behind them.",
      hours: "Boats in the morning; the site closes mid-afternoon", tickets: "Boat about €25, site about €15.", cost: 40, indoor: false, access: "Rough ground and no shade. Bring water and a hat.",
      picks: [{ k: "timing", t: "Take the first boat. The island has no shade and gets very hot." }] }
  ],
  restaurants: [
    { name: "Kounelas", lat: 37.4470, lng: 25.3285, kind: "local", cuisine: "Fish taverna", price: "€€", why: "Old fish taverna by the harbor; pick your fish." },
    { name: "Niko's Taverna", lat: 37.4460, lng: 25.3265, kind: "touristy", cuisine: "Greek", price: "€€", why: "Classic and reliable, near the church." },
    { name: "Kalita gyros", lat: 37.4460, lng: 25.3280, kind: "local", cuisine: "Gyros", price: "€", why: "Fast, cheap and good." }
  ],
  gettingAround: [
    { mode: "From the ship", tip: "Take the sea bus to the old harbor (about 10 minutes), or the shuttle bus." },
    { mode: "Walking", tip: "Everything in town is close; the windmills and Little Venice are 10 minutes from the harbor." }
  ]
};

const CITY_KUSADASI = {
  city: "Kusadasi", country: "Turkey",
  basics: {
    currency: "Turkish lira (euros widely accepted)", symbol: "₺", language: "Turkish", langCode: "tr",
    tipping: "About 10% in restaurants. Round up for drivers.",
    safety: "Safe. Shopkeepers can be persistent; a polite 'no thank you' works.",
    emergency: "112", plugs: "Type C/F, 230 V", water: "Drink bottled water.",
    phrases: [
      { local: "Merhaba", say: "MEHR-hah-bah", meaning: "Hello" },
      { local: "Teşekkür ederim", say: "teh-shek-KEWR eh-deh-reem", meaning: "Thank you" },
      { local: "Lütfen", say: "LEWT-fen", meaning: "Please" },
      { local: "Evet / Hayır", say: "eh-VET / HAH-yuhr", meaning: "Yes / No" },
      { local: "Ne kadar?", say: "neh kah-DAHR", meaning: "How much?" },
      { local: "Hayır, teşekkürler", say: "HAH-yuhr, teh-shek-kewr-LER", meaning: "No, thank you" }
    ]
  },
  starts: {
    cruise: [{ name: "Kusadasi cruise port", lat: 37.8620, lng: 27.2560, note: "Ephesus is about 20 minutes by taxi or tour bus." }],
    hotel: [{ name: "Hotel in Kusadasi center", lat: 37.8580, lng: 27.2610 }],
    point: [{ name: "Selçuk town center", lat: 37.9500, lng: 27.3680 }]
  },
  sites: [
    { id: "ephesus", name: "Ancient Ephesus", lat: 37.9395, lng: 27.3410, minutes: 150, kind: "touristy", mustSee: true, category: "Bible site",
      summary: "The great Roman city where Paul preached and the Ephesian church began.",
      guide: "Ephesus was one of the greatest cities of the Roman world, with perhaps 250,000 people. The Apostle Paul lived here for more than two years on his third journey (Acts 19), teaching daily in the lecture hall of Tyrannus, and his preaching so hurt the trade in silver idols of the goddess Artemis that the silversmith Demetrius started a riot. The crowd poured into the Great Theater, which still stands at the end of the Harbor Road, and shouted 'Great is Artemis of the Ephesians!' for two hours (Acts 19:28–34). Walk down marble Curetes Street, past the Temple of Hadrian and the terraced houses, to the Library of Celsus, its two-story façade rebuilt from the original stones. Later Paul wrote the letter to the Ephesians to this church, and in Revelation 2 it is the first of the seven churches.",
      lookFor: ["The Great Theater, which held 25,000 people during the riot of Acts 19.", "The façade of the Library of Celsus, once holding 12,000 scrolls.", "The marble Harbor Road, the Arcadian Way, which Paul would have known."],
      photoTip: "Arrive at the upper gate and walk downhill; shoot the Library of Celsus from the top of the steps on Curetes Street.",
      hours: "8:00–19:30 in summer", tickets: "About €40; the Terrace Houses are extra and worth it.", crowds: "Cruise groups fill it 9:00–13:00. Start early at the upper (Magnesian) gate.", cost: 40, indoor: false, access: "Long walk on uneven marble, little shade. Bring water and a hat.",
      picks: [{ k: "spot", t: "Start at the upper gate and walk downhill, so you finish at the theater and library without climbing." }, { k: "spot", t: "Pay extra for the Terrace Houses: covered Roman mansions with frescoes and mosaics, and almost no crowds." }, { k: "story", t: "Stand in the Great Theater and read Acts 19:23–41 aloud. The acoustics still carry a voice to the top row." }] },
    { id: "stjohn", name: "Basilica of Saint John", lat: 37.9530, lng: 27.3680, minutes: 45, kind: "local", mustSee: true, category: "Bible site",
      summary: "The great church built over the tomb of the Apostle John.",
      guide: "Tradition says the Apostle John lived his last years in Ephesus, caring for Mary as Jesus asked from the cross (John 19:26–27), and was buried on this hill. In the 500s, the emperor Justinian built a vast basilica over his tomb, one of the largest churches in the Christian world. Today you walk among its restored columns and marble floors to a simple slab marking the tomb, inside the ruins. From the hill you can see the single standing column of the Temple of Artemis below, one of the Seven Wonders of the ancient world, and the Isa Bey Mosque.",
      lookFor: ["The marked tomb of Saint John under the old altar.", "The baptistery, shaped for full immersion.", "The lone column of the Temple of Artemis in the field below."],
      photoTip: "From the upper walls, shoot over the basilica columns toward the Artemis column and mosque.",
      hours: "8:00–19:00 in summer", tickets: "About €8.", crowds: "Calm, even when Ephesus is packed.", cost: 8, indoor: false, access: "Mostly flat with some uneven ground.",
      picks: [{ k: "timing", t: "Go after Ephesus. It's 10 minutes away in Selçuk and quiet when the main site is crowded." }, { k: "story", t: "Some believe John wrote his Gospel here. The Book of Revelation was written on nearby Patmos." }] },
    { id: "marydouse", name: "House of the Virgin Mary", lat: 37.9118, lng: 27.3333, minutes: 45, kind: "touristy", mustSee: false, category: "Pilgrimage",
      summary: "A small stone chapel on a mountain, honored as Mary's last home.",
      guide: "On Mount Koressos, in the pine woods above Ephesus, stands a small stone house that many Christians believe was Mary's last home, where John brought her. It was found in 1881 by following visions described by a German nun. Popes have visited and Muslims honor Mary here too. Inside is a simple chapel. Outside, pilgrims drink from springs and tie prayers on a long wall of white cloths and paper.",
      lookFor: ["The simple chapel inside the stone house.", "The wishing wall covered with written prayers.", "The springs below the house."], photoTip: "Photography isn't allowed inside the house.",
      hours: "8:00–18:00", tickets: "About €15.", crowds: "Busy with tour buses midday.", cost: 15, indoor: true, access: "Gentle paths; some slopes.",
      picks: [{ k: "spot", t: "Write a prayer and tie it to the wall below the house." }] },
    { id: "artemis", name: "Temple of Artemis", lat: 37.9497, lng: 27.3639, minutes: 15, kind: "local", mustSee: false, category: "Ancient site",
      summary: "One lone column left of one of the Seven Wonders of the world.",
      guide: "Here stood the Temple of Artemis, once one of the Seven Wonders of the ancient world, four times bigger than the Parthenon. This is the 'Artemis of the Ephesians' the crowd shouted for in Acts 19. Burned in 356 BC and rebuilt, it was finally pulled down and its stones reused, some in the Basilica of Saint John on the hill. Now a single rebuilt column stands in a marshy field, often with a stork's nest on top.",
      lookFor: ["The lone column, often with a stork nest on top.", "The Basilica of Saint John on the hill above."], photoTip: "Shoot the column with the basilica and castle behind it.",
      hours: "Any time", tickets: "Free.", crowds: "Quiet.", cost: 0, indoor: false, access: "Flat.",
      picks: [{ k: "story", t: "A man burned the first temple just to make his name famous. The city banned saying his name, which is why it's still remembered." }] },
    { id: "pigeon", name: "Pigeon Island castle", lat: 37.8620, lng: 27.2490, minutes: 30, kind: "local", mustSee: false, category: "Landmark",
      summary: "A small fortress on an island linked to the town by a causeway.",
      guide: "Kusadasi means 'bird island', named after this little island joined to the shore by a causeway. A Byzantine and Ottoman fortress stands on it, built to guard the harbor against pirates. It's an easy walk from the ship and a nice place for sunset views back at the town.",
      lookFor: ["The fortress walls.", "The view of your ship and the town."], photoTip: "From the causeway back at the town.",
      hours: "Any time", tickets: "Free.", crowds: "Calm.", cost: 0, indoor: false, access: "Flat causeway.",
      picks: [{ k: "timing", t: "A perfect last stop on the way back to the ship." }] }
  ],
  farther: [],
  restaurants: [
    { name: "Selçuk köfte shops", lat: 37.9500, lng: 27.3685, kind: "local", cuisine: "Turkish meatballs", price: "€", why: "Selçuk is famous for köfte, grilled meatballs." },
    { name: "Ejder Restaurant (Selçuk)", lat: 37.9505, lng: 27.3675, kind: "touristy", cuisine: "Turkish", price: "€€", why: "Family place by the Roman aqueduct, popular with visitors." },
    { name: "Kaleiçi (old town) lokantas", lat: 37.8575, lng: 27.2600, kind: "local", cuisine: "Home cooking", price: "€", why: "Simple restaurants with stews and meze in Kusadasi's old quarter." }
  ],
  gettingAround: [
    { mode: "Taxi or private guide", tip: "Taxi to Ephesus upper gate is about 20 minutes. Agree the price first; many drivers will wait and take you to Saint John's too." },
    { mode: "Dolmuş minibus", tip: "Cheap minibuses run from Kusadasi to Selçuk and the Ephesus junction." },
    { mode: "Plan", tip: "Ephesus upper gate → walk down → Saint John's Basilica → Temple of Artemis → back to the ship. That's a full, relaxed day." }
  ]
};
