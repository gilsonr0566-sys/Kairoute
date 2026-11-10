const SAMPLE_CITY = {
  city: "Barcelona",
  country: "Spain",
  starts: {
    cruise: [
      { name: "Moll Adossat cruise terminals", lat: 41.3530, lng: 2.1700, note: "Most big ships dock here. A port shuttle bus runs to the Columbus Monument." },
      { name: "World Trade Center cruise terminal", lat: 41.3714, lng: 2.1797, note: "Smaller ships. You can walk into the old town from here." }
    ],
    airport: [
      { name: "Barcelona Airport, Terminal 1", lat: 41.2889, lng: 2.0731, note: "About 30 minutes into the center by taxi or Aerobús." },
      { name: "Barcelona Airport, Terminal 2", lat: 41.3038, lng: 2.0727, note: "About 30 minutes into the center by taxi or Aerobús." }
    ],
    hotel: [
      { name: "Hotel near Plaça de Catalunya", lat: 41.3870, lng: 2.1700 },
      { name: "Hotel on Passeig de Gràcia", lat: 41.3925, lng: 2.1650 },
      { name: "Hotel at Port Olímpic", lat: 41.3868, lng: 2.1963 }
    ],
    station: [
      { name: "Barcelona Sants station", lat: 41.3792, lng: 2.1400, note: "High-speed trains to Madrid, Girona and France." },
      { name: "Estació de França", lat: 41.3843, lng: 2.1856 }
    ],
    point: [
      { name: "Barcelona Sants train station", lat: 41.3792, lng: 2.1400 },
      { name: "Plaça d'Espanya", lat: 41.3751, lng: 2.1490 }
    ]
  },
  sites: [
    { id: "sagrada", name: "Sagrada Família", lat: 41.4036, lng: 2.1744, minutes: 90, kind: "touristy", mustSee: true, category: "Basilica",
      summary: "Gaudí's unfinished basilica, under construction since 1882.",
      guide: "You are standing in front of the most famous building site in the world. Antoni Gaudí took over this church in 1883 and spent the last forty years of his life on it, knowing he would never see it finished. He planned eighteen spires: twelve for the apostles, four for the evangelists, one for Mary and the tallest, for Jesus, which at 172 meters is meant to stay just below the height of Montjuïc hill, because Gaudí felt his work should not rise above God's. Start with the Nativity façade, the one Gaudí finished himself. It faces the sunrise and is crowded with life: turtles carry the columns, birds and plants climb the stone, and the story of Christ's birth unfolds in the middle. Then walk around to the Passion façade, carved decades later by Josep Maria Subirachs, all hard angles and bare bone. Inside, the columns branch like trees, and the stained glass turns the nave blue and green on the east side and orange and red on the west as the sun moves.",
      lookFor: ["The turtle and tortoise carrying columns at the base of the Nativity façade: one from the land, one from the sea.", "The magic square on the Passion façade, where every row adds up to 33, Christ's age at his death.", "Stand in the middle of the nave and look straight up at the ceiling, where the tree columns open into a canopy of light."],
      photoTip: "Cross to the pond in Plaça de Gaudí for the classic reflection shot of the Nativity façade." },
    { id: "parkguell", name: "Park Güell", lat: 41.4145, lng: 2.1527, minutes: 75, kind: "touristy", mustSee: true, category: "Park",
      summary: "Gaudí's hillside garden city, with mosaic terraces and city views.",
      guide: "Park Güell began as a business plan that failed. Count Eusebi Güell wanted a gated garden suburb for wealthy families, with sixty houses on this hill. Only two were built, and the city bought the land in 1922 and opened it as a park. What remains is Gaudí at his most playful. The two gatehouses at the entrance look like gingerbread, and the double staircase is guarded by the famous mosaic lizard, often called the dragon. Above it, the Hypostyle Room was meant to be the market hall: 86 columns hold up the great square, and the ceiling is decorated with mosaic suns made from broken plates and bottles. Up top, the long serpentine bench curves along the terrace. It was shaped by a worker sitting in wet plaster so it would fit the human back. The viaducts through the woods are built from rough stone dug from the site, so they look as if they grew out of the hill.",
      lookFor: ["The mosaic lizard on the main staircase. Look closely at the pieces: they are broken tiles, a technique called trencadís.", "The four large mosaic medallions on the Hypostyle ceiling, each a sun for one season.", "Sit on the serpentine bench and notice how the curve supports your back."],
      photoTip: "From the terrace, frame the gatehouses with the city and the sea behind them." },
    { id: "batllo", name: "Casa Batlló", lat: 41.3917, lng: 2.1650, minutes: 60, kind: "touristy", mustSee: true, category: "Gaudí house",
      summary: "The 'house of bones', a dragon of a building on Passeig de Gràcia.",
      guide: "Locals call this the House of Bones, and once you see the balconies you will know why: they look like skulls, and the pillars on the ground floor look like bones. Gaudí remodelled an ordinary 1870s building for the textile family Batlló between 1904 and 1906, and almost nothing inside has a straight line. The most popular reading of the façade is the legend of Saint George, patron saint of Catalonia. The roof is the dragon's back, with scaly tiles that shift from green to blue to pink. The cross on the tower is the saint's lance, and the skull balconies are the dragon's victims. Inside, the light well is tiled in blues that get darker toward the top, so the light feels even on every floor. It is a small engineering trick that still works today.",
      lookFor: ["The roof ridge: rounded tiles like scales, with the cross-topped tower as Saint George's lance.", "Balconies shaped like masks or skulls.", "In the light well, notice the tiles fading from pale to deep blue as you look up."],
      photoTip: "Stand across Passeig de Gràcia in the late afternoon when the sun lights the façade." },
    { id: "pedrera", name: "Casa Milà (La Pedrera)", lat: 41.3954, lng: 2.1620, minutes: 60, kind: "touristy", mustSee: false, category: "Gaudí house",
      summary: "A rippling stone apartment block with a rooftop of warrior chimneys.",
      guide: "When Casa Milà was finished in 1912, people mocked it. They called it La Pedrera, the stone quarry, because its pale wavy façade looked like a cliff face. Today it is one of the most loved buildings in the city. Gaudí built it without any load-bearing walls inside, using a frame of columns and arches, so the owners could move the walls around as they wished. That was decades ahead of its time. The iron balconies look like tangled seaweed and were designed with the sculptor Josep Maria Jujol. The best part is the roof. Climb up and you walk among chimneys and ventilation towers that look like helmeted guards. Under the roof, the attic is held up by 270 brick arches, shaped like the ribs of a whale.",
      lookFor: ["The 'warrior' chimneys on the roof. Some say they inspired the Star Wars stormtroopers.", "The seaweed-like wrought-iron balconies on the façade.", "The brick arches in the attic, each a slightly different height."],
      photoTip: "From the corner of Carrer de Provença you can fit the whole wavy façade in one frame." },
    { id: "gothic", name: "Gothic Quarter & Cathedral", lat: 41.3840, lng: 2.1762, minutes: 60, kind: "touristy", mustSee: true, category: "Old town",
      summary: "Narrow medieval lanes around Barcelona's cathedral, on top of the Roman town.",
      guide: "This is where Barcelona began. Two thousand years ago the Romans built a walled town called Barcino on this low hill, and you can still find pieces of its wall and four columns of its temple hidden in the lanes. The Cathedral of the Holy Cross and Saint Eulàlia was built from the 1200s to the 1400s, though the grand front you see today was only finished in the late 1800s. Step inside and then into the cloister, where thirteen white geese live. They stand for the thirteen years of Eulàlia, a girl martyred by the Romans, who is buried in the crypt. On Sunday mornings, locals dance the sardana, a slow Catalan circle dance, in the square in front. Let yourself get a little lost in the alleys around here. It is the best way to see it.",
      lookFor: ["The thirteen white geese in the cathedral cloister.", "Roman wall stones and towers along Plaça Nova and Carrer de la Tapineria.", "Buy a ticket to ride the lift to the cathedral roof for a view over the old town."],
      photoTip: "The Pont del Bisbe, a carved stone bridge on Carrer del Bisbe, is the most photographed corner of the quarter." },
    { id: "rambla", name: "La Rambla & La Boqueria market", lat: 41.3818, lng: 2.1716, minutes: 45, kind: "touristy", mustSee: false, category: "Street & market",
      summary: "The famous boulevard and the city's great food market.",
      guide: "La Rambla follows the line of an old stream that once ran along the medieval city wall, which is why it is so long and straight. Today it is a tree-lined promenade running 1.2 kilometers from Plaça de Catalunya down to the sea. Halfway down, you walk over a round mosaic set into the pavement by Joan Miró, placed there in 1976 to welcome people arriving from the port. Just before it is La Boqueria, under its iron and stained-glass entrance. Food has been sold here since at least the 1200s. Walk past the juice stands at the front, which are mostly for visitors, and go deeper inside, where locals buy fish, ham and wild mushrooms. A fair warning: La Rambla is famous for pickpockets, so keep your bag in front of you.",
      lookFor: ["Joan Miró's round pavement mosaic in front of the Liceu metro stop.", "The ham stalls at La Boqueria, where whole legs of jamón ibérico hang above the counters.", "The dragon and umbrellas on the Casa Bruno Cuadros building, opposite the Liceu."],
      photoTip: "Shoot the Boqueria's stained-glass entrance from across La Rambla to get the crowd in the frame." },
    { id: "picasso", name: "Museu Picasso", lat: 41.3852, lng: 2.1810, minutes: 75, kind: "touristy", mustSee: false, category: "Museum",
      summary: "Picasso's early years in five medieval palaces on Carrer de Montcada.",
      guide: "Picasso lived in Barcelona as a teenager, from 1895 to 1904, and this is where he became an artist. The museum opened in 1963, the first one dedicated to him in his lifetime, and it fills five connected medieval mansions on Carrer de Montcada. It is strongest on his early work, so you will see a version of Picasso you may not expect: careful academic portraits painted at fifteen, including Science and Charity, which he painted at that age. Then come the moody Blue Period works. The highlight for many people is a room of 58 paintings from 1957 where Picasso took apart Velázquez's Las Meninas over and over, like a jazz musician playing variations on a tune. Book a timed ticket in advance. Entry is free on Thursday evenings and the first Sunday of the month.",
      lookFor: ["Science and Charity, painted when Picasso was fifteen.", "The Las Meninas series: count how many ways he paints the little princess.", "The stone courtyards of the medieval palaces themselves."],
      photoTip: "Photos inside the galleries are limited, but the Gothic courtyards are perfect for a shot." },
    { id: "smdm", name: "Santa Maria del Mar", lat: 41.3838, lng: 2.1820, minutes: 30, kind: "local", mustSee: false, category: "Church",
      summary: "The 'cathedral of the sea', built by the dockworkers of El Born.",
      guide: "Many Barcelonans will tell you this, and not the cathedral, is the city's most beautiful church. Santa Maria del Mar was built remarkably fast, in just 54 years, from 1329 to 1383, which is why it is so pure an example of Catalan Gothic. The people of this waterfront neighborhood paid for it, and the port porters, called bastaixos, carried the stones on their backs from the quarry on Montjuïc. You will find them carved into the main doors and in bronze reliefs inside. The interior feels enormous because the columns are slim and widely spaced, about 13 meters apart. In 1936 the church burned for eleven days, and the fire destroyed its decoration. That loss left the bare, soaring stone you see now.",
      lookFor: ["The figures of the stone-carrying porters on the bronze main doors.", "The great rose window above the entrance, best with afternoon light.", "The slim octagonal columns: try to wrap your arms around one."],
      photoTip: "Sit in the back pews and shoot up the nave toward the altar." },
    { id: "palau", name: "Palau de la Música Catalana", lat: 41.3875, lng: 2.1753, minutes: 50, kind: "touristy", mustSee: false, category: "Concert hall",
      summary: "A concert hall made of light, with a stained-glass sun in the ceiling.",
      guide: "This is the only concert hall in Europe lit entirely by daylight during the day. Lluís Domènech i Montaner, a rival of Gaudí, designed it for a Catalan choral society, and it opened in 1908. Outside, the corner sculpture shows Catalan folk song, with Saint George guarding it. Inside the auditorium, the walls are mostly glass. Above you hangs an inverted dome of stained glass, a golden sun surrounded by a ring of women's faces, like a giant drop about to fall. On one side of the stage, busts of Beethoven and Wagner's Valkyries burst out of the wall. On the other is a tree and a bust of a Catalan composer. The back wall holds eighteen muses, half carved and half mosaic, playing instruments. Guided tours run daily, or catch a concert in the evening.",
      lookFor: ["The inverted stained-glass dome in the ceiling.", "The galloping Valkyries above the stage, bursting out of the wall.", "The mosaic columns on the façade, each in a different flower pattern."],
      photoTip: "Shoot the corner façade from Carrer de Sant Pere Més Alt to catch the sculpture group." },
    { id: "santpau", name: "Sant Pau Recinte Modernista", lat: 41.4116, lng: 2.1744, minutes: 60, kind: "local", mustSee: false, category: "Architecture",
      summary: "A fairy-tale hospital campus of tiled pavilions, often skipped by crowds.",
      guide: "This looks like a palace city, but it was built as a hospital. Domènech i Montaner, the architect of the Palau de la Música, designed it between 1902 and 1930 on the idea that beauty and fresh air help people heal. Instead of one big building, he made a garden of separate pavilions, connected underground by tunnels so patients could be moved out of the weather. Every pavilion is covered in mosaic domes, colored tile, and sculpted angels. It worked as a hospital until 2009 and is now a museum and a cultural center. It sits a short walk up Avinguda de Gaudí from the Sagrada Família, so it is easy to pair the two, and it is far calmer.",
      lookFor: ["The tiled domes of the pavilions, each slightly different.", "The underground tunnels that linked the wards.", "Look back down Avinguda de Gaudí for a view of the Sagrada Família."],
      photoTip: "The Avinguda de Gaudí is a pedestrian street lined with trees, so you can frame both buildings in one shot." },
    { id: "bunkers", name: "Bunkers del Carmel", lat: 41.4192, lng: 2.1617, minutes: 45, kind: "local", mustSee: false, category: "Viewpoint",
      summary: "A Civil War gun battery with the best free 360° view of the city.",
      guide: "Locals come up here at sunset with a drink, and it is easy to see why. From the top of Turó de la Rovira you can see the whole city: the Sagrada Família, the sea, Montjuïc and the Collserola hills. During the Spanish Civil War, in 1938, this hill held an anti-aircraft battery that defended Barcelona from bombers. After the war, people who had moved to the city with nowhere to live built shacks among the ruins. The neighborhood lasted until 1990. The concrete platforms you sit on are what's left of the gun emplacements. It is a steep climb from the nearest bus stop, so wear good shoes, and bring water. The small museum explains the history.",
      lookFor: ["The round concrete gun platforms of the 1938 battery.", "Find the Sagrada Família, Torre Glòries and Montjuïc from the top.", "Remains of the shanty town's floor tiles, in the ground near the top."],
      photoTip: "Come for golden hour and face southeast for the Sagrada Família against the sea." },
    { id: "gracia", name: "Gràcia squares", lat: 41.4010, lng: 2.1575, minutes: 45, kind: "local", mustSee: false, category: "Neighborhood",
      summary: "A village inside the city: small squares, terraces and local life.",
      guide: "Gràcia was its own town until 1897, when Barcelona swallowed it up, and in many ways it still acts like a village. Its streets are narrow and its life happens in little squares. Plaça del Sol is the busiest, full of café terraces and young people in the evening. Plaça de la Vila de Gràcia has a clock tower that's the symbol of the neighborhood, and Plaça de la Virreina is quieter, with a church and a few good bars. This is a great place to see how Barcelonans actually spend an afternoon. In mid-August the Festa Major de Gràcia takes over, when each street competes to decorate itself in a theme, often using recycled materials.",
      lookFor: ["The clock tower in Plaça de la Vila de Gràcia.", "Small independent shops and old bodegas along Carrer de Verdi.", "Casa Vicens, Gaudí's first house, a few blocks away on Carrer de les Carolines."],
      photoTip: "Shoot from a terrace in Plaça de la Virreina with the church in the background." },
    { id: "santantoni", name: "Mercat de Sant Antoni", lat: 41.3786, lng: 2.1617, minutes: 30, kind: "local", mustSee: false, category: "Market",
      summary: "The locals' market: an iron cross-shaped hall, without the tour groups.",
      guide: "If La Boqueria is the market everyone visits, Sant Antoni is the one Barcelonans actually shop in. Its huge iron hall, shaped like a cross, opened in 1882 and was restored in 2018. During the work, builders found pieces of the 17th-century city wall underneath, and you can see them in the basement. The market is in three parts: fresh food in the middle, clothing and household stalls around the outside, and on Sunday mornings a famous secondhand book, coin and comic market. The streets around it are now one of the city's best areas for food, with vermouth bars and little restaurants.",
      lookFor: ["The 17th-century wall remains in the basement.", "The iron roof structure and the central cupola.", "On Sundays, the book and collectors' market around the outside."],
      photoTip: "The corner where the iron arms meet, under the central cupola, gives the best symmetry." },
    { id: "ciutadella", name: "Parc de la Ciutadella", lat: 41.3881, lng: 2.1874, minutes: 40, kind: "local", mustSee: false, category: "Park",
      summary: "The city's green living room, with a grand fountain that young Gaudí helped build.",
      guide: "This park sits on the site of a hated fortress. After Barcelona lost the War of the Spanish Succession in 1714, the king built a citadel here to control the city, tearing down a whole neighborhood. It was finally demolished in the 1860s, and the land became a park for the 1888 World's Fair. The showpiece is the Cascada, a monumental fountain with golden horses. Josep Fontserè designed it, and a young architecture student named Antoni Gaudí worked on it as his assistant. Nearby you can rent a rowing boat on the small lake. Look for the giant stone mammoth by the lake, too, and the Catalan Parliament, which sits in what was once the fortress arsenal.",
      lookFor: ["The Cascada fountain, partly worked on by student Gaudí.", "The life-size stone mammoth near the lake.", "The Arc de Triomf at the top of Passeig de Lluís Companys, the fair's entrance."],
      photoTip: "Climb the steps of the Cascada and shoot down across the lake." },
    { id: "barceloneta", name: "Barceloneta beach", lat: 41.3784, lng: 2.1925, minutes: 45, kind: "touristy", mustSee: false, category: "Beach",
      summary: "The city beach and an 18th-century fishermen's quarter.",
      guide: "Barceloneta was laid out in the 1750s to house people who'd lost their homes when the Ciutadella fortress was built. Its streets are a tight grid of narrow blocks, with laundry hanging from the balconies, and it was a fishermen's quarter for two centuries. The beach itself is newer than you might think. Until the 1992 Olympics, this shore was lined with factories and shacks, and the city rebuilt it with imported sand. Walk along the promenade toward the big steel fish sculpture by Frank Gehry at Port Olímpic. Then head back into the grid of streets for seafood rice, or a few tapas in one of the old bars.",
      lookFor: ["Rebecca Horn's stacked-cubes sculpture, L'Estel Ferit, on the sand.", "Frank Gehry's giant golden fish at Port Olímpic.", "The tight grid of narrow streets and balconies inland from the beach."],
      photoTip: "Shoot from the end of the Passeig Marítim back toward the W Hotel's sail shape." },
    { id: "montjuic", name: "Montjuïc Castle", lat: 41.3634, lng: 2.1658, minutes: 60, kind: "touristy", mustSee: false, category: "Viewpoint",
      summary: "A hilltop fortress over the port, reached by cable car.",
      guide: "The castle on Montjuïc has watched over the harbor since 1640. Its present star-shaped fortress dates from the 1700s, and for many Barcelonans its history is a dark one. It was used as a prison and a place of execution, especially after the Civil War. Today it's a peaceful viewpoint and history center. The best way up is the Telefèric de Montjuïc cable car. From the walls you look straight down at the cruise terminals and the container port, and on a clear day you can see along the coast. If you came by ship, see if you can find it from here.",
      lookFor: ["The dry moat and the star-shaped bastions.", "The view straight down to the cruise terminals.", "Old cannons along the walls facing the sea."],
      photoTip: "From the seaward wall, zoom on the port for ships, cranes and the city in one frame." },
    { id: "mnac", name: "MNAC & Magic Fountain", lat: 41.3685, lng: 2.1534, minutes: 60, kind: "touristy", mustSee: false, category: "Museum",
      summary: "A palace of Catalan art above the fountain of the 1929 Expo.",
      guide: "The domed Palau Nacional was built for the 1929 International Exposition, and today it houses the National Art Museum of Catalonia. Its most remarkable rooms hold Romanesque church murals from the 11th and 12th centuries. They were peeled off the walls of crumbling mountain chapels in the Pyrenees in the early 1900s, to save them from art dealers, and remounted here in shapes that copy the original apses. Below the palace is the Magic Fountain, also from 1929, which puts on a light and music show in the evenings on certain days. Check the schedule, since it changes by season. Even without a museum visit, the terrace steps give a great view down the avenue to Plaça d'Espanya.",
      lookFor: ["The Christ in Majesty of Sant Climent de Taüll, a 12th-century mural.", "The view from the terrace down the avenue to Plaça d'Espanya.", "The Venetian towers at the bottom of the avenue."],
      photoTip: "Stand at the top of the steps at dusk to catch the fountain and avenue lighting up." },
    { id: "born", name: "El Born Centre de Cultura", lat: 41.3856, lng: 2.1840, minutes: 30, kind: "local", mustSee: false, category: "History",
      summary: "A whole 1714 neighborhood excavated under an iron market hall.",
      guide: "Under this iron market hall from 1876 lies a lost neighborhood. When the hall was being turned into a library in 2001, workers found the streets and houses of the Ribera district, demolished in 1717 to build the Ciutadella fortress after the city fell. The excavation is so well preserved that you can walk along a raised path and look down at doorways, kitchens, and drains. It's a place with a lot of emotion for Catalans, since 1714 is seen as the year the city lost its freedoms. Entry to the main hall is free, which makes it a great quick stop on your way through El Born.",
      lookFor: ["The excavated streets and house foundations below the walkway.", "The iron structure and glass of the old market hall.", "Passeig del Born outside, once the city's jousting and festival street."],
      photoTip: "Shoot the excavations from the walkway with the iron roof in the frame." },
    { id: "placareial", name: "Plaça Reial", lat: 41.3801, lng: 2.1753, minutes: 10, kind: "touristy", quick: true, category: "Square",
      summary: "An arcaded square with palm trees and Gaudí's first public work.",
      guide: "Plaça Reial is an elegant arcaded square from the 1850s, built where a convent once stood. Look at the two lamp posts with six arms next to the fountain. They were Gaudí's first commission from the city, in 1879, when he had just graduated.",
      lookFor: ["Gaudí's two six-armed lamp posts, topped with a winged helmet."], photoTip: "Frame a lamp post with the palm trees and the arcades behind it." },
    { id: "bisbe", name: "Pont del Bisbe", lat: 41.3833, lng: 2.1767, minutes: 10, kind: "touristy", quick: true, category: "Landmark",
      summary: "The neo-Gothic bridge over Carrer del Bisbe.",
      guide: "This looks medieval but was built in 1928, connecting the Catalan government palace to the Casa dels Canonges. Legend says a skull with a dagger is carved underneath, and that if you remove it, the city will be destroyed.",
      lookFor: ["Look under the bridge for the carved skull pierced by a dagger."], photoTip: "Shoot from Plaça Sant Jaume side looking up at the bridge." },
    { id: "amatller", name: "Casa Amatller", lat: 41.3916, lng: 2.1648, minutes: 10, kind: "local", quick: true, category: "Façade",
      summary: "The stepped Flemish gable next door to Casa Batlló.",
      guide: "Right next to Casa Batlló, this house was redesigned by Josep Puig i Cadafalch for a chocolate maker, Antoni Amatller. Its stepped gable is inspired by houses in Flanders. This block is called the Block of Discord, because three rival architects' houses stand side by side.",
      lookFor: ["Saint George fighting the dragon, carved by the front door."], photoTip: "Step back to fit Casa Amatller and Casa Batlló together." },
    { id: "arc", name: "Arc de Triomf", lat: 41.3910, lng: 2.1806, minutes: 10, kind: "touristy", quick: true, category: "Monument",
      summary: "The red-brick gateway to the 1888 World's Fair.",
      guide: "Unlike most triumphal arches, this one celebrates no military victory. It was the main entrance to the 1888 World's Fair, built of red brick in a Moorish revival style.",
      lookFor: ["The frieze on the front: Barcelona welcoming the nations."], photoTip: "Shoot from the far end of the promenade to get the arch with its line of lamps." },
    { id: "colom", name: "Columbus Monument", lat: 41.3758, lng: 2.1778, minutes: 10, kind: "touristy", quick: true, category: "Monument",
      summary: "A 60-meter column at the bottom of La Rambla.",
      guide: "Built for the 1888 World's Fair, the statue of Columbus stands where he reported to the king and queen after his first voyage. Oddly, he points out to sea toward Mallorca, not toward the Americas.",
      lookFor: ["Which way Columbus is pointing, and where that actually is."], photoTip: "Shoot from the bottom of La Rambla looking up the column." },
    { id: "catalunya", name: "Plaça de Catalunya", lat: 41.3870, lng: 2.1700, minutes: 10, kind: "touristy", quick: true, category: "Square",
      summary: "The big square where the old town meets the Eixample.",
      guide: "This is the hinge of Barcelona, where the medieval city meets the 19th-century grid of the Eixample. Look for the star-shaped compass in the paving, and the monument to Francesc Macià, shaped like an upside-down staircase.",
      lookFor: ["The upside-down staircase monument to Francesc Macià."], photoTip: "Shoot from the fountains across the square to El Corte Inglés." },
    { id: "palauguell", name: "Palau Güell", lat: 41.3789, lng: 2.1741, minutes: 10, kind: "local", quick: true, category: "Façade",
      summary: "An early Gaudí mansion just off La Rambla.",
      guide: "Gaudí designed this town palace for his patron Eusebi Güell in 1886–1890. From the street, look at the two parabolic arches for carriages and the iron Catalan coat of arms between them.",
      lookFor: ["The wrought-iron phoenix and coat of arms between the two entrance arches."], photoTip: "Stand back across the narrow street and shoot up." }
  ],
  farther: [
    { id: "montserrat", name: "Montserrat monastery", lat: 41.5934, lng: 1.8376, minutes: 150, kind: "touristy", far: true, category: "Day trip",
      travel: "About 1 hour each way: train from Plaça d'Espanya, then the rack railway or cable car up the mountain.",
      summary: "A Benedictine monastery wedged into jagged pink mountains, home of the Black Madonna.",
      guide: "Montserrat means 'serrated mountain', and the name fits: a wall of rounded rock fingers rises 1,200 meters out of the plain. A monastery has stood on a ledge here for nearly a thousand years. Its treasure is La Moreneta, a dark wooden statue of the Virgin from the 1100s, which pilgrims queue to touch. At 1 pm on most days, the Escolania, one of Europe's oldest boys' choirs, sings in the basilica. Leave time for a walk: the Sant Joan funicular climbs higher to trails with views as far as the Pyrenees on a clear day.",
      lookFor: ["La Moreneta, the Black Madonna, above the altar.", "The Escolania boys' choir at 1 pm (check the schedule).", "The rock pinnacles from the Sant Joan funicular trails."],
      photoTip: "From the cable car or the Sant Miquel cross trail, shoot back at the monastery under the cliffs." },
    { id: "sitges", name: "Sitges", lat: 41.2370, lng: 1.8059, minutes: 120, kind: "local", far: true, category: "Day trip",
      travel: "About 40 minutes each way by train from Passeig de Gràcia or Sants.",
      summary: "A whitewashed seaside town with a church on the rocks and long sandy beaches.",
      guide: "Sitges is where Barcelonans escape for a day by the sea. The old town is a tangle of white lanes ending at the church of Sant Bartomeu, which sits right on a rocky point over the water. In the late 1800s, the painter Santiago Rusiñol made the town an artists' colony, and his house, Cau Ferrat, is now a museum full of ironwork and paintings, including works by his friend Picasso. Walk the seafront promenade, swim if the weather is good, and stay for seafood.",
      lookFor: ["The church of Sant Bartomeu i Santa Tecla on its rocky point.", "Cau Ferrat, Rusiñol's house-museum.", "The palm-lined Passeig de la Ribera."],
      photoTip: "From the beach to the east, shoot back at the church on the point." },
    { id: "girona", name: "Girona old town", lat: 41.9831, lng: 2.8249, minutes: 180, kind: "touristy", far: true, category: "Day trip",
      travel: "About 40 minutes each way by high-speed train from Sants.",
      summary: "A walled medieval city with colored houses over the river and a famous Jewish quarter.",
      guide: "Girona is one of the best-preserved medieval cities in Spain, which is why film crews love it. Start at the Onyar river, where houses painted in ochre, red and yellow hang over the water, and cross the red iron bridge built by Gustave Eiffel's company in 1877. Climb the 90 steps to the cathedral, which has the widest Gothic nave in the world. Then wander the Call, one of Europe's best-preserved medieval Jewish quarters, and walk a stretch of the city walls for views over the rooftops.",
      lookFor: ["The colored houses over the Onyar, seen from the Eiffel bridge.", "The cathedral's single enormous Gothic nave.", "The narrow lanes of the Call, the medieval Jewish quarter."],
      photoTip: "Shoot from the Pont de Sant Agustí for the classic river houses." },
    { id: "tibidabo", name: "Tibidabo", lat: 41.4218, lng: 2.1186, minutes: 90, kind: "local", far: true, category: "Half-day",
      travel: "About 40 minutes each way: train or bus to the base, then the Cuca de Llum funicular.",
      summary: "The city's highest hill, with a church, a 1901 amusement park and huge views.",
      guide: "On top of Tibidabo, 512 meters above the city, stand an ornate church, the Temple Expiatori del Sagrat Cor, and one of the oldest amusement parks in the world, opened in 1901. Some of the original rides still run, including a red airplane that swings out over the edge of the hill. Ride the lift to the top of the church for the highest view in Barcelona.",
      lookFor: ["The 1928 red airplane ride swinging over the city.", "The statue of Christ on the church's spire.", "The whole coastline from the church's top terrace."],
      photoTip: "Late afternoon light from the church terrace gives you the whole city and sea." }
  ],
  gettingAround: [
    { mode: "Metro", tip: "Fast and frequent. A T-casual card gives one person 10 rides on metro, bus and tram, and works out much cheaper than single tickets." },
    { mode: "Walking", tip: "The old town, El Born and the Eixample are best on foot. Sagrada Família and Park Güell are a metro or taxi ride away." },
    { mode: "Taxi", tip: "Black-and-yellow taxis are easy to hail and the FreeNow app works. Port to the center is about 10 to 15 minutes." },
    { mode: "From the cruise port", tip: "The blue Portbus shuttle runs from the terminals to the Columbus Monument at the bottom of La Rambla." }
  ],
  restaurants: [
    { name: "Bar Pinotxo (La Boqueria)", lat: 41.3817, lng: 2.1717, kind: "local", cuisine: "Market tapas counter", price: "€€", why: "A legendary market counter. Ask for the chickpeas with blood sausage." },
    { name: "El Xampanyet", lat: 41.3846, lng: 2.1818, kind: "local", cuisine: "Cava bar", price: "€", why: "Tiled old bar near the Picasso museum: house cava, anchovies and pan con tomate." },
    { name: "Bar del Pla", lat: 41.3857, lng: 2.1795, kind: "local", cuisine: "Modern tapas", price: "€€", why: "Small, lively Born bar loved by locals for creative tapas and natural wine." },
    { name: "Quimet & Quimet", lat: 41.3735, lng: 2.1657, kind: "local", cuisine: "Montaditos", price: "€€", why: "A standing-room family bodega in Poble-sec. Famous for little toasts with tinned seafood." },
    { name: "La Pepita", lat: 41.3990, lng: 2.1617, kind: "local", cuisine: "Tapas", price: "€€", why: "Gràcia favorite. Guests write on the walls." },
    { name: "Can Solé", lat: 41.3803, lng: 2.1893, kind: "local", cuisine: "Seafood rice", price: "€€€", why: "A Barceloneta institution since 1903 for paella and arròs negre." },
    { name: "Cervecería Catalana", lat: 41.3925, lng: 2.1620, kind: "touristy", cuisine: "Tapas", price: "€€", why: "Always busy, big menu, easy for first-timers. Expect a short wait." },
    { name: "Tapas 24", lat: 41.3907, lng: 2.1680, kind: "touristy", cuisine: "Tapas", price: "€€", why: "Chef-run tapas bar near Passeig de Gràcia. Try the bikini sandwich." },
    { name: "El Nacional", lat: 41.3896, lng: 2.1683, kind: "touristy", cuisine: "Food hall", price: "€€", why: "A grand restored hall with several kitchens. Good for groups." },
    { name: "Los Caracoles", lat: 41.3797, lng: 2.1758, kind: "touristy", cuisine: "Catalan classics", price: "€€", why: "Since 1835: rotisserie chicken turning in the window, and snails." },
    { name: "7 Portes", lat: 41.3823, lng: 2.1830, kind: "touristy", cuisine: "Paella", price: "€€€", why: "Historic dining room by the port, famous for paella since 1836." }
  ]
};

