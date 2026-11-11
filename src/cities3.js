const ITALY_BASICS = {
  currency: "Euro", symbol: "€", language: "Italian", langCode: "it",
  tipping: "Not expected; a 'coperto' cover charge is common. Round up or leave a euro or two for good service.",
  safety: "Watch for pickpockets on buses, the metro and at big sights, especially in Rome and Naples.",
  emergency: "112", plugs: "Type F/L, 230 V", water: "Tap water is safe; Rome's street fountains (nasoni) are free and drinkable.",
  phrases: [
    { local: "Buongiorno", say: "bwon-JOR-noh", meaning: "Good morning / Hello" },
    { local: "Grazie", say: "GRAHT-see-eh", meaning: "Thank you" },
    { local: "Per favore", say: "pehr fah-VOH-reh", meaning: "Please" },
    { local: "Sì / No", say: "see / noh", meaning: "Yes / No" },
    { local: "Quanto costa?", say: "KWAHN-toh KOH-stah", meaning: "How much is it?" },
    { local: "Il conto, per favore", say: "eel KOHN-toh, pehr fah-VOH-reh", meaning: "The bill, please" },
    { local: "Dov'è il bagno?", say: "doh-VEH eel BAHN-yoh", meaning: "Where is the bathroom?" }
  ]
};

