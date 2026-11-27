const CITY_MADRID = {
  city: "Madrid", country: "Spain",
  basics: {
    currency: "Euro", symbol: "€", language: "Spanish", langCode: "es",
    tipping: "Not expected. Round up at a bar; 5–10% for good table service.",
    safety: "Safe. Watch for pickpockets on the metro, in Puerta del Sol and at the Rastro market.",
    emergency: "112", plugs: "Type C/F, 230 V", water: "Madrid's tap water is excellent.",
    phrases: [
      { local: "Hola", say: "OH-lah", meaning: "Hello" },
      { local: "Gracias", say: "GRAH-thee-ahs", meaning: "Thank you" },
      { local: "Por favor", say: "por fah-VOR", meaning: "Please" },
      { local: "¿Cuánto cuesta?", say: "KWAN-toh KWES-tah", meaning: "How much is it?" },
      { local: "La cuenta, por favor", say: "lah KWEN-tah, por fah-VOR", meaning: "The bill, please" },
      { local: "Una caña, por favor", say: "OO-nah KAN-yah", meaning: "A small draft beer, please" }
    ]
  },
  starts: {
    airport: [{ name: "Madrid-Barajas Airport, Terminal 4", lat: 40.4917, lng: -3.5933, note: "About 25 minutes to the center by taxi (flat fare), or the airport express bus." }, { name: "Madrid-Barajas Airport, Terminals 1–3", lat: 40.4680, lng: -3.5700 }],
    station: [{ name: "Madrid Atocha station", lat: 40.4065, lng: -3.6895, note: "High-speed trains from Barcelona arrive here. Walk to the Prado in 10 minutes." }, { name: "Madrid Chamartín station", lat: 40.4722, lng: -3.6825 }],
    hotel: [
      { name: "Hotel near Puerta del Sol", lat: 40.4169, lng: -3.7035 },
      { name: "Hotel near Gran Vía", lat: 40.4200, lng: -3.7050 },
      { name: "Hotel in the Barrio de las Letras", lat: 40.4140, lng: -3.6990 },
      { name: "Hotel near Atocha", lat: 40.4085, lng: -3.6920 }
    ],
    point: [{ name: "Puerta del Sol", lat: 40.4169, lng: -3.7035 }]
  },
  sites: [
    { id: "prado", name: "Prado Museum", lat: 40.4138, lng: -3.6921, minutes: 120, kind: "touristy", mustSee: true, category: "Museum",
      summary: "One of the world's great art museums: Velázquez, Goya, El Greco.",
      guide: "The Prado holds the Spanish royal collection, gathered by kings over five centuries. Head first for Velázquez's Las Meninas, in Room 12. It shows the little princess Margarita with her maids, a dwarf and a dog, while Velázquez himself paints at a huge canvas, and the king and queen appear only in a mirror at the back, as if standing where you are. Then find Goya, from his sunny tapestry designs to the Third of May 1808, a man in a white shirt facing a firing squad with his arms raised. Downstairs are Goya's Black Paintings, painted on the walls of his house in old age. Don't miss El Greco's stretched, glowing saints, and Bosch's Garden of Earthly Delights.",
      lookFor: ["Velázquez painting himself into Las Meninas, and the king and queen in the mirror.", "The man in the white shirt in Goya's Third of May.", "The strange creatures in Bosch's Garden of Earthly Delights."],
      photoTip: "Photos aren't allowed inside; shoot Velázquez's statue at the main entrance.",
      hours: "Mon–Sat 10:00–20:00, Sun 10:00–19:00", tickets: "Book online. Free the last two hours of each day (long line).", crowds: "Quietest at opening and at lunchtime.", cost: 15, indoor: true, access: "Step-free with lifts.",
      picks: [{ k: "timing", t: "Go at 10:00 with a ticket, head straight to Las Meninas, and you'll have it nearly to yourself." }, { k: "spot", t: "Pick up the free map and follow the 'masterpieces' route if you only have two hours." }] },
    { id: "palacio", name: "Royal Palace", lat: 40.4180, lng: -3.7143, minutes: 90, kind: "touristy", mustSee: true, category: "Palace",
      summary: "Western Europe's largest royal palace, with over 3,000 rooms.",
      guide: "The Royal Palace was built in the 1700s after the old fortress burned down on Christmas Eve 1734. With over 3,400 rooms, it's the largest royal palace in Western Europe, though the king doesn't live here; it's used for state ceremonies. Inside, walk the grand staircase, the Throne Room with its red velvet walls and Tiepolo ceiling, and the Royal Armory, full of suits of armor for knights, horses and even child princes. Next door stands the Almudena Cathedral, finished only in 1993.",
      lookFor: ["The Throne Room with its lions.", "The Stradivarius instruments in the royal chapel area.", "Child-size armor in the Royal Armory."],
      photoTip: "From the Plaza de la Armería between the palace and cathedral.",
      hours: "10:00–19:00 (to 18:00 in winter)", tickets: "Book online; free for EU residents some evenings.", crowds: "Busy late morning.", cost: 14, indoor: true, access: "Mostly step-free.",
      picks: [{ k: "timing", t: "On Wednesdays (and some Saturdays) at 11:00 there's a changing of the guard at the palace gate." }, { k: "spot", t: "The Sabatini Gardens beside the palace are free and lovely at sunset." }] },
    { id: "mayor", name: "Plaza Mayor and Puerta del Sol", lat: 40.4155, lng: -3.7074, minutes: 40, kind: "touristy", mustSee: true, category: "Square",
      summary: "The grand arcaded square and the bustling center of Spain.",
      guide: "Plaza Mayor, finished in 1619, is a vast enclosed square ringed by arcades and 237 balconies. Over the centuries it hosted bullfights, royal celebrations and even trials of the Spanish Inquisition. Look for the painted façade of the Casa de la Panadería on the north side. Walk five minutes east to Puerta del Sol, the busy heart of Madrid. A plaque on the ground in front of the old post office marks Kilometer Zero, the point from which all of Spain's roads are measured, and nearby is the statue of the bear and the strawberry tree, the city's symbol.",
      lookFor: ["The painted Casa de la Panadería.", "The Kilometer Zero plaque in Sol.", "The bear and strawberry tree statue."], photoTip: "From the middle of Plaza Mayor toward the painted façade.",
      hours: "Any time", tickets: "Free.", crowds: "Busy all day.", cost: 0, indoor: false, access: "Flat.",
      picks: [{ k: "taste", t: "Have a calamari sandwich, bocadillo de calamares, at a bar just off Plaza Mayor. It's a Madrid classic." }] },
    { id: "retiro", name: "Retiro Park", lat: 40.4153, lng: -3.6845, minutes: 60, kind: "local", mustSee: false, category: "Park",
      summary: "Madrid's great park, with a boating lake and a glass palace.",
      guide: "The Retiro was a royal retreat until 1868, when it opened to the public. Today it's where Madrid relaxes. Rent a rowing boat on the big lake, beneath the monument to King Alfonso XII, then walk to the Crystal Palace, a glass and iron greenhouse from 1887 that now hosts art exhibitions. In the rose garden you'll find the Fallen Angel fountain, said to be one of the few public statues of the devil in the world.",
      lookFor: ["The Crystal Palace reflected in its pond.", "Rowing boats on the Estanque.", "The Fallen Angel fountain."], photoTip: "The Crystal Palace from across its little lake.",
      hours: "6:00–22:00 (to midnight in summer)", tickets: "Free; boats about €6.", crowds: "Lively on weekends.", cost: 0, indoor: false, access: "Flat paths.",
      picks: [{ k: "timing", t: "Perfect right after the Prado: it's next door and shady in the afternoon heat." }] },
    { id: "reinasofia", name: "Reina Sofía Museum (Guernica)", lat: 40.4086, lng: -3.6943, minutes: 75, kind: "touristy", mustSee: false, category: "Museum",
      summary: "Modern art, and Picasso's Guernica.",
      guide: "This museum of modern art is home to Picasso's Guernica, one of the most powerful paintings of the 20th century. Picasso painted it in 1937 after German and Italian planes bombed the Basque town of Guernica during the Spanish Civil War. It's huge, almost eight meters wide, and painted only in black, white and grey: a screaming mother with her dead child, a fallen soldier, a horse in agony and a bull. There are also works by Dalí and Miró.",
      lookFor: ["Guernica, in Room 205.", "The light bulb shaped like an eye at the top.", "Dalí's works nearby."], photoTip: "No photos of Guernica.",
      hours: "Mon, Wed–Sat 10:00–21:00, Sun 10:00–14:30 (closed Tue)", tickets: "About €12; free some evenings.", crowds: "Busy in free hours.", cost: 12, indoor: true, access: "Step-free.",
      picks: [{ k: "spot", t: "It's right by Atocha station, an easy first stop after your train arrives." }] },
    { id: "sanginés", name: "Chocolatería San Ginés", lat: 40.4170, lng: -3.7068, minutes: 25, kind: "touristy", mustSee: false, category: "Food stop",
      summary: "Churros and thick hot chocolate since 1894.",
      guide: "San Ginés has served churros and thick hot chocolate since 1894, around the clock for much of its history. Madrileños come here after a night out, and visitors come any time. Order 'chocolate con churros' and dip the crisp fried dough into chocolate thick enough to stand a spoon in. Try the porras too, a thicker churro.",
      lookFor: ["The green-and-wood façade.", "Photos of famous visitors on the walls."], photoTip: "Your cup and churros on the marble table.",
      hours: "Open long hours, often 8:00 to late night", tickets: "About €6.", crowds: "Lines at peak times move fast.", cost: 6, indoor: true, access: "Step-free.",
      picks: [{ k: "taste", t: "Order porras as well as churros, and share." }] },
    { id: "almudena", name: "Almudena Cathedral", lat: 40.4157, lng: -3.7146, minutes: 25, kind: "local", mustSee: false, category: "Cathedral",
      summary: "Madrid's cathedral, over a century in the making.",
      guide: "Madrid only got a cathedral in 1993, when Pope John Paul II consecrated this one after 110 years of work. Outside it looks classical to match the palace; inside the ceilings are painted in bold modern colors. It's dedicated to the Virgin of the Almudena, Madrid's patron, whose statue legend says was hidden in the city walls during the Moorish era and found again in 1085.",
      lookFor: ["The colorful modern ceiling.", "The statue of the Virgin of the Almudena.", "The crypt below, one of the oldest parts."], photoTip: "From the palace square, the cathedral's dome.",
      hours: "10:00–20:00", tickets: "Free; small fee for the dome museum.", crowds: "Calm.", cost: 0, indoor: true, access: "Step-free.",
      picks: [{ k: "spot", t: "Climb to the dome viewing terrace for views over the palace." }] }
  ],
  farther: [
    { id: "toledo", name: "Toledo", lat: 39.8628, lng: -4.0273, minutes: 240, kind: "touristy", far: true, category: "Day trip",
      travel: "About 35 minutes each way by high-speed train from Atocha.",
      summary: "The medieval city of three faiths, on a hill above the Tagus river.",
      guide: "Toledo, the old capital of Spain, sits on a rocky hill wrapped by the Tagus river. For centuries Christians, Muslims and Jews lived here side by side. Visit the vast Gothic cathedral, the Santa María la Blanca synagogue with its horseshoe arches, and the little church of Santo Tomé to see El Greco's masterpiece, the Burial of the Count of Orgaz.",
      lookFor: ["El Greco's Burial of the Count of Orgaz.", "The synagogue's white horseshoe arches.", "The view from the Mirador del Valle across the river."], photoTip: "From the Mirador del Valle at sunset.",
      cost: 30, indoor: false, hours: "Cathedral about 10:00–18:00",
      picks: [{ k: "taste", t: "Try marzipan, Toledo's specialty, from Santo Tomé shop." }] },
    { id: "escorial", name: "El Escorial monastery", lat: 40.5893, lng: -4.1477, minutes: 150, kind: "local", far: true, category: "Day trip",
      travel: "About 1 hour each way by commuter train or bus.",
      summary: "Philip II's vast monastery-palace and royal pantheon.",
      guide: "King Philip II built El Escorial in the 1500s as a monastery, palace, library and burial place for Spanish kings, all in one stern granite block. See the library's painted ceilings, the royal apartments where Philip died, and the Pantheon of the Kings, where almost every Spanish monarch since Charles V lies in marble.",
      lookFor: ["The painted library ceiling.", "The Pantheon of the Kings.", "Philip II's simple bedroom facing the altar."], photoTip: "The full façade from the plaza.",
      cost: 14, indoor: true, hours: "10:00–19:00 (closed Mon)" }
  ],
  restaurants: [
    { name: "Sobrino de Botín", lat: 40.4140, lng: -3.7080, kind: "touristy", cuisine: "Castilian roast", price: "€€€", why: "The world's oldest restaurant (1725): roast suckling pig. Book ahead." },
    { name: "Casa Lucio", lat: 40.4120, lng: -3.7085, kind: "local", cuisine: "Madrid classics", price: "€€€", why: "Famous for huevos rotos, broken eggs over fries." },
    { name: "Mercado de San Miguel", lat: 40.4154, lng: -3.7090, kind: "touristy", cuisine: "Tapas market", price: "€€", why: "Glass market hall with tapas stalls by Plaza Mayor." },
    { name: "Casa Labra", lat: 40.4176, lng: -3.7040, kind: "local", cuisine: "Tapas bar", price: "€", why: "Cod croquettes since 1860, just off Sol." },
    { name: "La Venencia", lat: 40.4153, lng: -3.6990, kind: "local", cuisine: "Sherry bar", price: "€", why: "Old-world sherry bar; no photos, no tipping." },
    { name: "Chocolatería San Ginés", lat: 40.4170, lng: -3.7068, kind: "touristy", cuisine: "Churros", price: "€", why: "Churros and chocolate since 1894." }
  ],
  gettingAround: [
    { mode: "Walking", tip: "Sol, Plaza Mayor, the Royal Palace, the Prado and Retiro are all within a 25-minute walk of each other." },
    { mode: "Metro", tip: "Clean and easy. Line 1 links Atocha and Sol. A 10-ride card saves money." },
    { mode: "Airport", tip: "Taxis to the center have a flat fare (about €33). The Exprés Aeropuerto bus runs from Atocha 24 hours." }
  ]
};