// Practical details for the Barcelona sights. Typical hours: always check before you go.
const SAMPLE_EXTRAS = {
  sagrada: { hours: "9:00–18:00 (to 20:00 Apr–Sep)", closed: "", tickets: "Timed tickets only, sold online and often gone days ahead. Book the tower add-on early.", crowds: "Least busy at opening or after 16:00. Cruise groups peak 10:00–13:00.", cost: 26, indoor: true, access: "Step-free in the basilica; towers are stairs and a lift." },
  parkguell: { hours: "9:30–17:30 (to 19:30 in summer)", closed: "", tickets: "Timed entry to the monumental zone; book online. The rest of the park is free.", crowds: "Take the first slot of the day for photos without crowds.", cost: 18, indoor: false, access: "Steep hills and steps. Arrive by taxi at the upper gate for less climbing." },
  batllo: { hours: "9:00–20:00 daily", closed: "", tickets: "Book online to skip the ticket line; the 'Gold' ticket skips the entry queue too.", crowds: "Quietest first thing in the morning.", cost: 35, indoor: true, access: "Lift to most floors." },
  pedrera: { hours: "9:00–18:30, plus night visits", closed: "", tickets: "Book online. Night visits with a light show are a calmer option.", crowds: "Late afternoon is calmer than late morning.", cost: 28, indoor: true, access: "Lift to the attic; the roof has steps." },
  gothic: { hours: "Cathedral visitor hours about 9:30–18:30", closed: "", tickets: "A visitor fee covers the cathedral, cloister and roof. Shoulders and knees covered.", crowds: "Lanes fill with cruise groups 10:00–14:00. Go early or late.", cost: 9, indoor: true, access: "Cobbles and narrow lanes; the cathedral is step-free." },
  rambla: { hours: "Boqueria Mon–Sat 8:00–20:30", closed: "Boqueria closed Sundays", tickets: "Free.", crowds: "Before 10:00 the market feels local; by noon it's packed. Watch for pickpockets.", cost: 0, indoor: false, access: "Flat and step-free." },
  picasso: { hours: "Tue–Sun 10:00–19:00", closed: "Closed Mondays", tickets: "Timed tickets online. Free Thursday evenings and the first Sunday of the month (book ahead).", crowds: "Quietest at opening.", cost: 15, indoor: true, access: "Step-free with lifts." },
  smdm: { hours: "About 10:00–20:30", closed: "", tickets: "Free at worship times; a small fee for visitors and rooftop tours.", crowds: "Usually calm, even midday.", cost: 5, indoor: true, access: "Step-free." },
  palau: { hours: "Guided tours daily about 10:00–15:30", closed: "", tickets: "Tours only, in English several times a day; book ahead. A concert is the best way to see it.", crowds: "Tours are capped, so no crowds inside.", cost: 22, indoor: true, access: "Lift available; ask at the desk." },
  santpau: { hours: "9:30–18:30 (to 17:00 Nov–Mar)", closed: "", tickets: "Buy at the door or online.", crowds: "Rarely crowded.", cost: 17, indoor: false, access: "Mostly step-free with ramps." },
  bunkers: { hours: "Open area; closes at night", closed: "", tickets: "Free.", crowds: "Busy at sunset, quiet in the morning.", cost: 0, indoor: false, access: "Steep climb from the bus stop. Not suitable for wheelchairs." },
  gracia: { hours: "Any time", closed: "", tickets: "Free.", crowds: "Calm by day, lively in the evening.", cost: 0, indoor: false, access: "Flat streets." },
  santantoni: { hours: "Mon–Sat about 8:00–20:00", closed: "Food market closed Sundays (book market Sunday mornings)", tickets: "Free.", crowds: "Busiest Saturday morning.", cost: 0, indoor: true, access: "Step-free." },
  ciutadella: { hours: "10:00 to sunset", closed: "", tickets: "Free.", crowds: "Busy on weekend afternoons.", cost: 0, indoor: false, access: "Flat paths." },
  barceloneta: { hours: "Any time", closed: "", tickets: "Free.", crowds: "Packed on summer weekends.", cost: 0, indoor: false, access: "Boardwalk is flat; beach access ramps in places." },
  montjuic: { hours: "10:00–18:00 (to 20:00 in summer)", closed: "", tickets: "Castle ticket plus the cable car; buy the cable car online to skip its line.", crowds: "Cable car lines build after 11:00.", cost: 19, indoor: false, access: "Cable car is step-free; castle has slopes and steps." },
  mnac: { hours: "Tue–Sat 10:00–18:00, Sun 10:00–15:00", closed: "Closed Mondays", tickets: "Ticket valid two days. Free Saturday afternoons.", crowds: "Rarely crowded.", cost: 12, indoor: true, access: "Escalators and lifts up from Plaça d'Espanya." },
  born: { hours: "Tue–Sun 10:00–20:00", closed: "Closed Mondays", tickets: "Main hall is free.", crowds: "Calm.", cost: 0, indoor: true, access: "Step-free walkway." },
  montserrat: { cost: 40, indoor: false, tickets: "Combined train and rack-railway tickets at Plaça d'Espanya. Choir times vary.", crowds: "Arrive before 10:30 to beat the coaches.", hours: "Basilica about 7:30–20:00", access: "Rack railway is step-free; the monastery has slopes." },
  sitges: { cost: 10, indoor: false, tickets: "Regular commuter train, no booking needed.", crowds: "Weekends fill up in summer.", hours: "Any time" },
  girona: { cost: 30, indoor: false, tickets: "Book the high-speed train a few days ahead for the best fares.", crowds: "Quiet on weekdays.", hours: "Cathedral about 10:00–18:30" },
  tibidabo: { cost: 35, indoor: false, tickets: "The amusement park keeps limited days outside summer; check the calendar.", crowds: "Calm on weekdays.", hours: "Varies by season" }
};
for (const s of [...SAMPLE_CITY.sites, ...SAMPLE_CITY.farther]) Object.assign(s, SAMPLE_EXTRAS[s.id] || { cost: 0, indoor: false });
SAMPLE_CITY.basics = {
  currency: "Euro", symbol: "€", language: "Catalan and Spanish", langCode: "es",
  tipping: "Not expected. Round up at a bar; leave 5–10% for good table service.",
  safety: "Pickpockets work La Rambla, the metro and the beach. Keep phones off café tables.",
  emergency: "112", plugs: "Type C/F, 230 V", water: "Tap water is safe to drink.",
  phrases: [
    { local: "Bon dia", say: "bon DEE-uh", meaning: "Good morning (Catalan)", lang: "ca" },
    { local: "Gràcies", say: "GRAH-see-uhs", meaning: "Thank you (Catalan)", lang: "ca" },
    { local: "Si us plau", say: "see oos PLOW", meaning: "Please (Catalan)", lang: "ca" },
    { local: "Perdó", say: "per-DOH", meaning: "Excuse me (Catalan)", lang: "ca" },
    { local: "¿Cuánto cuesta?", say: "KWAN-toh KWES-tah", meaning: "How much is it? (Spanish)", lang: "es" },
    { local: "La cuenta, por favor", say: "lah KWEN-tah por fah-VOR", meaning: "The check, please (Spanish)", lang: "es" },
    { local: "¿Dónde está el metro?", say: "DON-deh es-TAH el MEH-troh", meaning: "Where is the metro? (Spanish)", lang: "es" },
    { local: "Una mesa para dos", say: "OO-nah MEH-sah PAH-rah dohs", meaning: "A table for two (Spanish)", lang: "es" }
  ]
};