const CITY_MESSINA = {
  city: "Messina", country: "Italy", basics: ITALY_BASICS,
  starts: {
    cruise: [{ name: "Messina cruise terminal", lat: 38.1945, lng: 15.5560, note: "Right in town: the cathedral is a 10-minute walk." }],
    hotel: [{ name: "Hotel near the cathedral", lat: 38.1925, lng: 15.5545 }],
    point: [{ name: "Piazza del Duomo", lat: 38.1925, lng: 15.5545 }]
  },
  sites: [
    { id: "duomo-me", name: "Messina Cathedral and the astronomical clock", lat: 38.1925, lng: 15.5545, minutes: 50, kind: "touristy", mustSee: true, category: "Cathedral",
      summary: "A Norman cathedral with the world's largest astronomical clock.",
      guide: "Messina has been destroyed again and again, by plague, war and, worst of all, the earthquake and tsunami of 1908, which killed most of the city. The cathedral was rebuilt each time. Its bell tower holds the largest mechanical astronomical clock in the world, built in Strasbourg in 1933. Be in the square before noon: at 12:00, the clock comes alive for twelve minutes. A golden lion roars and waves a flag, a rooster crows, and figures parade through the tower telling the story of the city, including the legend of the Madonna della Lettera. Tradition says Messina sent envoys to Mary in Jerusalem after hearing Paul preach, and she wrote back a letter blessing the city.",
      lookFor: ["The roaring lion at the top of the tower at noon.", "The Madonna della Lettera scene in the clock.", "The Fountain of Orion in the square, from 1553."],
      photoTip: "Stand at the far side of the square to fit the whole tower in.",
      hours: "Cathedral about 7:00–19:00; clock show daily at 12:00", tickets: "Cathedral free; small fee to climb the bell tower.", crowds: "The square fills just before noon.", cost: 0, indoor: true, access: "Step-free into the cathedral.",
      picks: [{ k: "timing", t: "Plan your morning around being in the square at 11:50 for the noon show." }, { k: "spot", t: "Climb the bell tower after the show to see the clock's mechanism up close." }] },
    { id: "annunziata", name: "Santissima Annunziata dei Catalani", lat: 38.1915, lng: 15.5555, minutes: 15, kind: "local", mustSee: false, category: "Church",
      summary: "A small Arab-Norman church that survived the 1908 earthquake.",
      guide: "This little church from the 1100s is one of the few buildings that survived the 1908 earthquake. It mixes styles the Normans brought together in Sicily: Byzantine domes, Arab-style arches and Romanesque stone. It stands below today's street level, because the city was rebuilt higher on the rubble.",
      lookFor: ["The striped stone arches.", "The small dome.", "How it sits below the modern street."], photoTip: "From the street above, looking down.",
      hours: "Open at service times", tickets: "Free.", crowds: "Quiet.", cost: 0, indoor: false, access: "Steps down.",
      picks: [{ k: "story", t: "It gives you a sense of how much higher the rebuilt city is than the medieval one." }] },
    { id: "museo-me", name: "Regional Museum of Messina", lat: 38.2150, lng: 15.5590, minutes: 75, kind: "local", mustSee: false, category: "Museum",
      summary: "Two paintings by Caravaggio and an Antonello da Messina masterpiece.",
      guide: "Messina's museum holds treasures rescued from the earthquake, above all two late paintings by Caravaggio, painted here in 1609 while he was on the run: the Raising of Lazarus and the Adoration of the Shepherds. You'll also see the Polyptych of San Gregorio by Antonello da Messina, the city's own Renaissance master.",
      lookFor: ["Caravaggio's Raising of Lazarus.", "Antonello da Messina's polyptych."], photoTip: "No flash.",
      hours: "Tue–Sun about 9:00–19:00", tickets: "About €8.", crowds: "Quiet.", cost: 8, indoor: true, access: "Step-free.",
      picks: [{ k: "spot", t: "If you love art, this is the best-kept secret on the whole cruise." }] }
  ],
  farther: [
    { id: "taormina", name: "Taormina", lat: 37.8516, lng: 15.2853, minutes: 180, kind: "touristy", far: true, category: "Day trip",
      travel: "About 1 hour each way by car, tour or train plus shuttle.",
      summary: "A hilltop town with an ancient Greek theater looking at Mount Etna.",
      guide: "Taormina sits on a cliff over the sea, and its Greek theater, built in the 200s BC, has one of the most famous views in the world: the stage frames the coast and the smoking cone of Mount Etna. Walk Corso Umberto, the main street, to Piazza IX Aprile for the terrace view, and take a granita in a café.",
      lookFor: ["Mount Etna framed by the theater.", "The view from Piazza IX Aprile.", "Isola Bella, the little island below."], photoTip: "From the top of the theater toward Etna.",
      hours: "Theater 9:00 to about an hour before sunset", tickets: "Theater about €14.", cost: 14, indoor: false, access: "Hilly with steps.",
      picks: [{ k: "taste", t: "Try a granita with brioche at Bam Bar on Via Di Giovanni." }] },
    { id: "rhegium", name: "Reggio Calabria (ancient Rhegium)", lat: 38.1110, lng: 15.6470, minutes: 120, kind: "local", far: true, category: "Bible site",
      travel: "About 30 minutes each way by fast ferry across the strait.",
      summary: "Where Paul's ship stopped on the way to Rome, and home of the Riace bronzes.",
      guide: "In Acts 28:13, Paul's ship, sailing from Syracuse toward Rome after the shipwreck on Malta, 'arrived at Rhegium,' across the strait from Messina. Today Reggio's museum holds the Riace Bronzes, two spectacular Greek warrior statues found in the sea in 1972, and the seafront promenade is called the most beautiful kilometer in Italy.",
      lookFor: ["The Riace Bronzes in the National Museum.", "The seafront promenade.", "The view back to Sicily."], photoTip: "From the promenade across to Sicily.",
      cost: 8, indoor: true, hours: "Museum Tue–Sun 9:00–20:00",
      picks: [{ k: "story", t: "Read Acts 28:11–14: the whole last leg of Paul's voyage, Rhegium to Puteoli near Naples." }] }
  ],
  restaurants: [
    { name: "Pasticceria Irrera", lat: 38.1900, lng: 15.5520, kind: "local", cuisine: "Pastry and granita", price: "€", why: "Messina institution for granita and cannoli." },
    { name: "Trattoria del Popolo", lat: 38.1890, lng: 15.5540, kind: "local", cuisine: "Sicilian", price: "€€", why: "Swordfish, a Messina specialty, done simply." },
    { name: "Piazza Duomo cafés", lat: 38.1927, lng: 15.5548, kind: "touristy", cuisine: "Café", price: "€", why: "Watch the clock show with a coffee." }
  ],
  gettingAround: [
    { mode: "Walking", tip: "The port, cathedral and old center are all walkable." },
    { mode: "Taormina", tip: "Book a tour or driver; trains go to Taormina-Giardini station, then a shuttle up the hill." }
  ]
};