// Register the built-in guides, under the names travelers are likely to type.
// More Athens and Corinth stops, from Richard's own Athens & Corinth itinerary (Nov 11).
CITY_ATHENS.sites.push(
  {
    id: "theatre-dionysus", name: "Theatre of Dionysus", lat: 37.9703, lng: 23.7278, minutes: 30, kind: "touristy", mustSee: false, category: "Ancient theater",
    summary: "The birthplace of Western theater, on the south slope of the Acropolis.",
    guide: "You are sitting where drama was born. Every spring Athens honored Dionysus, god of wine and theater, with a festival of plays, and the great tragedies of Aeschylus, Sophocles and Euripides, and the comedies of Aristophanes, were first performed on this slope, at first on wooden seats. The stone theater around you was built in the 330s BC and held perhaps fifteen thousand people. Look at the front row: carved marble thrones were reserved for priests and officials, and the grandest one, in the very center, belonged to the priest of Dionysus himself. Then look at the stage front, carved in Roman times with scenes from the god's life. Sit for a moment, look up at the Acropolis rock above you, and picture a whole city laughing and weeping together.",
    lookFor: ["The carved throne of the priest of Dionysus in the center of the front row.", "Names carved on the front-row seats, reserving them for officials.", "The Roman relief carvings on the front of the stage."],
    photoTip: "Shoot from the upper seats down toward the stage, with the city behind it.",
    hours: "Same as the Acropolis, 8:00–20:00 in summer", closed: "", tickets: "Included in the Acropolis ticket; enter at the south-slope gate near the Acropolis Museum.",
    crowds: "Quiet even when the Acropolis is busy; most groups walk straight past.", cost: 0, indoor: false, access: "Uneven stone and steps; the lower rows are easiest.",
    picks: [
      { k: "spot", t: "Start your Acropolis visit here at the south-slope gate. You avoid the main-gate line and walk up past the theater." },
      { k: "story", t: "Playwrights competed here for a prize, and the audience was famously loud: they hissed, drummed their heels and threw food at plays they disliked." },
      { k: "timing", t: "Come first thing in the morning, while the slope is still in shade." }
    ]
  },
  {
    id: "promenade", name: "Acropolis promenade (Dionysiou Areopagitou and Apostolou Pavlou)", lat: 37.9700, lng: 23.7235, minutes: 30, kind: "local", mustSee: false, category: "Walk",
    summary: "The car-free walk that circles below the Acropolis, past cafés, olive trees and views.",
    guide: "This wide, car-free walkway is how Athenians stroll around their ancient heart. It was pedestrianized for the 2004 Olympics and joins the main archaeological sites, so you can walk from the Acropolis Museum, past the Theatre of Dionysus and the Odeon of Herodes Atticus, all the way to the Ancient Agora without crossing traffic. Notice the street names. The first part is Dionysiou Areopagitou, named for Dionysius the Areopagite, the Athenian judge who believed when Paul preached on the hill above. The second part is Apostolou Pavlou, Apostle Paul Street. In the evening locals walk, street musicians play, and the Acropolis lights up above you. It's the best free show in Athens.",
    lookFor: ["The street sign for Apostolou Pavlou, Apostle Paul Street.", "The arches of the Odeon of Herodes Atticus, still used for summer concerts.", "Glass panels in the pavement near the museum showing ancient ruins below."],
    photoTip: "At dusk, photograph the floodlit Parthenon from the café terraces along Apostolou Pavlou.",
    hours: "Open all the time", closed: "", tickets: "Free.",
    crowds: "Busiest at sunset; lovely early in the morning.", cost: 0, indoor: false, access: "Wide, smooth paving; one of the easiest walks in central Athens. Some marble sections are slippery when wet.",
    picks: [
      { k: "timing", t: "Walk it at sunset, from the Acropolis Museum toward Thissio, so the Acropolis glows on your right." },
      { k: "taste", t: "Stop for a freddo espresso, Greek iced coffee, at one of the terraces on Apostolou Pavlou facing the rock." },
      { k: "story", t: "Acts 17:34 names Dionysius the Areopagite as one of the first Athenians to believe after Paul spoke on Mars Hill. This street carries his name." }
    ]
  },
  {
    id: "agia-ekaterini", name: "Agia Ekaterini (St Catherine's Church)", lat: 37.9706, lng: 23.7304, minutes: 20, kind: "local", mustSee: false, category: "Byzantine church",
    summary: "A small 11th-century Byzantine church in Plaka, sunk below street level among Roman columns.",
    guide: "Step down into this little courtyard and you're standing below the level of the modern street, at the height of Byzantine Athens. Agia Ekaterini was built in the 11th century, and its domed shape and brick patterns are classic Middle Byzantine work. In front of it stand two Roman columns, remains of an older building that once stood here, so this one spot holds Roman, Byzantine and modern Athens together. The church is named for Saint Catherine because in 1767 it was given to the famous Monastery of Saint Catherine on Mount Sinai. It's still a working parish church, so step inside quietly, light a candle if you wish, and notice how dim and warm it feels compared with the bright marble of the Acropolis.",
    lookFor: ["The two Roman columns in the sunken courtyard.", "The brick-and-stone patterns on the outer walls, typical of Byzantine builders.", "The icon of Saint Catherine with her wheel inside."],
    photoTip: "From the street above, shoot down into the courtyard to show the columns and the dome together.",
    hours: "Usually open in the morning and early evening for services", closed: "", tickets: "Free. Dress modestly: shoulders and knees covered.",
    crowds: "Rarely busy.", cost: 0, indoor: true, access: "Steps down to the courtyard.",
    picks: [
      { k: "spot", t: "It's a two-minute walk from the Lysicrates Monument, the 4th-century BC monument at the end of Tripodon Street. See both together." },
      { k: "timing", t: "Go in the morning, when it's most likely to be open and you may hear the chanting of a service." },
      { k: "story", t: "Churches like this were built small on purpose. Byzantine Athens was a modest town, and its people built their churches into and over the ruins of the ancient city." }
    ]
  },
  {
    id: "kapnikarea", name: "Panagia Kapnikarea", lat: 37.9762, lng: 23.7285, minutes: 15, kind: "local", mustSee: false, category: "Byzantine church",
    summary: "An 11th-century Byzantine church standing in the middle of Ermou, Athens' busiest shopping street.",
    guide: "Shoppers stream around this little church every day, but it was here long before any of them. Panagia Kapnikarea was built in the 11th century and is dedicated to the Presentation of the Virgin Mary in the Temple. When Athens was replanned as Greece's new capital in the 1830s, the church stood in the way of the new Ermou Street and was going to be demolished. It was saved, the story goes, by King Ludwig of Bavaria, father of Greece's first king, Otto. So the street was built around it, and that's why it sits in the middle of the road. Inside, the paintings are modern, by Fotis Kontoglou, who revived the true Byzantine icon style in the 20th century. Step in, let your eyes adjust, and find the Virgin in the apse.",
    lookFor: ["The way Ermou Street splits to pass on both sides of the church.", "The Byzantine cross-in-square shape: a central dome over four arms.", "Kontoglou's paintings of the Virgin and Christ inside."],
    photoTip: "Shoot from a few meters up Ermou to frame the dome against the modern shop fronts.",
    hours: "Usually open in the morning and early evening", closed: "", tickets: "Free. Dress modestly.",
    crowds: "The street is crowded, but the church itself is calm.", cost: 0, indoor: true, access: "Level street; a small step at the door.",
    picks: [
      { k: "spot", t: "It's on the way between Syntagma and Monastiraki. Pause here as you walk down Ermou, then continue to the Roman Agora." },
      { k: "story", t: "The church belongs to the University of Athens, which still looks after it." },
      { k: "taste", t: "Grab a koulouri, the sesame bread ring sold from street carts all along Ermou." }
    ]
  },
  {
    id: "roman-agora", name: "Roman Agora and Tower of the Winds", lat: 37.9744, lng: 23.7263, minutes: 40, kind: "touristy", mustSee: false, category: "Ancient site",
    summary: "The Roman-era marketplace, with an ancient weather station and water clock.",
    guide: "When Rome ruled Athens, the city's market moved here. Julius Caesar and then Augustus paid for this square, finished around the time of Christ's birth, and you can still walk through its grand west gate, the Gate of Athena Archegetis. But the star is the octagonal marble tower at the east end, the Tower of the Winds, built in the 1st century BC by the astronomer Andronikos of Kyrrhos. Each of its eight sides faces a compass direction and is carved with the god of that wind. Bearded, heavy-cloaked Boreas blows cold from the north, and gentle young Zephyros scatters flowers from the west. Below them are sundial lines, and inside was a water clock fed from the Acropolis, so this was a clock, a compass and a weather vane in one.",
    lookFor: ["The eight wind gods carved around the top of the tower. Find cold Boreas and gentle Zephyros.", "Sundial lines cut below each wind god.", "The Gate of Athena Archegetis and the old Fethiye Mosque in the square."],
    photoTip: "Shoot the tower from the northeast corner in the morning, when the sun lights the carved winds.",
    hours: "8:00–20:00 in summer (shorter in winter)", closed: "", tickets: "Included in the combined Acropolis-area ticket, or buy a single ticket at the gate.",
    crowds: "Usually calm; you can see much of it through the railings from the street.", cost: 8, indoor: false, access: "Mostly level gravel and paving.",
    picks: [
      { k: "spot", t: "Walk all the way around the tower. Each wind god is different, and the north side is the best preserved." },
      { k: "story", t: "Later the Ottomans used the tower as a hall where whirling dervishes performed their dances." },
      { k: "taste", t: "Around the corner on Kyrrestou, small cafés serve loukoumades, Greek honey doughnuts." }
    ]
  },
  {
    id: "nam", name: "National Archaeological Museum", lat: 37.9890, lng: 23.7327, minutes: 120, kind: "touristy", mustSee: false, category: "Museum",
    summary: "Greece's greatest museum of ancient art, from gold masks to the world's oldest computer.",
    guide: "If you want to see the treasures of ancient Greece in one building, this is the place. Start with the Mycenaean room and the gold death mask that Heinrich Schliemann called the Mask of Agamemnon, more than 3,000 years old. Then find the bronze god from Artemision, probably Zeus, about to hurl a thunderbolt, his arms stretched wide in perfect balance, pulled from the sea in the 20th century. Nearby is the little bronze Jockey of Artemision, a boy on a galloping horse. And don't miss the Antikythera Mechanism, corroded gears found in a shipwreck, now known to be an ancient device for predicting eclipses and the movements of the heavens. It's often called the world's first computer.",
    lookFor: ["The gold Mask of Agamemnon in the Mycenaean hall.", "The bronze Zeus (or Poseidon) of Artemision with his arms spread.", "The gear wheels of the Antikythera Mechanism."],
    photoTip: "Photograph the Artemision bronze from the side to show his full arm span. No flash.",
    hours: "8:00–20:00 in summer (shorter in winter; check opening times on Tuesdays)", closed: "", tickets: "Buy online or at the door; lines are rarely long.",
    crowds: "Calmer than the Acropolis Museum; quietest in the late afternoon.", cost: 12, indoor: true, access: "Fully accessible, with lifts.",
    picks: [
      { k: "timing", t: "Perfect for a hot afternoon or a rainy day. It's indoors, cool, and the garden café is a nice break." },
      { k: "spot", t: "The Antikythera Mechanism room has a reconstruction that shows how the gears worked. Look at that before the original." },
      { k: "story", t: "The Artemision bronze lay on the seabed for over 2,000 years, so no one knows for sure whether he's Zeus or Poseidon. The missing thunderbolt or trident would settle it." }
    ]
  },
  {
    id: "byzantine-museum", name: "Byzantine and Christian Museum", lat: 37.9755, lng: 23.7445, minutes: 75, kind: "local", mustSee: false, category: "Museum",
    summary: "Icons, mosaics and frescoes telling the story of Christianity in Greece.",
    guide: "This museum tells the story of how the Greek world became Christian, and it does it beautifully. You start with early Christian carvings and the first symbols believers used, the fish, the dove and the Good Shepherd, then move into the Byzantine centuries, with gold-leaf icons, whole painted church walls, mosaics, embroidered vestments and illuminated manuscripts. Some icons were carried out of Constantinople and Asia Minor by refugees, so each has a journey behind it. The building is a story too: the villa was built in the 1840s for the Duchess of Plaisance, a French aristocrat who loved Athens. Take your time in front of one icon, look at the eyes, and remember that for Orthodox Christians an icon is a window, not just a painting.",
    lookFor: ["Early Christian symbols: the fish, the dove and the Good Shepherd.", "Gold-leaf icons of the Virgin and Christ from the Byzantine centuries.", "Frescoes removed from churches and rebuilt on the museum walls."],
    photoTip: "The villa's courtyard with its fountain makes a calm photo; inside, shoot icons without flash.",
    hours: "Usually 8:00–20:00 in summer (shorter in winter); check the days before you go", closed: "", tickets: "Buy at the door; rarely a line.",
    crowds: "Quiet. One of the calmest museums in Athens.", cost: 8, indoor: true, access: "Mostly accessible; galleries are underground with ramps and lifts.",
    picks: [
      { k: "spot", t: "Ask for the early Christian gallery first. It shows how the faith grew in the same cities Paul visited." },
      { k: "timing", t: "Pair it with the National Garden, a 15-minute walk away, for a quiet afternoon." },
      { k: "story", t: "Orthodox believers kiss icons and light candles before them, a tradition fiercely defended in the 8th and 9th centuries when emperors tried to ban images." }
    ]
  },
  {
    id: "national-garden", name: "National Garden", lat: 37.9729, lng: 23.7371, minutes: 30, kind: "local", mustSee: false, category: "Park",
    summary: "A shady royal garden behind Parliament, with ponds, ruins and quiet paths.",
    guide: "Step off busy Syntagma Square and in a few steps the noise drops away. This garden was created in the late 1830s for Queen Amalia, Greece's first queen, who had plants brought from all over the world. Today it's a public park, and Athenians come here to escape the heat. Wander the shaded paths and you'll find duck ponds, turtles, old palms, a small café, and pieces of the ancient city, including Roman mosaic floors uncovered right in the garden. At its southern edge stands the grand Zappeion hall, built in the 1880s, and beyond it the Temple of Olympian Zeus. It's the perfect gentle start to Athens on your first afternoon.",
    lookFor: ["The Roman mosaic floors uncovered in the garden.", "The turtles and ducks in the central pond.", "The Zappeion hall at the southern edge."],
    photoTip: "The tall palm avenue near the Amalias Avenue entrance makes a lovely shaded photo.",
    hours: "Sunrise to sunset", closed: "", tickets: "Free.",
    crowds: "Peaceful, even in summer.", cost: 0, indoor: false, access: "Flat gravel paths, easy for wheelchairs and strollers.",
    picks: [
      { k: "spot", t: "Enter from Syntagma right after watching the changing of the guard. The gate is just beside the Parliament." },
      { k: "timing", t: "On a hot afternoon, this is the coolest place in central Athens." },
      { k: "taste", t: "The little café near the Zappeion serves cold drinks and Greek coffee under the trees." }
    ]
  },
  {
    id: "philopappos", name: "Philopappos Hill", lat: 37.9677, lng: 23.7196, minutes: 45, kind: "local", mustSee: false, category: "Viewpoint",
    summary: "The pine-covered hill facing the Acropolis, with the city's best sunset view.",
    guide: "This is the hill Athenians climb to look at the Acropolis, not from it. The paths through the pines were laid out in the 1950s by the architect Dimitris Pikionis, and they're works of art in themselves. As you climb you pass the little church of Agios Dimitrios Loumbardiaris, and at the top stands the marble monument of Philopappos, a prince of Commagene who loved Athens and was honored here around AD 115. Then turn around. The Parthenon is right across from you at eye level, with the city spreading to the mountains and the sea beyond. At sunset the marble turns honey-gold and the lights of Athens come on below. It's the farewell view of Athens.",
    lookFor: ["The Parthenon at eye level across the valley.", "The Philopappos Monument at the summit.", "The Pikionis stone paths and the little church of Agios Dimitrios."],
    photoTip: "Shoot the Parthenon from the summit about 20 minutes before sunset, when the light is warm on the marble.",
    hours: "Open all the time; paths are best by daylight", closed: "", tickets: "Free.",
    crowds: "Busy at sunset with locals, but there's room for everyone.", cost: 0, indoor: false, access: "Steep in places, on uneven stone paths. Wear good shoes.",
    picks: [
      { k: "timing", t: "Arrive 45 minutes before sunset to walk up slowly and find a rock to sit on." },
      { k: "spot", t: "Just below the summit, the rocks on the Acropolis side give a clear view without the crowd at the monument." },
      { k: "story", t: "A cave on the hillside is traditionally called the Prison of Socrates, though historians doubt he was ever held there." }
    ]
  }
);
CITY_ATHENS.farther.push(
  {
    id: "corinth-canal", name: "Corinth Canal", lat: 37.9353, lng: 22.9878, minutes: 30, kind: "touristy", category: "Landmark", far: true,
    travel: "About 1 hour west of Athens by car or tour coach on the highway; trains run to Corinth, then a short taxi.",
    summary: "A narrow, dizzying cut through solid rock linking the Aegean and Ionian seas.",
    guide: "Walk to the middle of the bridge and look down. The walls of the canal drop almost straight to the water far below, and the channel is only about 25 meters wide, so big ships must be towed through. The idea is ancient. In Paul's time, ships were dragged across this narrow neck of land on a stone track called the Diolkos, and in AD 67 the emperor Nero himself struck the first blow with a golden shovel to start a canal, but the work was abandoned. It was finally finished in 1893. Paul knew this place well. Corinth had two ports, one on each sea, and Acts 18:18 tells us Paul sailed from Cenchreae, the eastern port, at the end of his long stay in Corinth.",
    lookFor: ["The sheer rock walls dropping to the water.", "Ships being towed through by tugboats, if you're lucky.", "The bridges that sink into the water to let ships pass, at each end of the canal."],
    photoTip: "Shoot straight down the length of the canal from the middle of the pedestrian bridge.",
    hours: "Open all the time", closed: "", tickets: "Free to view from the bridge.", crowds: "Tour coaches stop here mid-morning; the visit is short anyway.",
    cost: 0, indoor: false, access: "Level pavement on the viewing bridge.",
    picks: [
      { k: "timing", t: "Stop here on the way to Ancient Corinth; it's right on the route." },
      { k: "story", t: "Romans 16:1 commends Phoebe, a leader of the church at Cenchreae, the same port Paul sailed from." },
      { k: "spot", t: "At the eastern end, near Isthmia, the sinking bridge drops below the water when a ship passes. It's well worth seeing if you have time." }
    ]
  },
  {
    id: "acrocorinth", name: "Acrocorinth", lat: 37.8899, lng: 22.8696, minutes: 75, kind: "local", category: "Fortress", far: true,
    travel: "A 10-minute drive up from Ancient Corinth (about 1 hour 20 minutes from Athens); taxis wait at Ancient Corinth.",
    summary: "The mighty fortress on the mountain above Ancient Corinth.",
    guide: "High above the ruins of Ancient Corinth rises this great rock, nearly 575 meters tall, crowned with walls built by Byzantines, Franks, Venetians and Ottomans, each in turn. You enter through three gates, one inside another. At the very top once stood a temple of Aphrodite, and the ancient writer Strabo described the wealth and the loose morals of the city below, which helps explain why Paul's letters to the Corinthians speak so plainly about faithfulness and love. Find a spot on the walls and look down. The whole of Paul's Corinth is spread out beneath you, the forum, the Temple of Apollo and the plain, all the way to the sea and the gulf where his ships came and went.",
    lookFor: ["The three gates, built one inside another.", "The view down to Ancient Corinth and the Temple of Apollo.", "The Upper Peirene spring, an ancient underground fountain."],
    photoTip: "From the upper walls, photograph the gulf of Corinth with the ancient site below in late-afternoon light.",
    hours: "Daytime only, often closing in mid-afternoon; check before you go", closed: "", tickets: "Usually free.",
    crowds: "Few visitors. You may have the walls to yourself.", cost: 0, indoor: false, access: "Steep, rough, slippery paths. Not suitable for limited mobility. Wear good shoes and bring water.",
    picks: [
      { k: "timing", t: "Go after Ancient Corinth, in the later afternoon, but check the closing time first." },
      { k: "story", t: "1 Corinthians 13, the famous chapter on love, was written to the church in the city you see below." },
      { k: "spot", t: "You don't need to reach the summit. The first gate's walls already give a superb view." }
    ]
  }
);

const BUILTIN_CITIES = [
  [CITY_ATHENS, ["athens", "athens piraeus", "piraeus", "athina"]],
  [CITY_HERAKLION, ["heraklion", "heraklion crete", "iraklion", "iraklio"]],
  [CITY_CHANIA, ["chania", "chania crete", "souda", "chania souda bay"]],
  [CITY_SANTORINI, ["santorini", "santorini greece", "thira", "fira"]],
  [CITY_MYKONOS, ["mykonos", "mykonos greece"]],
  [CITY_KUSADASI, ["kusadasi", "kusadasi ephesus", "kusadasi turkey", "ephesus"]],
  [CITY_MESSINA, ["messina", "messina sicily", "messina italy"]],
  [CITY_NAPLES, ["naples", "naples capri sorrento", "naples italy", "napoli"]],
  [CITY_ROME, ["civitavecchia", "civitavecchia rome", "rome civitavecchia", "rome", "roma"]],
  [CITY_MADRID, ["madrid", "madrid spain"]]
];
