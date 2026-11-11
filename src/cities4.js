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