const CITY_NAPLES = {
  city: "Naples", country: "Italy", basics: ITALY_BASICS,
  starts: {
    cruise: [{ name: "Stazione Marittima (Naples cruise terminal)", lat: 40.8380, lng: 14.2550, note: "Right by the old town and the ferries to Capri and Sorrento." }],
    station: [{ name: "Napoli Centrale", lat: 40.8530, lng: 14.2725, note: "Circumvesuviana trains to Pompeii and Sorrento leave from the level below." }],
    hotel: [{ name: "Hotel near Piazza del Plebiscito", lat: 40.8359, lng: 14.2488 }],
    point: [{ name: "Piazza del Plebiscito", lat: 40.8359, lng: 14.2488 }]
  },
  sites: [
    { id: "spaccanapoli", name: "Spaccanapoli and the historic center", lat: 40.8490, lng: 14.2550, minutes: 75, kind: "local", mustSee: true, category: "Old town",
      summary: "The straight street that 'splits Naples', through the oldest living city in Europe.",
      guide: "Spaccanapoli means 'Naples splitter', and this long, straight street does just that, following the line of the Greek city founded here 2,500 years ago. Walk it from Piazza del Gesù and you pass churches, palaces, laundry hanging overhead, scooters and shrines on every corner. Turn into Via San Gregorio Armeno, the street of the nativity makers, where workshops sell handmade crib figures all year round, from shepherds to famous footballers. The whole old center is a UNESCO World Heritage Site.",
      lookFor: ["The nativity workshops on Via San Gregorio Armeno.", "Little street shrines to the Madonna and saints.", "The spiky façade of the Gesù Nuovo church."],
      photoTip: "Shoot down the length of Spaccanapoli from Piazza del Gesù.",
      hours: "Any time; shops about 9:30–19:30", tickets: "Free.", crowds: "Lively and busy; watch your bags.", cost: 0, indoor: false, access: "Cobbles, scooters and narrow pavements.",
      picks: [{ k: "spot", t: "Duck into the cloister of Santa Chiara, covered in hand-painted majolica tiles: a quiet garden in the chaos." }, { k: "taste", t: "Get a sfogliatella, the shell-shaped pastry, hot from Sfogliatella Mary at the Galleria." }] },
    { id: "sansevero", name: "Sansevero Chapel (Veiled Christ)", lat: 40.8494, lng: 14.2547, minutes: 40, kind: "touristy", mustSee: true, category: "Chapel",
      summary: "A marble Christ under a veil so fine it looks transparent.",
      guide: "In the middle of this small baroque chapel lies the Veiled Christ, carved in 1753 by Giuseppe Sanmartino from a single block of marble. The veil over Christ's body is so thin you can see the wounds and the face beneath it. For centuries people refused to believe it was carved, and claimed the prince who built the chapel, an alchemist, had turned real cloth into stone. Around it are other astonishing statues: Modesty, also veiled, and Disillusion, a man escaping a marble net.",
      lookFor: ["The veil over Christ's face.", "The marble net in 'Disillusion'.", "The anatomical machines in the crypt."], photoTip: "No photos allowed inside.",
      hours: "9:00–19:00 (closed Tue)", tickets: "Timed tickets online; small chapel, sells out.", crowds: "Book a slot in advance.", cost: 12, indoor: true, access: "Step-free main chapel; stairs to the crypt.",
      picks: [{ k: "timing", t: "Book the first slot online before you leave home. Walk-up lines can be an hour." }] },
    { id: "duomo-na", name: "Naples Cathedral and the Chapel of San Gennaro", lat: 40.8525, lng: 14.2597, minutes: 35, kind: "local", mustSee: false, category: "Cathedral",
      summary: "Home of the blood of Saint Januarius, the city's beloved patron.",
      guide: "Naples's cathedral holds the city's most precious relic: a vial of dried blood of San Gennaro, Saint Januarius, a bishop martyred in 305. Three times a year the blood is said to liquefy, and if it doesn't, Neapolitans fear disaster. The chapel of the treasure, with its gold and silver, is breathtaking. Inside the cathedral you can also see the Basilica of Santa Restituta, the oldest church in Naples, from the 300s, and a baptistery with some of the oldest Christian mosaics in the West.",
      lookFor: ["The Chapel of the Treasure of San Gennaro.", "The baptistery mosaics, from the 400s.", "Santa Restituta, the oldest church in Naples."], photoTip: "Shoot the gold ceiling of the treasury chapel.",
      hours: "About 8:30–13:30 and 14:30–19:30", tickets: "Free; small fee for the baptistery.", crowds: "Calm.", cost: 2, indoor: true, access: "Step-free.",
      picks: [{ k: "story", t: "The blood liquefies on the Saturday before the first Sunday in May, on September 19 and on December 16." }] },
    { id: "plebiscito", name: "Piazza del Plebiscito and the Royal Palace", lat: 40.8359, lng: 14.2488, minutes: 40, kind: "touristy", mustSee: false, category: "Square",
      summary: "A grand square with the royal palace, near the port.",
      guide: "This vast square is the grand front door of Naples, with the Royal Palace on one side and the domed church of San Francesco di Paola, modeled on the Pantheon, on the other. Across the street is the elegant glass-roofed Galleria Umberto I and the Teatro San Carlo, the oldest working opera house in the world, opened in 1737. It's a five-minute walk from the cruise terminal.",
      lookFor: ["The colonnade of San Francesco di Paola.", "The kings' statues on the palace façade.", "The glass dome of the Galleria Umberto."], photoTip: "From the middle of the square toward the church.",
      hours: "Any time; palace 9:00–20:00 (closed Wed)", tickets: "Square free; palace about €15.", crowds: "Open and roomy.", cost: 0, indoor: false, access: "Flat.",
      picks: [{ k: "taste", t: "Gran Caffè Gambrinus on the square is the city's grand historic café. Order an espresso standing at the bar." }] },
    { id: "museonaz", name: "National Archaeological Museum", lat: 40.8536, lng: 14.2505, minutes: 90, kind: "touristy", mustSee: false, category: "Museum",
      summary: "The treasures of Pompeii and Herculaneum.",
      guide: "Most of the best finds from Pompeii and Herculaneum are here, not at the sites. Don't miss the Alexander Mosaic, made of a million tiny stones, showing Alexander the Great fighting the Persian king. The Farnese Bull and Farnese Hercules are among the largest ancient statues to survive, and the 'Secret Cabinet' holds the Roman art once hidden from respectable visitors.",
      lookFor: ["The Alexander Mosaic.", "The Farnese Bull, carved from one block.", "Frescoes from Pompeii's villas."], photoTip: "Shoot details of the mosaic close up.",
      hours: "9:00–19:30 (closed Tue)", tickets: "About €22.", crowds: "Calmer in the afternoon.", cost: 22, indoor: true, access: "Step-free.",
      picks: [{ k: "spot", t: "If you're also visiting Pompeii, see this museum to imagine the walls in full color." }] }
  ],
  farther: [
    { id: "pompeii", name: "Pompeii", lat: 40.7489, lng: 14.4848, minutes: 180, kind: "touristy", far: true, category: "Day trip",
      travel: "About 40 minutes each way by Circumvesuviana train from Napoli Centrale, or by car.",
      summary: "The Roman city buried by Vesuvius in AD 79.",
      guide: "On August 24 in AD 79, Mount Vesuvius erupted and buried Pompeii under ash, freezing a whole Roman town in time. Walk its stone streets with ruts worn by carts, peek into bakeries with their ovens, fast-food counters and frescoed villas, and see the haunting plaster casts of people caught by the eruption. Vesuvius still looms over the forum.",
      lookFor: ["Stepping stones across the streets.", "The plaster casts of victims.", "The House of the Faun and the forum with Vesuvius behind."], photoTip: "From the forum, framing Vesuvius.",
      hours: "9:00–19:00 in summer", tickets: "About €22; book online.", cost: 22, indoor: false, access: "Rough stone streets, little shade.",
      picks: [{ k: "timing", t: "Go first thing in the morning, before the heat and the tour groups." }] },
    { id: "capri", name: "Capri", lat: 40.5532, lng: 14.2222, minutes: 240, kind: "touristy", far: true, category: "Day trip",
      travel: "About 50 minutes each way by fast ferry from Molo Beverello, right next to the cruise terminal.",
      summary: "A glamorous island of cliffs, sea caves and lemon groves.",
      guide: "Capri has been a playground since the Roman emperor Tiberius ruled the empire from his villa here. Ride the funicular up to the Piazzetta, then walk to the Gardens of Augustus for the view of the Faraglioni rocks. Boats leave the marina for the Blue Grotto, a sea cave lit electric blue, entered by lying down in a rowboat.",
      lookFor: ["The Faraglioni rocks from the Gardens of Augustus.", "The Blue Grotto.", "The tiny Piazzetta."], photoTip: "From the Gardens of Augustus over the Via Krupp hairpins.",
      cost: 50, indoor: false, hours: "Ferries from about 7:00", tickets: "Ferry about €25 each way; Blue Grotto boat extra.",
      picks: [{ k: "timing", t: "Take a ferry before 8:30 and come back by mid-afternoon to beat the crowds and keep time for the ship." }] },
    { id: "sorrento", name: "Sorrento", lat: 40.6263, lng: 14.3757, minutes: 180, kind: "touristy", far: true, category: "Day trip",
      travel: "About 40 minutes each way by ferry, or 1 hour on the Circumvesuviana train.",
      summary: "A cliff-top town of lemons, limoncello and views of Vesuvius.",
      guide: "Sorrento perches on cliffs over the Bay of Naples, with Vesuvius across the water. Walk the lanes of the old town, smelling lemons and limoncello, see the inlaid wood workshops, and stand at the Villa Comunale terrace for the view down to the marina.",
      lookFor: ["Lemon groves and limoncello shops.", "The Vallone dei Mulini, a gorge with an old mill.", "Vesuvius across the bay."], photoTip: "From the Villa Comunale terrace.",
      cost: 30, indoor: false, hours: "Any time",
      picks: [{ k: "taste", t: "Taste limoncello at a family shop on Via San Cesareo." }] },
    { id: "pozzuoli", name: "Pozzuoli (ancient Puteoli)", lat: 40.8230, lng: 14.1210, minutes: 90, kind: "local", far: true, category: "Bible site",
      travel: "About 30 minutes each way by metro line 2 or taxi.",
      summary: "The harbor where Paul landed in Italy and stayed a week with believers.",
      guide: "Acts 28:13–14 says Paul's ship 'came to Puteoli. There we found some brothers and sisters who invited us to spend a week with them. And so we came to Rome.' Puteoli was Rome's great grain port. Today Pozzuoli has a huge Roman amphitheater, the third largest in Italy, and the Temple of Serapis, a Roman market whose columns show how the ground here rises and sinks with the volcanic earth.",
      lookFor: ["The harbor where Paul landed.", "The Flavian Amphitheater.", "The columns of the Temple of Serapis, marked by sea creatures."], photoTip: "The Serapeum columns from the street above.",
      cost: 4, indoor: false, hours: "Amphitheater 9:00 to an hour before sunset (closed Tue)",
      picks: [{ k: "story", t: "Paul walked from here to Rome on the Appian Way, and believers came out to meet him (Acts 28:15)." }] }
  ],
  restaurants: [
    { name: "L'Antica Pizzeria da Michele", lat: 40.8497, lng: 14.2632, kind: "touristy", cuisine: "Pizza", price: "€", why: "Since 1870, only margherita and marinara. Take a number." },
    { name: "Sorbillo", lat: 40.8504, lng: 14.2560, kind: "local", cuisine: "Pizza", price: "€", why: "Neapolitans line up on Via dei Tribunali." },
    { name: "Trattoria da Nennella", lat: 40.8412, lng: 14.2468, kind: "local", cuisine: "Neapolitan home cooking", price: "€", why: "Noisy, fun and cheap in the Spanish Quarter." },
    { name: "Gran Caffè Gambrinus", lat: 40.8366, lng: 14.2483, kind: "touristy", cuisine: "Historic café", price: "€€", why: "Espresso and sfogliatella in belle époque rooms." }
  ],
  gettingAround: [
    { mode: "Walking", tip: "The port, Plebiscito and the historic center are walkable (about 20 minutes to Spaccanapoli)." },
    { mode: "Ferries", tip: "Molo Beverello, next to the cruise terminal, has fast ferries to Capri and Sorrento." },
    { mode: "Train", tip: "Circumvesuviana from Napoli Centrale (or Garibaldi) to Pompeii Scavi and Sorrento. Crowded; watch your bags." }
  ]
};