// A professional guide's picks for each stop: the insider extras a paid guide would show you.
// k: spot (where to stand / hidden detail), timing (when or how to beat lines), story (the anecdote guides tell), taste (food or drink nearby)
const SAMPLE_PICKS = {
  sagrada: [
    { k: "spot", t: "Stand in the park at Plaça de Gaudí and look across the pond: the Nativity façade reflects in the water, and it's the angle guides use for group photos." },
    { k: "timing", t: "Book the first entry of the day. Morning sun pours through the blue and green east windows; late afternoon it's the reds and oranges in the west. Pick the colors you want." },
    { k: "story", t: "Find the 'magic square' on the Passion façade: every row, column and diagonal adds up to 33, the age of Christ at the crucifixion." }
  ],
  parkguell: [
    { k: "spot", t: "Skip the crowd on the mosaic bench and walk up to the Turó de les Tres Creus, the hill with three crosses. You get the whole city and the sea in one view, for free." },
    { k: "story", t: "The park was meant to be a gated luxury housing estate for 60 homes. Only two were built, and Gaudí moved into one of them." },
    { k: "timing", t: "Monumental Zone tickets are timed. Arrive 15 minutes early, because they don't let you in late." }
  ],
  batllo: [
    { k: "story", t: "Locals call it the 'house of bones'. The balconies look like skulls and the roof like a dragon's back, with the tower as Saint George's lance." },
    { k: "spot", t: "From the street, look at the façade at sunset from across Passeig de Gràcia. The mosaic shimmers like fish scales." },
    { k: "spot", t: "Inside, watch the light well: the tiles get darker blue toward the top so the light feels even on every floor." }
  ],
  pedrera: [
    { k: "spot", t: "The rooftop 'warriors' chimneys are the highlight. Find the one covered in broken champagne bottle glass." },
    { k: "story", t: "Barcelonans mocked it when it was new: 'La Pedrera' means 'the stone quarry'. The nickname stuck." },
    { k: "timing", t: "The evening 'Night Experience' has the rooftop almost to yourself, with a light show on the chimneys." }
  ],
  gothic: [
    { k: "spot", t: "Walk into Plaça Sant Felip Neri, a quiet square. The pockmarks on the church wall are from a 1938 bombing during the Civil War." },
    { k: "story", t: "In the cathedral cloister live 13 white geese, one for each year of Saint Eulàlia's age when she was martyred." },
    { k: "timing", t: "Take the lift to the cathedral roof. It costs a few euros and is rarely busy, with views across the old town's rooftops." }
  ],
  rambla: [
    { k: "spot", t: "Halfway down, step on the Joan Miró mosaic in the pavement at Pla de l'Os. Most people walk right over it." },
    { k: "taste", t: "Skip the juice stalls at La Boqueria's entrance. Head to the back stalls, where the locals shop, and sit at a counter bar like El Quim." },
    { k: "timing", t: "Go before 11:00. After that the market is packed with tour groups, and it's closed on Sundays." }
  ],
  picasso: [
    { k: "story", t: "This museum shows Picasso as a teenager. At 15 he painted 'Science and Charity', and it looks like the work of an old master." },
    { k: "spot", t: "Don't miss the Las Meninas room: 58 variations Picasso painted on one Velázquez masterpiece." },
    { k: "timing", t: "Entry is free Thursday evenings and the first Sunday of the month, but you still need to book a slot online." }
  ],
  smdm: [
    { k: "story", t: "Built in just 54 years by the port's workers. The dockworkers carried every stone on their backs from Montjuïc, and you'll see them carved on the main doors." },
    { k: "spot", t: "Stand in the center aisle. The columns are spaced 13 meters apart, among the widest of any Gothic church in Europe." },
    { k: "taste", t: "Across the square, La Vinya del Senyor wine bar has a terrace facing the church." }
  ],
  palau: [
    { k: "spot", t: "Look up at the stained-glass skylight in the concert hall, shaped like an inverted sun." },
    { k: "timing", t: "A concert ticket can cost less than the guided tour, and you hear the hall the way it was meant to be heard." },
    { k: "story", t: "The stage is lined with 18 muses who seem to step out of the wall, half mosaic and half sculpture." }
  ],
  santpau: [
    { k: "story", t: "This was a working hospital until 2009. It was designed with gardens and sunlight because the architect believed beauty helped patients heal." },
    { k: "spot", t: "Walk the underground tunnels that linked the pavilions, so patients could be moved without going outside." },
    { k: "spot", t: "From the main entrance, look straight down Avinguda de Gaudí. The Sagrada Família is framed at the end." }
  ],
  bunkers: [
    { k: "timing", t: "Come for sunset with a drink and snacks from the shop at the bottom. Locals do, and it's the best free view in the city." },
    { k: "story", t: "These were anti-aircraft gun batteries in the Civil War, then a shanty town until the 1990s." },
    { k: "spot", t: "Face south and you can line up the Sagrada Família, the Agbar tower and the sea in one frame." }
  ],
  gracia: [
    { k: "spot", t: "Plaça del Sol is the heart of the evenings. Plaça de la Virreina has the prettiest church backdrop." },
    { k: "story", t: "Gràcia was its own town until 1897 and still feels like a village. Each August its streets compete with homemade decorations." },
    { k: "taste", t: "Try a vermouth on tap at a corner bar around noon. 'Fer el vermut' is a Barcelona ritual." }
  ],
  santantoni: [
    { k: "story", t: "Under the market is a stretch of the 17th-century city wall, found during the renovation. You can see it through the glass floor." },
    { k: "timing", t: "On Sunday mornings the outside becomes a book, comic and coin market that locals love." },
    { k: "taste", t: "Bar Ramón and Els Tres Porquets are nearby local favorites for tapas." }
  ],
  ciutadella: [
    { k: "spot", t: "Find the Cascada fountain. A young Gaudí, still a student, helped design part of it." },
    { k: "spot", t: "The giant stone mammoth by the lake is a favorite photo stop with kids." },
    { k: "timing", t: "On weekends you'll find musicians and dancers under the trees, and you can rent a rowboat on the lake." }
  ],
  barceloneta: [
    { k: "story", t: "The beach was industrial until the 1992 Olympics, when the city brought in sand and rebuilt the waterfront." },
    { k: "taste", t: "Walk a few streets inland for 'la bomba', a fried potato ball invented here at La Cova Fumada." },
    { k: "spot", t: "Walk to the end for the 'Homenatge a la Barceloneta' sculpture of stacked steel cubes, a memorial to the old beach shacks." }
  ],
  montjuic: [
    { k: "timing", t: "Ride the cable car up from the port side for the view, and walk down through the gardens." },
    { k: "story", t: "The castle has a dark past as a military prison. Catalan president Lluís Companys was executed here in 1940." },
    { k: "spot", t: "From the walls you can watch container ships being loaded in the port below." }
  ],
  mnac: [
    { k: "spot", t: "The Romanesque wall paintings were peeled off remote Pyrenees churches to save them, and they're world class." },
    { k: "spot", t: "Even if you skip the museum, the steps in front give one of the city's best free views." },
    { k: "timing", t: "The Magic Fountain show is on certain evenings, depending on the season. Check the schedule before you plan the night around it." }
  ],
  born: [
    { k: "story", t: "Under the old market are streets and houses of the neighborhood destroyed after the siege of 1714, preserved as they were found." },
    { k: "spot", t: "Look from the balcony walkway at the excavated streets. It's free to enter the main hall." },
    { k: "taste", t: "Next door, Passeig del Born is lined with cocktail and tapas bars." }
  ],
  montserrat: [
    { k: "timing", t: "Plan around the boys' choir, the Escolania, one of the oldest in Europe. They sing midday most weekdays, so check the time." },
    { k: "spot", t: "Take the Sant Joan funicular up and walk the easy path for a view over the whole monastery." },
    { k: "story", t: "Pilgrims queue to touch the orb held by La Moreneta, the Black Madonna. It's said to bring good luck." }
  ],
  sitges: [
    { k: "spot", t: "Walk up to the church of Sant Bartomeu on the rocky point for the classic photo of the bay." },
    { k: "taste", t: "Order xató, the local salad with salt cod and a romesco-like sauce." },
    { k: "timing", t: "Weekdays are calm. In February and October, Carnival and the film festival bring huge crowds." }
  ],
  girona: [
    { k: "spot", t: "Walk the medieval walls for views over the old town's red roofs and cathedral." },
    { k: "story", t: "Kiss the bottom of the lioness statue in Plaça Sant Feliu. Legend says you'll come back to Girona." },
    { k: "spot", t: "Stand on the red Eiffel bridge to photograph the colorful houses hanging over the river Onyar." }
  ],
  tibidabo: [
    { k: "story", t: "The name comes from the Latin Bible: 'Haec omnia tibi dabo', 'all this I will give you', the Devil tempting Christ with this view." },
    { k: "spot", t: "Ride the Avió, a 1928 plane ride, at the amusement park. It's one of the oldest working rides in the world." },
    { k: "timing", t: "Clear days after rain give views to Montserrat and sometimes Mallorca." }
  ]
};
for (const s of [...SAMPLE_CITY.sites, ...SAMPLE_CITY.farther]) if (SAMPLE_PICKS[s.id]) s.picks = SAMPLE_PICKS[s.id];