const CITY_ROME = {
  city: "Rome (from Civitavecchia)", country: "Italy", basics: ITALY_BASICS,
  starts: {
    cruise: [{ name: "Civitavecchia cruise port", lat: 42.0950, lng: 11.7900, note: "Rome is about 1 hour 15 minutes by train from Civitavecchia station, or 1.5 hours by car. Leave Rome by mid-afternoon." }],
    station: [{ name: "Roma San Pietro station", lat: 41.8966, lng: 12.4550, note: "First Rome stop from Civitavecchia, near the Vatican." }, { name: "Roma Termini", lat: 41.9010, lng: 12.5010 }],
    hotel: [{ name: "Hotel near Piazza Navona", lat: 41.8992, lng: 12.4731 }],
    point: [{ name: "Civitavecchia train station", lat: 42.0930, lng: 11.7950 }]
  },
  sites: [
    { id: "vatican", name: "St Peter's Basilica", lat: 41.9022, lng: 12.4539, minutes: 90, kind: "touristy", mustSee: true, category: "Basilica",
      summary: "The church built over the tomb of the Apostle Peter.",
      guide: "Christian tradition holds that the Apostle Peter was crucified in Nero's circus here around AD 64 and buried on this hill. Jesus had told him, 'You are Peter, and on this rock I will build my church' (Matthew 16:18), and those words run around the inside of the dome in giant letters. The present basilica was built between 1506 and 1626 by the greatest artists of the age: Bramante, Michelangelo, who designed the dome, and Bernini, who made the bronze canopy over the altar and the great colonnade outside, like two arms embracing the world. Just inside on the right is Michelangelo's Pietà, carved when he was only 24, the only work he ever signed.",
      lookFor: ["Michelangelo's Pietà, behind glass on the right as you enter.", "The words of Matthew 16:18 in Latin around the dome.", "The bronze statue of Peter, its foot worn smooth by pilgrims' hands."],
      photoTip: "From the obelisk in the square, frame the façade between Bernini's columns.",
      hours: "7:00–19:00 (shorter in winter)", tickets: "Free; dome climb about €10. Security line can be long. Cover shoulders and knees.", crowds: "Lines peak 10:00–13:00; go early.", cost: 0, indoor: true, access: "Step-free basilica; the dome is 320+ steps after the lift.",
      picks: [{ k: "spot", t: "Climb the dome: the lift takes you halfway, then narrow stairs to the top for all of Rome." }, { k: "timing", t: "Take the early train and walk from Roma San Pietro station; you'll be in St Peter's within 10 minutes." }, { k: "story", t: "The scavi tour (book months ahead) goes under the basilica to what's believed to be Peter's tomb." }] },
    { id: "colosseum", name: "Colosseum and Roman Forum", lat: 41.8902, lng: 12.4922, minutes: 120, kind: "touristy", mustSee: true, category: "Ancient site",
      summary: "The great arena and the heart of ancient Rome.",
      guide: "The Colosseum opened in AD 80 and held 50,000 people for gladiator fights and animal hunts. It was built by the emperor Vespasian, whose son Titus destroyed Jerusalem in AD 70; tradition says Jewish captives helped build it. Next door, walk down into the Roman Forum, the political heart of the empire. Under the Arch of Titus, you can see a carving of Roman soldiers carrying the menorah from the Temple in Jerusalem. Nearby is the Mamertine Prison, where tradition says Peter and Paul were held before their deaths.",
      lookFor: ["The menorah carved inside the Arch of Titus.", "The underground passages beneath the arena floor.", "The Mamertine Prison at the edge of the Forum."],
      photoTip: "From the upper level of the Forum (Palatine side), shoot the Colosseum framed by ruins.",
      hours: "8:30 to about an hour before sunset", tickets: "Timed tickets online only, released 30 days ahead. Combined with the Forum and Palatine.", crowds: "Very busy all day; book the first slot.", cost: 18, indoor: false, access: "Lift to the Colosseum upper level; the Forum is uneven.",
      picks: [{ k: "spot", t: "Visit the Mamertine Prison (Carcer Tullianum): the dark cell where Peter and Paul were held, with an altar today." }, { k: "story", t: "Paul's last letter, 2 Timothy, was likely written from a Roman prison: 'I have fought the good fight' (2 Timothy 4:7)." }] },
    { id: "pantheon", name: "Pantheon", lat: 41.8986, lng: 12.4769, minutes: 30, kind: "touristy", mustSee: true, category: "Temple and church",
      summary: "A 1,900-year-old temple with a perfect dome, now a church.",
      guide: "The Pantheon was rebuilt by the emperor Hadrian around AD 125, and it's the best-preserved building from ancient Rome. It survived because in 609 it became a church, Saint Mary and the Martyrs. Step inside and look up: the dome is still the largest unreinforced concrete dome in the world, 43 meters wide, exactly as high as it is wide. The only light comes through the open hole at the top, the oculus. When it rains, the water falls in and drains through little holes in the floor. The painter Raphael is buried here.",
      lookFor: ["The oculus and the beam of sunlight moving across the dome.", "The tiny drain holes in the floor.", "Raphael's tomb."], photoTip: "Shoot straight up at the oculus from the center.",
      hours: "9:00–19:00", tickets: "About €5.", crowds: "Lines move fast.", cost: 5, indoor: true, access: "Step-free.",
      picks: [{ k: "taste", t: "Tazza d'Oro, just off the square, is famous for granita di caffè with cream." }] },
    { id: "trevi", name: "Trevi Fountain", lat: 41.9009, lng: 12.4833, minutes: 20, kind: "touristy", mustSee: false, category: "Fountain",
      summary: "Rome's most famous baroque fountain.",
      guide: "The Trevi Fountain, finished in 1762, shows Oceanus, god of the sea, riding a shell chariot pulled by sea horses, one wild and one calm, for the moods of the sea. The water comes from an aqueduct built in 19 BC. Tradition says that if you throw a coin over your left shoulder with your right hand, you'll return to Rome. About €3,000 is collected each day and given to charity.",
      lookFor: ["The wild and calm sea horses.", "Oceanus at the center."], photoTip: "Early morning, before the crowds.",
      hours: "Any time", tickets: "Free (a small entry fee for the basin area is planned).", crowds: "Packed by day.", cost: 0, indoor: false, access: "Steps down to the basin.",
      picks: [{ k: "timing", t: "Only worth it early or late. At midday it's a crush." }] },
    { id: "navona", name: "Piazza Navona", lat: 41.8992, lng: 12.4731, minutes: 25, kind: "touristy", mustSee: false, category: "Square",
      summary: "A baroque square built on an ancient stadium.",
      guide: "Piazza Navona keeps the long oval shape of the Stadium of Domitian, which stood here in AD 86. In the middle is Bernini's Fountain of the Four Rivers, representing the Nile, Ganges, Danube and Río de la Plata. Facing it is the church of Sant'Agnese, by Bernini's rival Borromini. The church honors Agnes, a young Christian martyred at this very stadium.",
      lookFor: ["The four river gods of Bernini's fountain.", "The oval shape of the ancient stadium.", "Sant'Agnese in Agone."], photoTip: "From one end of the square along its length.",
      hours: "Any time", tickets: "Free.", crowds: "Lively day and night.", cost: 0, indoor: false, access: "Flat.",
      picks: [{ k: "story", t: "Local legend says the Nile god covers his eyes so as not to see Borromini's church. It's a myth, but a good one." }] }
  ],
  farther: [
    { id: "stpaulwalls", name: "Basilica of Saint Paul Outside the Walls", lat: 41.8587, lng: 12.4768, minutes: 50, kind: "local", far: true, category: "Bible site",
      travel: "About 20 minutes by metro line B from the Colosseum.",
      summary: "The great basilica over the tomb of the Apostle Paul.",
      guide: "Tradition holds that Paul was beheaded near Rome around AD 67 and buried here, on the road to Ostia. The emperor Constantine built the first church over his grave. Below the main altar you can see the marble slab inscribed 'Paulo Apostolo Mart', 'to Paul, apostle, martyr', and the chain that tradition says bound him. Around the nave runs a row of mosaic portraits of every pope, from Peter to today.",
      lookFor: ["The tomb of Saint Paul under the altar.", "The chain of Paul displayed by the tomb.", "The mosaic portraits of every pope."], photoTip: "From the courtyard with Paul's statue holding his sword.",
      hours: "7:00–18:30", tickets: "Free.", cost: 0, indoor: true, access: "Step-free.",
      picks: [{ k: "story", t: "Read Paul's farewell in 2 Timothy 4:6–8 at his tomb." }] }
  ],
  restaurants: [
    { name: "Da Enzo al 29 (Trastevere)", lat: 41.8875, lng: 12.4775, kind: "local", cuisine: "Roman trattoria", price: "€€", why: "Carbonara and cacio e pepe done right." },
    { name: "Pizzarium Bonci", lat: 41.9067, lng: 12.4469, kind: "local", cuisine: "Pizza by the slice", price: "€", why: "Famous pizza al taglio near the Vatican." },
    { name: "Armando al Pantheon", lat: 41.8985, lng: 12.4765, kind: "touristy", cuisine: "Roman", price: "€€", why: "Family-run since 1961, steps from the Pantheon. Book ahead." },
    { name: "Civitavecchia seafront cafés", lat: 42.0935, lng: 11.7930, kind: "touristy", cuisine: "Café", price: "€", why: "If you stay near the ship." }
  ],
  gettingAround: [
    { mode: "Train to Rome", tip: "Walk or take the free shuttle from the ship to Civitavecchia station. Regional trains to Roma San Pietro take about 1 hour 15 minutes; buy the 'BIRG' day ticket." },
    { mode: "In Rome", tip: "Metro line A for the Vatican, line B for the Colosseum and Saint Paul's. Taxis are white." },
    { mode: "Back to the ship", tip: "Aim to be on a train back by 16:30 at the latest for an evening all-aboard; strikes and delays happen." }
  ]
};
