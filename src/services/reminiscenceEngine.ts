/* =====================================================================
   COGNICOPIA REMINISCENCE ENGINE
   Hyper-local nostalgia for one resident: what their work, their home
   region and their decades were like, turned into printed reminiscence
   cards. Every card carries, for the caregiver:
     - three conversation starters (invitations, never quiz questions);
     - one era-accurate song;
     - one tactile prompt, with a safety note;
   plus a few references from their own time and place (brands, tools,
   radio and television) to mention.

   Who the resident is comes from their saved profile:
     birth year (or age)       -> their "reminiscence bump", the years
                                  from about 10 to 30, which people recall
                                  most readily and most fondly;
     region + hometown setting -> "Rural Midwest", "Urban Northeast"...
                                  (worked out from the hometown when no
                                  region is chosen);
     primary vocation          -> Mechanic, Teacher, Military, Culinary,
                                  Nursing and a dozen more, from their
                                  occupation unless staff choose one;
     music, hobbies            -> their own favorite song and genres come
                                  first;
     topics to avoid           -> any card, song, reference or touch
                                  prompt tagged with one is never used;
     military service          -> service topics only when staff marked
                                  it a welcome (or gentle) topic.

   Wording rules (checked by npm test): conversation starters invite
   ("Tell me about...", "What was...like?"); they never test memory
   ("Do you remember...", "What year...", "Can you name..."), and never
   use pet names or baby talk. Tier 3 cards use short comments and
   either/or choices that need no recall at all.

   References are chosen for accuracy: each carries the years it was
   current, and only those that overlap the resident's own lifetime are
   used, favoring their bump years. US regional references are used only
   for residents who grew up in that region.

   Built into assets/services/reminiscenceEngine.js (globalThis.
   CogniReminiscence) by scripts/build-services.mjs. No network, no
   storage, no page: it turns a profile into card content.
   @global CogniReminiscence
   ===================================================================== */

export const VERSION = "1.0.0";
export type Tier = 1 | 2 | 3;
export type Avoid = "war" | "death" | "medical" | "religion" | "money" | "politics" | "driving" | "home" | "family-conflict" | "children" | "water" | "storms";

/* ---------- 1. Vocations, regions, settings ---------- */
export interface Vocation { code: string; label: string; occupations: readonly string[]; }
export const VOCATIONS: readonly Vocation[] = [
  { code: "mechanic",      label: "Mechanic",                       occupations: ["mechanic"] },
  { code: "teacher",       label: "Teacher",                        occupations: ["teacher"] },
  { code: "military",      label: "Military",                       occupations: ["military"] },
  { code: "culinary",      label: "Culinary",                       occupations: ["cook"] },
  { code: "nursing",       label: "Nursing and health care",        occupations: ["nurse", "doctor"] },
  { code: "farming",       label: "Farming and ranching",           occupations: ["farmer"] },
  { code: "homemaking",    label: "Homemaking",                     occupations: ["homemaker"] },
  { code: "office",        label: "Office and bookkeeping",         occupations: ["office", "bookkeeper"] },
  { code: "trades",        label: "Building trades",                occupations: ["trades", "carpenter", "electrician"] },
  { code: "factory",       label: "Factory and mill work",          occupations: ["factory"] },
  { code: "railroad",      label: "Railroad",                       occupations: ["railroad"] },
  { code: "driving",       label: "Driving for a living",           occupations: ["driver"] },
  { code: "postal",        label: "Postal service",                 occupations: ["postal"] },
  { code: "commerce",      label: "Shopkeeping and business",       occupations: ["shop", "business"] },
  { code: "sewing",        label: "Sewing and tailoring",           occupations: ["seamstress"] },
  { code: "public-safety", label: "Police and fire service",        occupations: ["police-fire"] },
  { code: "engineering",   label: "Engineering and science",        occupations: ["engineer"] },
  { code: "ministry",      label: "Ministry and church work",       occupations: ["clergy"] },
  { code: "general",       label: "Work in general",                occupations: [] }
];
export interface Region { code: string; label: string; states: readonly string[]; us: boolean; }
/* States by region, as full names and postal codes, for working a region out of a hometown. */
export const REGIONS: readonly Region[] = [
  { code: "midwest",       label: "Midwest",               us: true, states: ["Ohio", "OH", "Indiana", "IN", "Illinois", "IL", "Michigan", "MI", "Wisconsin", "WI", "Minnesota", "MN", "Iowa", "IA", "Missouri", "MO"] },
  { code: "plains",        label: "Great Plains",          us: true, states: ["North Dakota", "ND", "South Dakota", "SD", "Nebraska", "NE", "Kansas", "KS", "Oklahoma", "OK"] },
  { code: "northeast",     label: "Northeast",             us: true, states: ["New York", "NY", "New Jersey", "NJ", "Pennsylvania", "PA", "Delaware", "DE", "Maryland", "MD", "District of Columbia", "DC"] },
  { code: "new-england",   label: "New England",           us: true, states: ["Maine", "ME", "New Hampshire", "NH", "Vermont", "VT", "Massachusetts", "MA", "Rhode Island", "RI", "Connecticut", "CT"] },
  { code: "south",         label: "South",                 us: true, states: ["Virginia", "VA", "North Carolina", "NC", "South Carolina", "SC", "Georgia", "GA", "Florida", "FL", "Alabama", "AL", "Mississippi", "MS", "Louisiana", "LA", "Arkansas", "AR", "Tennessee", "TN"] },
  { code: "appalachia",    label: "Appalachia",            us: true, states: ["West Virginia", "WV", "Kentucky", "KY"] },
  { code: "southwest",     label: "Texas and the Southwest", us: true, states: ["Texas", "TX", "New Mexico", "NM", "Arizona", "AZ"] },
  { code: "mountain-west", label: "Mountain West",         us: true, states: ["Colorado", "CO", "Utah", "UT", "Nevada", "NV", "Wyoming", "WY", "Montana", "MT", "Idaho", "ID"] },
  { code: "pacific",       label: "Pacific Coast",         us: true, states: ["California", "CA", "Oregon", "OR", "Washington", "WA", "Hawaii", "HI", "Alaska", "AK"] },
  { code: "canada",        label: "Canada",                us: false, states: ["Canada", "Ontario", "Quebec", "Manitoba", "Saskatchewan", "Alberta", "British Columbia", "Nova Scotia", "New Brunswick", "Newfoundland", "Prince Edward Island"] },
  { code: "abroad",        label: "Another country",       us: false, states: [] }
];
/* The hometown setting (profile.html's "Hometown or environment"). */
export const SETTINGS: Readonly<Record<string, { label: string; kind: "rural" | "town" | "city" | "shore" | "mountain" | "" }>> = {
  "rural": { label: "Rural", kind: "rural" }, "small-town": { label: "Small-town", kind: "town" }, "city": { label: "Urban", kind: "city" },
  "suburb": { label: "Suburban", kind: "city" }, "coastal": { label: "Coastal", kind: "shore" }, "mountains": { label: "Mountain", kind: "mountain" },
  "moved": { label: "", kind: "" }, "abroad": { label: "", kind: "" }, "other": { label: "", kind: "" }
};

/* ---------- 2. The knowledge base ---------- */
export interface Ref {
  text: string; years: readonly [number, number];
  regions?: readonly string[];              // only for those who grew up in these regions
  states?: readonly string[];               // or, narrower, these states (postal codes)
  anywhere?: boolean;                       // familiar outside North America too
  avoid?: readonly Avoid[];
}
export interface Touch { prompt: string; simple: string; items: string; safety: string; avoid?: readonly Avoid[]; }
export interface Topic {
  id: string; title: string; kind: "work" | "place" | "era" | "home" | "pastime";
  vocations?: readonly string[];            // shown for these vocations (work topics)
  regions?: readonly string[];              // or these regions
  settings?: readonly string[];             // or these setting kinds (rural, town, city, shore, mountain)
  match?: "both";                           // place topics: region AND setting must fit (else either will do)
  hobbies?: readonly string[];              // or residents with these hobbies
  everyone?: boolean;                       // fits anyone
  avoid?: readonly Avoid[];
  art: readonly string[];                   // CogniCore design ids, first that is allowed wins
  invite: readonly [string, string, string];   // the line printed for the resident, by tier
  starters: readonly string[];              // tiers 1-2
  simple: readonly string[];                // tier 3: comments and either/or choices
  touch: Touch;
  refs: readonly Ref[];
  songs?: readonly string[];                // song ids that suit this topic
}
const SAFE = "Clean items only, too large to swallow, with no sharp edges; stay alongside while they are held.";
export const TOPICS: readonly Topic[] = [
  /* ---- work ---- */
  { id: "under-the-hood", title: "Under the Hood", kind: "work", vocations: ["mechanic"], hobbies: ["classic-cars"], avoid: ["driving"],
    art: ["farm-pickup", "sunday-sedan", "convertible"],
    invite: ["Tell me about the engines you worked on.", "Tell me about fixing cars.", "A good, strong engine."],
    starters: ["What was the first engine you ever took apart?", "Which car or truck was the best one to work on, and why?", "Who taught you your way around a toolbox?", "What sound told you an engine was running just right?"],
    simple: ["Big engines or small ones?", "This one looks like it runs well.", "Show me how you would hold a wrench."],
    touch: { prompt: "Hand them a clean, heavy socket wrench or a spark plug to hold. Invite them to feel the weight and click the ratchet.", simple: "Place a clean, heavy wrench in their hands to hold.", items: "a clean socket wrench, a spark plug, a shop rag", safety: SAFE },
    refs: [{ text: "Chevrolet's small-block V8, new in 1955", years: [1955, 1980] }, { text: "Craftsman tools from Sears", years: [1927, 1990] },
      { text: "full-service gas stations with an attendant at the pump", years: [1925, 1975] }, { text: "the Ford Mustang, new in 1964", years: [1964, 1980] },
      { text: "Volkswagen Beetles in every repair bay", years: [1955, 1979] }, { text: "the Ford Model A", years: [1927, 1945] }],
    songs: ["little-deuce-coupe"] },
  { id: "the-classroom", title: "The Classroom", kind: "work", vocations: ["teacher"], avoid: ["children"],
    art: ["schoolhouse-clock", "letter-writing"],
    invite: ["Tell me about your classroom.", "Tell me about teaching.", "A busy classroom."],
    starters: ["What subject did you most enjoy teaching?", "What did your classroom look like on the first day of school?", "Which student made you laugh the most?", "How did you keep a room full of children listening?"],
    simple: ["Mornings or afternoons?", "Chalk on the board and the bell ringing.", "Was your school big or small?"],
    touch: { prompt: "Offer a felt chalkboard eraser, a wooden ruler or a small hand bell to hold and ring.", simple: "Let them ring a small hand bell.", items: "a clean chalkboard eraser, a wooden ruler, a hand bell", safety: SAFE },
    refs: [{ text: "Dick and Jane readers", years: [1930, 1970] }, { text: "the purple ink of mimeographed worksheets", years: [1940, 1980] },
      { text: "Palmer Method penmanship drills", years: [1900, 1960] }, { text: "pull-down maps and a globe on the teacher's desk", years: [1920, 1990] },
      { text: "the Weekly Reader", years: [1928, 1990] }],
    songs: ["wonderful-world-cooke"] },
  { id: "letters-home", title: "Letters Home", kind: "work", vocations: ["military"], avoid: ["war"],
    art: ["letter-writing", "rural-mailbox"],
    invite: ["Tell me about the places your service took you.", "Tell me about your time in uniform.", "A letter from far away."],
    starters: ["Where were you stationed that surprised you most?", "Who was your closest friend in your unit?", "What did you look forward to in letters from home?", "What was the food like on base?"],
    simple: ["Army, Navy or another branch?", "A smart uniform, pressed and ready.", "A letter always feels good to hold."],
    touch: { prompt: "Offer a pressed cotton shirt to fold, or a letter in an envelope to open and hold.", simple: "Offer a letter in an envelope to hold.", items: "a pressed shirt, an envelope with a short friendly note", safety: "Watch for signs of distress and move to another card if memories are hard." },
    refs: [{ text: "USO shows with Bob Hope", years: [1941, 1990] }, { text: "the Stars and Stripes newspaper", years: [1942, 1990] },
      { text: "the GI Bill, which sent many veterans to college", years: [1944, 1975] }, { text: "mess halls and chow lines", years: [1917, 1990], anywhere: true }] },
  { id: "the-busy-kitchen", title: "The Busy Kitchen", kind: "work", vocations: ["culinary"], hobbies: ["cooking"],
    art: ["baking-day", "wood-cookstove", "stand-mixer", "coffee-percolator"],
    invite: ["Tell me about the best dish you ever made.", "Tell me about cooking for a crowd.", "Something good is cooking."],
    starters: ["What was the most popular dish you made?", "Who taught you to cook?", "What did the kitchen smell like on a busy morning?", "What was your secret to a good pie crust?"],
    simple: ["Sweet or savory?", "Hot from the oven.", "That smells like fresh bread."],
    touch: { prompt: "Offer a smooth wooden spoon and an empty mixing bowl to stir, or a flour sifter to crank.", simple: "Place a wooden spoon in their hand and a bowl to stir.", items: "a wooden spoon, a mixing bowl, a flour sifter", safety: "Nothing hot or sharp, and no small food items for anyone who may put things in their mouth." },
    refs: [{ text: "diner counters and short-order cooks", years: [1930, 1980] }, { text: "the Betty Crocker Picture Cook Book, the \"Big Red\" book of 1950", years: [1950, 1990] },
      { text: "Pyrex mixing bowls in bright colors", years: [1945, 1985] }, { text: "Crisco in the can", years: [1911, 1990] },
      { text: "Swanson TV dinners, first sold in 1953", years: [1953, 1985] }],
    songs: ["jambalaya"] },
  { id: "on-the-ward", title: "On the Ward", kind: "work", vocations: ["nursing"], avoid: ["medical"],
    art: ["pocket-watch", "tea-for-two", "garden-rose"],
    invite: ["Tell me about your years in nursing.", "Tell me about caring for people.", "A steady, caring hand."],
    starters: ["What made you want to go into nursing?", "What was nursing school like?", "Who was the best nurse or doctor you worked alongside?", "What did a good shift feel like?"],
    simple: ["Day shift or night shift?", "A crisp white uniform.", "You took good care of people."],
    touch: { prompt: "Offer a clean cotton pillowcase or hand towel to fold with neat, square corners.", simple: "Offer a soft towel to smooth and fold.", items: "a pillowcase, a hand towel", safety: "" },
    refs: [{ text: "white caps and the capping ceremony at nursing school", years: [1920, 1980], anywhere: true }, { text: "starched white uniforms", years: [1920, 1980], anywhere: true },
      { text: "the Nightingale Pledge", years: [1893, 1990] }, { text: "hospital corners on every bed", years: [1920, 1990], anywhere: true }] },
  { id: "the-farm-year", title: "The Farm Year", kind: "work", vocations: ["farming"], settings: ["rural"],
    art: ["red-barn", "farm-tractor", "farm-windmill", "harvest-basket", "proud-rooster"],
    invite: ["Tell me about a day on the farm.", "Tell me about the farm.", "A big red barn."],
    starters: ["What was the first chore of the morning?", "Which animal had the most personality?", "What was harvest time like?", "Which tractor or team did you work with?"],
    simple: ["Cows or chickens?", "Early mornings on the farm.", "That barn looks solid."],
    touch: { prompt: "Offer a pair of soft leather work gloves or a square of burlap feed sack to hold and feel.", simple: "Offer soft work gloves to hold.", items: "leather work gloves, a burlap square", safety: "Clean, soft items; no loose grain or seed for anyone who may put things in their mouth." },
    refs: [{ text: "Farmall and John Deere tractors", years: [1924, 1990] }, { text: "4-H clubs and the county fair", years: [1914, 1990] },
      { text: "feed-sack cloth sewn into dresses and aprons", years: [1925, 1960] }, { text: "the almanac hanging by the door", years: [1900, 1990] },
      { text: "milk cans at the end of the lane", years: [1900, 1960] }, { text: "the REA bringing electric lines to farms", years: [1936, 1955] }],
    songs: ["green-acres", "oh-what-a-beautiful-mornin"] },
  { id: "keeping-house", title: "Keeping House", kind: "work", vocations: ["homemaking"], avoid: ["home"],
    art: ["clothesline", "ironing-day", "canning-jars", "sewing-basket"],
    invite: ["Tell me about running your household.", "Tell me about washday.", "Fresh laundry on the line."],
    starters: ["What was washday like at your house?", "What did you put up in jars every summer?", "Which room was the heart of the house?", "What did Sunday dinner look like?"],
    simple: ["Sunshine or rain on washday?", "Fresh sheets smell so good.", "Baking or sewing?"],
    touch: { prompt: "Offer wooden clothespins and a small towel to pin up and fold.", simple: "Offer a warm, clean towel to fold.", items: "wooden clothespins, a hand towel", safety: "Use clothespins without metal springs for anyone who may put things in their mouth." },
    refs: [{ text: "wringer washing machines", years: [1920, 1965], anywhere: true }, { text: "S&H Green Stamps books", years: [1930, 1980] },
      { text: "Tupperware parties", years: [1950, 1990] }, { text: "the milkman's morning delivery", years: [1920, 1970] },
      { text: "Electrolux vacuum cleaners", years: [1925, 1985] }],
    songs: ["que-sera-sera"] },
  { id: "the-office", title: "The Office", kind: "work", vocations: ["office"],
    art: ["typewriter", "rotary-telephone"],
    invite: ["Tell me about your office days.", "Tell me about your work at the office.", "Clickety-clack on the typewriter."],
    starters: ["What kind of typewriter did you use?", "What was a busy day at the office like?", "Who was the best boss you ever had?", "How did you keep everything in order?"],
    simple: ["Typing or the telephone?", "A neat desk, everything in its place.", "That typewriter is a fine machine."],
    touch: { prompt: "Offer a stack of large index cards to sort into piles, or an old telephone handset to hold.", simple: "Offer index cards to shuffle and stack.", items: "large index cards, a telephone handset", safety: SAFE },
    refs: [{ text: "Royal and Smith-Corona typewriters", years: [1920, 1980] }, { text: "the IBM Selectric, new in 1961", years: [1961, 1990] },
      { text: "carbon paper and steno pads", years: [1920, 1985], anywhere: true }, { text: "Gregg shorthand", years: [1900, 1980] },
      { text: "Rolodex card files, from the late 1950s", years: [1958, 1995] }] },
  { id: "building-things", title: "Building Things", kind: "work", vocations: ["trades"], hobbies: ["woodworking"],
    art: ["red-barn", "garden-gate", "covered-bridge"],
    invite: ["Tell me about something you built.", "Tell me about your work with tools.", "Good, solid work."],
    starters: ["What was the proudest job you ever finished?", "Which tool could you not do without?", "Who taught you the trade?", "Which building in town has your work in it?"],
    simple: ["Wood or metal?", "Measure twice, cut once.", "That is sturdy work."],
    touch: { prompt: "Offer a sanded block of wood and a flat carpenter's pencil, or a tape measure to pull out and let back.", simple: "Offer a smooth, sanded block of wood to hold.", items: "a sanded wood block, a carpenter's pencil, a tape measure", safety: "Sanded, splinter-free wood; no nails, blades or small parts." },
    refs: [{ text: "Stanley planes and tape measures", years: [1920, 1990] }, { text: "flat carpenter's pencils", years: [1900, 1990], anywhere: true },
      { text: "the postwar building boom, new houses on every street", years: [1946, 1965] }, { text: "Skil circular saws", years: [1924, 1990] }] },
  { id: "the-shift", title: "The Shift Whistle", kind: "work", vocations: ["factory"],
    art: ["pocket-watch", "schoolhouse-clock"],
    invite: ["Tell me about the plant where you worked.", "Tell me about your job at the plant.", "Time for the lunch whistle."],
    starters: ["What did your plant make?", "Who did you eat lunch with?", "What did the floor sound like when the lines were running?", "What was in your lunch pail?"],
    simple: ["Day shift or night shift?", "A good day's work.", "A hot lunch or a sandwich?"],
    touch: { prompt: "Offer a metal lunch pail to open and close, or a time card to hold.", simple: "Offer a lunch pail with a clasp to open.", items: "a lunch pail, a paper time card", safety: SAFE },
    refs: [{ text: "punching the time clock", years: [1900, 1990], anywhere: true }, { text: "lunch pails and a Thermos of coffee", years: [1910, 1990], anywhere: true },
      { text: "union halls and the company picnic", years: [1935, 1985] }, { text: "the shift-change whistle heard across town", years: [1900, 1975] }] },
  { id: "all-aboard", title: "All Aboard", kind: "work", vocations: ["railroad"],
    art: ["steam-locomotive"],
    invite: ["Tell me about the railroad.", "Tell me about the trains.", "All aboard!"],
    starters: ["What was your job on the railroad?", "Which route did you know best?", "What did the station look like?", "Who were the characters on your crew?"],
    simple: ["Steam or diesel?", "Listen for the whistle.", "A long train coming through."],
    touch: { prompt: "Offer a pocket watch to hold and wind, like a conductor's.", simple: "Offer a pocket watch to hold.", items: "a wind-up pocket watch", safety: SAFE },
    refs: [{ text: "steam giving way to diesel locomotives", years: [1935, 1960], anywhere: true }, { text: "the conductor's pocket watch, set to railroad time", years: [1890, 1970], anywhere: true },
      { text: "the Santa Fe's Super Chief to California", years: [1936, 1971] }, { text: "dining cars with white tablecloths", years: [1900, 1970], anywhere: true }],
    songs: ["wabash-cannonball", "city-of-new-orleans", "chattanooga-choo-choo"] },
  { id: "on-the-road", title: "On the Road", kind: "work", vocations: ["driving"], avoid: ["driving"],
    art: ["bread-truck", "farm-pickup"],
    invite: ["Tell me about your routes.", "Tell me about driving for a living.", "A long road ahead."],
    starters: ["Which route did you like best?", "What was the best diner along the way?", "What did you carry?", "Who did you meet on the road?"],
    simple: ["Big truck or delivery van?", "Coffee at the truck stop.", "Miles and miles of road."],
    touch: { prompt: "Offer a folded paper road map to open, trace and fold again.", simple: "Offer a paper road map to unfold.", items: "a paper road map", safety: "" },
    refs: [{ text: "Route 66", years: [1926, 1985] }, { text: "CB radios", years: [1970, 1990] },
      { text: "truck stops with a counter and pie", years: [1940, 1990] }, { text: "the new Interstate highways, begun in 1956", years: [1956, 1990] }],
    songs: ["six-days-on-the-road", "king-of-the-road"] },
  { id: "the-mail-route", title: "The Mail Route", kind: "work", vocations: ["postal"],
    art: ["rural-mailbox", "letter-writing"],
    invite: ["Tell me about your mail route.", "Tell me about delivering the mail.", "A letter in the box."],
    starters: ["What was your route like?", "Which houses always had a friendly face at the door?", "What was the busiest time of year for mail?", "What did you carry in your bag?"],
    simple: ["Rain or shine?", "The flag is up on the mailbox.", "Everyone waited for the mail."],
    touch: { prompt: "Offer a stack of envelopes to sort into two piles.", simple: "Offer a few envelopes to hold and sort.", items: "envelopes, a small tray", safety: "" },
    refs: [{ text: "three-cent stamps", years: [1932, 1958] }, { text: "four-cent stamps", years: [1958, 1963] },
      { text: "ZIP codes, new in 1963", years: [1963, 1990] }, { text: "the Sears catalog arriving by mail", years: [1893, 1993] }],
    songs: ["please-mr-postman"] },
  { id: "the-store", title: "Minding the Store", kind: "work", vocations: ["commerce"],
    art: ["milk-bottles", "bread-truck"],
    invite: ["Tell me about your store.", "Tell me about your shop.", "Open for business."],
    starters: ["What did you sell?", "Who were your regular customers?", "What was on the shelves by the register?", "What was the busiest day of the year?"],
    simple: ["Busy days or quiet ones?", "A bell over the door.", "Every customer knew your name."],
    touch: { prompt: "Offer a small bell to ring, like the one over a shop door, and paper bags to fold.", simple: "Let them ring a small shop bell.", items: "a hand bell, paper bags", safety: SAFE },
    refs: [{ text: "the five-and-dime: Woolworth's and Kresge's", years: [1900, 1985] }, { text: "cash registers that rang when the drawer opened", years: [1900, 1985], anywhere: true },
      { text: "S&H Green Stamps", years: [1930, 1980] }, { text: "the soda fountain counter", years: [1900, 1965] }] },
  { id: "the-sewing-room", title: "The Sewing Room", kind: "work", vocations: ["sewing"], hobbies: ["sewing", "knitting"],
    art: ["sewing-machine", "sewing-basket", "knitting-basket", "quilt-ohio-star"],
    invite: ["Tell me about something you sewed.", "Tell me about sewing.", "Soft fabric, bright colors."],
    starters: ["What was the finest thing you ever made?", "Who taught you to sew?", "Which fabric did you love working with?", "What did you make for your family?"],
    simple: ["Cotton or wool?", "Such pretty fabric.", "Buttons or zippers?"],
    touch: { prompt: "Offer fabric swatches of different textures (velvet, corduroy, cotton) to feel and sort.", simple: "Offer a soft piece of velvet to stroke.", items: "large fabric swatches", safety: "No pins or needles; large swatches only." },
    refs: [{ text: "Singer sewing machines", years: [1900, 1990], anywhere: true }, { text: "Butterick and Simplicity patterns", years: [1927, 1990] },
      { text: "feed-sack prints made into dresses", years: [1925, 1960] }, { text: "home economics class", years: [1920, 1990] }],
    songs: ["coat-of-many-colors"] },
  { id: "on-duty", title: "On Duty", kind: "work", vocations: ["public-safety"],
    art: ["fire-engine"],
    invite: ["Tell me about serving your town.", "Tell me about your crew.", "A shiny red fire engine."],
    starters: ["What was the station or firehouse like?", "Who was on your crew?", "What made you choose that work?", "What did the town do to thank you all?"],
    simple: ["A shiny truck.", "Days or nights?", "You kept people safe."],
    touch: { prompt: "Offer a polished brass bell to hold and ring.", simple: "Offer a brass bell to ring.", items: "a brass hand bell", safety: SAFE },
    refs: [{ text: "Dalmatians at the firehouse", years: [1900, 1990] }, { text: "call boxes on the street corner", years: [1900, 1970] },
      { text: "the firehouse pancake breakfast", years: [1930, 1990] }] },
  { id: "how-things-work", title: "How Things Work", kind: "work", vocations: ["engineering"],
    art: ["biplane", "pocket-watch", "hot-air-balloon"],
    invite: ["Tell me about a problem you solved.", "Tell me about your work.", "Machines that work just right."],
    starters: ["What were you proudest of designing or building?", "What drew you to science or engineering?", "What was always on your desk?", "What did you think when the astronauts reached the Moon?"],
    simple: ["Big machines or small ones?", "Clever work.", "A slide rule in your pocket."],
    touch: { prompt: "Offer a slide rule, a wind-up watch, or a large nut and bolt to twist together.", simple: "Offer a large nut and bolt to hold and turn.", items: "a slide rule, a large nut and bolt", safety: SAFE },
    refs: [{ text: "slide rules", years: [1900, 1975], anywhere: true }, { text: "the Moon landing, July 1969", years: [1969, 1990], anywhere: true },
      { text: "drafting tables and T-squares", years: [1900, 1985], anywhere: true }, { text: "the Space Race", years: [1957, 1975], anywhere: true }],
    songs: ["fly-me-to-the-moon"] },
  { id: "the-congregation", title: "The Congregation", kind: "work", vocations: ["ministry"], avoid: ["religion"],
    art: ["stained-glass-window"],
    invite: ["Tell me about the people you served.", "Tell me about your congregation.", "Voices singing together."],
    starters: ["What did you love about serving your congregation?", "Which gatherings brought the most people together?", "What music did people love to sing?", "Who helped you the most?"],
    simple: ["Did you like the music?", "A peaceful place.", "Many people were glad of you."],
    touch: { prompt: "Offer a well-worn songbook to hold and open.", simple: "Offer a soft-covered book to hold.", items: "a songbook", safety: "" },
    refs: [{ text: "potluck suppers in the fellowship hall", years: [1930, 1990] }, { text: "choir practice on Wednesday nights", years: [1900, 1990] }] },
  { id: "a-days-work", title: "A Day's Work", kind: "work", vocations: ["general"],
    art: ["pocket-watch", "sunday-paper"],
    invite: ["Tell me about the work you did.", "Tell me about your job.", "Hard work, done well."],
    starters: ["What was your first job?", "What did you like best about your work?", "Who did you enjoy working with?", "What did you do on a day off?"],
    simple: ["Indoors or outdoors?", "A good day's work.", "Mornings or afternoons?"],
    touch: { prompt: "Offer a pocket watch or a pair of work gloves to hold.", simple: "Offer soft work gloves to hold.", items: "a pocket watch, work gloves", safety: SAFE },
    refs: [{ text: "punching a time clock", years: [1900, 1990], anywhere: true }, { text: "a Thermos of coffee for the day", years: [1910, 1990], anywhere: true }] },

  /* ---- place (region and setting) ---- */
  { id: "the-county-fair", title: "The County Fair", kind: "place", match: "both", settings: ["rural", "town"], regions: ["midwest", "plains", "south", "appalachia", "southwest", "mountain-west", "pacific", "new-england", "northeast"],
    art: ["proud-rooster", "pumpkin-patch", "red-barn"],
    invite: ["Tell me about the county fair.", "Tell me about fair time.", "Fair time!"],
    starters: ["What did you most look forward to at the fair?", "Did you ever show an animal or enter a pie?", "What did the midway smell like?", "Who did you go to the fair with?"],
    simple: ["Rides or animals?", "A blue ribbon!", "Cotton candy or a corn dog?"],
    touch: { prompt: "Offer a satin prize ribbon to hold and smooth.", simple: "Offer a satin ribbon to stroke.", items: "a satin prize ribbon", safety: "" },
    refs: [{ text: "4-H barns full of calves and lambs", years: [1914, 1990] }, { text: "blue ribbons for pies and quilts", years: [1900, 1990] },
      { text: "the Ferris wheel on the midway", years: [1900, 1990], anywhere: true }, { text: "the butter cow at the Iowa State Fair, since 1911", years: [1911, 1990], states: ["IA"] },
      { text: "the State Fair of Texas and Big Tex", years: [1952, 1990], states: ["TX"] }],
    songs: ["shine-on-harvest-moon", "oh-what-a-beautiful-mornin"] },
  { id: "main-street", title: "Saturday in Town", kind: "place", match: "both", settings: ["town", "rural"], regions: ["midwest", "plains", "south", "appalachia", "southwest", "mountain-west", "pacific", "new-england", "northeast", "canada"],
    art: ["rural-mailbox", "bread-truck", "milk-bottles"],
    invite: ["Tell me about Main Street where you grew up.", "Tell me about Saturdays in town.", "Main Street on a Saturday."],
    starters: ["What did your family do on a Saturday in town?", "Which store on Main Street did you like best?", "Where did you go for a soda or a malt?", "What was playing at the movie house?"],
    simple: ["Ice cream or a soda?", "Main Street all lit up.", "A new outfit for Saturday."],
    touch: { prompt: "Offer a folded paper shopping bag with a few light things inside to unpack.", simple: "Offer a paper bag to hold and open.", items: "a paper bag, a scarf, a spool of thread", safety: SAFE },
    refs: [{ text: "the Sears, Roebuck catalog", years: [1893, 1993], regions: ["midwest", "plains", "south", "appalachia", "southwest", "mountain-west", "pacific", "new-england", "northeast"] },
      { text: "Schwinn bicycles from Chicago", years: [1895, 1990], regions: ["midwest"] }, { text: "Radio Flyer wagons", years: [1930, 1990], regions: ["midwest"] },
      { text: "Maytag washers from Newton, Iowa", years: [1907, 1990], states: ["IA"] }, { text: "supper clubs and the Friday fish fry", years: [1935, 1990], states: ["WI", "MN", "IA", "MI"] },
      { text: "the WLS National Barn Dance on Saturday-night radio", years: [1924, 1960], regions: ["midwest", "plains"] },
      { text: "Kellogg's Corn Flakes from Battle Creek", years: [1906, 1990], regions: ["midwest"] },
      { text: "Kool-Aid, invented in Hastings, Nebraska", years: [1927, 1990], states: ["NE"] },
      { text: "Piggly Wiggly grocery stores", years: [1916, 1990], regions: ["south", "appalachia"] },
      { text: "an RC Cola and a MoonPie", years: [1930, 1990], regions: ["south", "appalachia"] },
      { text: "Dr Pepper from Waco", years: [1885, 1990], regions: ["southwest"] }, { text: "Fritos from San Antonio", years: [1932, 1990], regions: ["southwest"] },
      { text: "the Eaton's catalogue", years: [1884, 1976], regions: ["canada"] }, { text: "Friendly's ice cream", years: [1935, 1990], regions: ["new-england"] }] },
  { id: "downtown", title: "Downtown", kind: "place", settings: ["city"],
    art: ["streetcar", "sunday-paper"],
    invite: ["Tell me about downtown when you were young.", "Tell me about the city.", "The busy city."],
    starters: ["What was downtown like when you were young?", "Which department store did you love?", "How did you get around the city?", "Where did you go on a summer evening?"],
    simple: ["Streetcar or bus?", "Bright lights downtown.", "Window shopping!"],
    touch: { prompt: "Offer a folded newspaper to open, or a smooth token or button to turn in the fingers.", simple: "Offer a folded newspaper to hold.", items: "a newspaper, a large button", safety: SAFE },
    refs: [{ text: "Marshall Field's and its Frango mints", years: [1929, 1990], states: ["IL"] }, { text: "Hudson's department store in Detroit", years: [1891, 1983], states: ["MI"] },
      { text: "Chicago's \"L\" trains", years: [1892, 1990], states: ["IL"] }, { text: "Harry Caray calling Cardinals games on the radio", years: [1945, 1969], states: ["MO", "IL"] },
      { text: "the Horn & Hardart Automat", years: [1902, 1991], states: ["NY", "PA"] }, { text: "subway tokens", years: [1953, 1990], states: ["NY"] },
      { text: "the Macy's Thanksgiving Day Parade", years: [1924, 1990], regions: ["northeast"] }, { text: "Coney Island and Nathan's hot dogs", years: [1916, 1990], states: ["NY", "NJ"] },
      { text: "the Brooklyn Dodgers at Ebbets Field", years: [1913, 1957], states: ["NY"] }, { text: "egg creams at the corner candy store", years: [1900, 1990], states: ["NY", "NJ"] },
      { text: "stickball in the street", years: [1900, 1980], regions: ["northeast"] }, { text: "American Bandstand from Philadelphia", years: [1952, 1964], regions: ["northeast"] },
      { text: "Tastykakes from Philadelphia", years: [1914, 1990], states: ["PA", "NJ", "DE", "MD"] }, { text: "Red Sox games on the radio", years: [1926, 1990], regions: ["new-england"] },
      { text: "San Francisco's cable cars", years: [1873, 1990], states: ["CA"] }, { text: "the Space Needle and the 1962 World's Fair", years: [1962, 1990], states: ["WA", "OR"] },
      { text: "See's Candies", years: [1921, 1990], states: ["CA", "OR", "WA"] }, { text: "Rich's department store in Atlanta", years: [1867, 1991], states: ["GA"] },
      { text: "streetcars and trolley lines", years: [1890, 1960] }],
    songs: ["chicago-sinatra"] },
  { id: "the-porch", title: "Evenings on the Porch", kind: "place", regions: ["south", "appalachia"], settings: ["town", "rural"],
    art: ["porch-swing", "rocking-chair", "magnolia-branch"],
    invite: ["Tell me about evenings on the porch.", "Tell me about summer evenings.", "Evening on the porch."],
    starters: ["Who sat with you on the porch in the evening?", "What could you hear from the porch on a summer night?", "What did you sip on a hot afternoon?", "Which neighbors stopped by?"],
    simple: ["Sweet tea or lemonade?", "A breeze on the porch.", "Rocking slow and easy."],
    touch: { prompt: "Offer a folding paper hand fan to open and wave.", simple: "Offer a hand fan to hold and wave.", items: "a paper hand fan", safety: "" },
    refs: [{ text: "the Grand Ole Opry on WSM radio", years: [1925, 1990], regions: ["south", "appalachia"] }, { text: "Coca-Cola in the glass bottle", years: [1915, 1990] },
      { text: "the Louisiana Hayride on Saturday-night radio", years: [1948, 1960], states: ["LA", "TX", "AR", "MS"] }, { text: "Duke's mayonnaise on a tomato sandwich", years: [1917, 1990], regions: ["south"] },
      { text: "Goo Goo Clusters from Nashville", years: [1912, 1990], states: ["TN", "KY", "AL", "GA"] }, { text: "The Andy Griffith Show's Mayberry", years: [1960, 1990] }],
    songs: ["tennessee-waltz", "georgia-on-my-mind", "you-are-my-sunshine"] },
  { id: "by-the-water", title: "By the Water", kind: "place", settings: ["shore"], regions: ["new-england", "pacific"], hobbies: ["fishing"], avoid: ["water"],
    art: ["lighthouse", "seashells", "lake-sailboat", "gone-fishing"],
    invite: ["Tell me about the water where you grew up.", "Tell me about days by the water.", "Out by the water."],
    starters: ["What did the water look like on a good day?", "Who took you out on the water?", "What did you catch or collect along the shore?", "What did a summer day by the water smell like?"],
    simple: ["Sunrise or sunset?", "Waves on the shore.", "A sailboat on the water."],
    touch: { prompt: "Offer a large, smooth seashell or a smooth stone to hold and turn.", simple: "Offer a large seashell to hold.", items: "a large smooth shell, a smooth stone", safety: "Large items with no sharp edges." },
    refs: [{ text: "clambakes on the beach", years: [1900, 1990], regions: ["new-england"] }, { text: "lobster boats and painted buoys", years: [1900, 1990], regions: ["new-england"] },
      { text: "Howard Johnson's orange roofs and 28 flavors", years: [1929, 1985], regions: ["new-england", "northeast"] },
      { text: "Disneyland, opened in 1955", years: [1955, 1990], regions: ["pacific"] }, { text: "surf music and the Beach Boys", years: [1961, 1975], regions: ["pacific"] },
      { text: "summer cottages on the lake", years: [1900, 1990], regions: ["midwest"] }],
    songs: ["surfin-usa", "moonlight-in-vermont"] },
  { id: "the-mountains", title: "Up in the Mountains", kind: "place", settings: ["mountain"], regions: ["appalachia", "mountain-west"], hobbies: ["outdoors"],
    art: ["mountain-lake", "pine-cones", "chickadee-pine"],
    invite: ["Tell me about the mountains where you grew up.", "Tell me about the mountains.", "High up in the mountains."],
    starters: ["What did the mountains look like in the fall?", "Where did you go walking or hiking?", "What did your family put up for the winter?", "What music did people play in the evenings?"],
    simple: ["Summer or winter?", "Tall pines and fresh air.", "A cool mountain lake."],
    touch: { prompt: "Offer a large pine cone and a smooth river stone to hold.", simple: "Offer a large pine cone to hold.", items: "a large pine cone, a river stone", safety: "Large, clean items." },
    refs: [{ text: "bluegrass from Flatt and Scruggs and Bill Monroe", years: [1939, 1990], regions: ["appalachia"] }, { text: "quilting bees", years: [1900, 1990], regions: ["appalachia"] },
      { text: "putting up beans and apples for winter", years: [1900, 1990], regions: ["appalachia"] }, { text: "Yellowstone and Old Faithful", years: [1900, 1990], states: ["WY", "MT", "ID"] },
      { text: "Hoover Dam, finished in 1936", years: [1936, 1990], states: ["NV", "AZ", "UT"] }],
    songs: ["rocky-top", "blue-moon-of-kentucky", "rocky-mountain-high", "foggy-mountain-breakdown"] },
  { id: "maple-season", title: "Maple Season", kind: "place", regions: ["new-england"],
    art: ["autumn-maple", "covered-bridge"],
    invite: ["Tell me about the seasons in New England.", "Tell me about autumn where you grew up.", "Maple trees in the fall."],
    starters: ["What did the hills look like in October?", "Did your family tap trees for maple syrup?", "What happened on town meeting day?", "Where did you go for ice cream in summer?"],
    simple: ["Autumn or spring?", "Bright autumn leaves.", "Warm maple syrup."],
    touch: { prompt: "Offer a large, dried maple leaf in a clear sleeve, or a smooth wooden spoon, to hold.", simple: "Offer a leaf in a clear sleeve to hold.", items: "a pressed maple leaf, a wooden spoon", safety: "" },
    refs: [{ text: "maple sugaring in early spring", years: [1900, 1990] }, { text: "covered bridges", years: [1900, 1990] },
      { text: "L.L.Bean in Freeport, Maine", years: [1912, 1990], states: ["ME", "NH", "VT", "MA"] }, { text: "Moxie soda", years: [1884, 1990], states: ["ME", "NH", "MA"] }, { text: "Fluffernutter sandwiches", years: [1960, 1990] }],
    songs: ["moonlight-in-vermont"] },
  { id: "big-sky", title: "Big Sky Country", kind: "place", regions: ["plains", "mountain-west"],
    art: ["farm-windmill", "sunflower"],
    invite: ["Tell me about the wide-open country.", "Tell me about the prairie.", "The wide-open prairie."],
    starters: ["What could you see from the edge of town?", "What was harvest season like?", "Where did you go for a treat?", "How far was it to the nearest neighbor?"],
    simple: ["Sunrise or sunset?", "Sky as far as you can see.", "Wheat waving in the wind."],
    touch: { prompt: "Offer a bundle of dried wheat stalks (without loose grain) or a smooth wooden fence rail to feel.", simple: "Offer dried wheat stalks to hold.", items: "dried wheat stalks, a smooth wood piece", safety: "No loose grain for anyone who may put things in their mouth." },
    refs: [{ text: "grain elevators along the railroad", years: [1880, 1990] }, { text: "wheat harvest and the custom cutting crews", years: [1920, 1990] },
      { text: "Lawrence Welk, the North Dakota bandleader, on Saturday-night TV", years: [1955, 1982] }, { text: "Gunsmoke, set in Dodge City, Kansas", years: [1952, 1975] },
      { text: "rodeo season", years: [1900, 1990] }],
    songs: ["home-on-the-range", "dont-fence-me-in", "oh-what-a-beautiful-mornin"] },
  { id: "the-southwest", title: "Sunny Southwest", kind: "place", regions: ["southwest"],
    art: ["sunburst-medallion", "farm-windmill"],
    invite: ["Tell me about the Southwest.", "Tell me about where you grew up.", "Sunny days out west."],
    starters: ["What did the air smell like after a rain?", "What was your favorite meal growing up?", "What music played at the dances?", "What did you do on the hottest days?"],
    simple: ["Hot or mild?", "Warm sun and blue sky.", "A good plate of food."],
    touch: { prompt: "Offer a warm, smooth stone or a woven blanket to hold.", simple: "Offer a woven blanket to feel.", items: "a smooth stone, a woven blanket", safety: SAFE },
    refs: [{ text: "Route 66", years: [1926, 1985] }, { text: "Blue Bell ice cream from Brenham", years: [1907, 1990], states: ["TX"] },
      { text: "roasting green chile in the fall", years: [1900, 1990], states: ["NM", "AZ"] }, { text: "Bob Wills and his Texas Playboys", years: [1933, 1973] },
      { text: "rodeos and the State Fair of Texas", years: [1886, 1990] }],
    songs: ["san-antonio-rose", "cielito-lindo", "la-bamba"] },
  { id: "home-in-canada", title: "Home in Canada", kind: "place", regions: ["canada"],
    art: ["chickadee-pine", "snowflake-medallion", "mountain-lake"],
    invite: ["Tell me about Canada.", "Tell me about winters where you grew up.", "Winter in the north."],
    starters: ["Who taught you to skate?", "What were winters like where you grew up?", "Which team did your family cheer for?", "What did you do on a snow day?"],
    simple: ["Skating or sledding?", "Snow on the pines.", "Hot cocoa after the cold."],
    touch: { prompt: "Offer warm mittens or a knitted scarf to hold.", simple: "Offer warm mittens to hold.", items: "mittens, a knitted scarf", safety: "" },
    refs: [{ text: "Hockey Night in Canada on Saturday", years: [1931, 1990] }, { text: "the Eaton's catalogue", years: [1884, 1976] },
      { text: "Tim Hortons, from 1964", years: [1964, 1990] }, { text: "CBC Radio", years: [1936, 1990] }, { text: "skating on the frozen pond", years: [1900, 1990], anywhere: true }] },
  { id: "where-you-grew-up", title: "Where You Grew Up", kind: "place", regions: ["abroad"],
    art: ["compass-rose", "teapot-and-cup"],
    invite: ["Tell me about the place you grew up.", "Tell me about your hometown.", "The place you come from."],
    starters: ["What did your hometown look like?", "What was a favorite meal from home?", "What songs did your family sing?", "What was market day like?"],
    simple: ["City or country?", "A place you love.", "Good food from home."],
    touch: { prompt: "Offer a warm cup of their favorite drink to hold, or a soft cloth with a familiar pattern.", simple: "Offer a soft patterned cloth to hold.", items: "a cup, a patterned cloth", safety: "Warm, never hot." },
    refs: [] },

  /* ---- era and home (anyone) ---- */
  { id: "on-the-radio", title: "On the Radio", kind: "era", everyone: true,
    art: ["cathedral-radio", "phonograph"],
    invite: ["Tell me about the radio programs you loved.", "Tell me about listening to the radio.", "A song on the radio."],
    starters: ["Which programs did your family gather around the radio for?", "Who was your favorite singer on the radio?", "Where did the radio sit in your house?", "What did you listen to while you worked?"],
    simple: ["Music or stories?", "Let's turn up the radio.", "A song you like is playing."],
    touch: { prompt: "Play a song from their teens or twenties softly, and offer a hand to tap the beat together.", simple: "Play a familiar song softly and hold hands to the beat.", items: "a small radio or speaker", safety: "Keep the volume low; watch for signs of overload." },
    refs: [{ text: "Fibber McGee and Molly", years: [1935, 1959] }, { text: "The Jack Benny Program", years: [1932, 1955] },
      { text: "The Shadow", years: [1937, 1954] }, { text: "Your Hit Parade", years: [1935, 1959] }, { text: "The Lone Ranger", years: [1933, 1954] },
      { text: "Arthur Godfrey Time", years: [1945, 1972] }, { text: "Paul Harvey News", years: [1951, 1990] }, { text: "transistor radios", years: [1954, 1980], anywhere: true },
      { text: "Top 40 radio and the disc jockeys", years: [1955, 1990] }, { text: "the Grand Ole Opry on Saturday night", years: [1925, 1990] }] },
  { id: "the-television", title: "The Family Television", kind: "era", everyone: true,
    art: ["rocking-chair", "sunday-paper"],
    invite: ["Tell me about the shows you loved to watch.", "Tell me about watching TV.", "A good show on tonight."],
    starters: ["What was the first television you ever saw like?", "Which show did the whole family watch together?", "Who was your favorite TV star?", "Which night of the week had the best shows?"],
    simple: ["Comedies or westerns?", "Everybody around the television.", "A good laugh together."],
    touch: { prompt: "Offer a soft throw blanket to spread over the lap, as on a family TV night.", simple: "Offer a soft blanket for the lap.", items: "a throw blanket", safety: "" },
    refs: [{ text: "I Love Lucy", years: [1951, 1957] }, { text: "The Ed Sullivan Show", years: [1948, 1971] }, { text: "Howdy Doody", years: [1947, 1960] },
      { text: "Gunsmoke", years: [1955, 1975] }, { text: "Father Knows Best", years: [1954, 1960] }, { text: "The Lawrence Welk Show", years: [1955, 1982] },
      { text: "The Andy Griffith Show", years: [1960, 1968] }, { text: "Bonanza", years: [1959, 1973] }, { text: "The Dick Van Dyke Show", years: [1961, 1966] },
      { text: "The Beverly Hillbillies", years: [1962, 1971] }, { text: "Johnny Carson on The Tonight Show", years: [1962, 1992] },
      { text: "Walter Cronkite on the evening news", years: [1962, 1981] }, { text: "The Carol Burnett Show", years: [1967, 1978] },
      { text: "The Mary Tyler Moore Show", years: [1970, 1977] }, { text: "The Waltons", years: [1972, 1981] }, { text: "Little House on the Prairie", years: [1974, 1983] },
      { text: "Hee Haw", years: [1969, 1992] }],
    songs: ["happy-trails", "green-acres", "i-want-to-hold-your-hand"] },
  { id: "at-the-movies", title: "At the Movies", kind: "era", everyone: true,
    art: ["convertible", "box-camera"],
    invite: ["Tell me about the movies you loved.", "Tell me about going to the pictures.", "The picture is starting."],
    starters: ["What was the first movie you saw in a theater like?", "Who was your favorite movie star?", "Where did you go on a movie date?", "What treat did you buy at the movies?"],
    simple: ["Popcorn or candy?", "A night at the movies.", "A happy ending."],
    touch: { prompt: "Offer a small paper popcorn bag or a pair of old-style movie tickets to hold.", simple: "Offer a paper popcorn bag to hold.", items: "a paper popcorn bag, ticket stubs", safety: "Empty bag; no food for anyone who may choke." },
    refs: [{ text: "drive-in theaters", years: [1933, 1985] }, { text: "Saturday matinees with a cartoon and a newsreel", years: [1930, 1965] },
      { text: "Singin' in the Rain (1952)", years: [1952, 1990], anywhere: true }, { text: "The Wizard of Oz (1939)", years: [1939, 1990], anywhere: true }, { text: "The Sound of Music (1965)", years: [1965, 1990], anywhere: true },
      { text: "westerns with John Wayne", years: [1939, 1976], anywhere: true }, { text: "Doris Day and Rock Hudson comedies", years: [1959, 1964] }],
    songs: ["singin-in-the-rain", "moon-river", "tammy", "do-re-mi"] },
  { id: "the-sunday-drive", title: "The Sunday Drive", kind: "era", everyone: true, hobbies: ["classic-cars", "travel"], avoid: ["driving"],
    art: ["sunday-sedan", "convertible", "woody-wagon"],
    invite: ["Tell me about the cars you loved.", "Tell me about a Sunday drive.", "A drive in the country."],
    starters: ["What was the first car your family owned?", "Where did you go on a Sunday drive?", "What color was your favorite car?", "What did you see along the way?"],
    simple: ["Big car or little car?", "Chrome shining in the sun.", "Windows down on a summer day."],
    touch: { prompt: "Offer a small leather-wrapped steering wheel cover or a chrome hood ornament replica to hold.", simple: "Offer something smooth and chrome to hold.", items: "a steering wheel cover, a chrome ornament", safety: SAFE },
    refs: [{ text: "the Chevrolet Bel Air", years: [1950, 1975] }, { text: "the Ford Thunderbird, new in 1955", years: [1955, 1975] },
      { text: "tail fins on the 1959 Cadillac", years: [1959, 1975] }, { text: "the Volkswagen Beetle", years: [1955, 1979] },
      { text: "Burma-Shave signs along the highway", years: [1925, 1963] }, { text: "A&W root beer stands with carhops", years: [1919, 1990] }],
    songs: ["little-deuce-coupe"] },
  { id: "the-kitchen-table", title: "The Kitchen Table", kind: "home", everyone: true, hobbies: ["baking", "cooking"],
    art: ["coffee-percolator", "chrome-toaster", "teapot-and-cup", "table-setting"],
    invite: ["Tell me about the kitchen where you grew up.", "Tell me about family meals.", "The kitchen table."],
    starters: ["What was always cooking in the kitchen when you were growing up?", "Who made the best pie in your family?", "What was breakfast like on a school day?", "Which dish did you make for company?"],
    simple: ["Coffee or tea?", "Something smells good.", "Pie or cake?"],
    touch: { prompt: "Offer a warm (not hot) mug to hold and a teaspoon to stir.", simple: "Offer a warm mug to hold with both hands.", items: "a mug, a teaspoon", safety: "Warm, never hot." },
    refs: [{ text: "Jell-O salads", years: [1930, 1985] }, { text: "percolator coffee on the stove", years: [1920, 1975], anywhere: true }, { text: "Pyrex bowls", years: [1945, 1985] },
      { text: "Swanson TV dinners", years: [1953, 1985] }, { text: "Kool-Aid in summer", years: [1927, 1990] }, { text: "Campbell's soup", years: [1900, 1990] }],
    songs: ["jambalaya"] },
  { id: "playtime", title: "Playtime", kind: "pastime", everyone: true, hobbies: ["cards", "board-games"],
    art: ["cards-and-dominoes", "vintage-bicycle"],
    invite: ["Tell me about the games you played growing up.", "Tell me about playing outside.", "Games and fun."],
    starters: ["What games did you play outside after school?", "What was your favorite toy?", "Who did you play with on your street?", "What did you do on a snowy day?"],
    simple: ["Marbles or jacks?", "Let's play a round of cards.", "A bicycle ride on a summer day."],
    touch: { prompt: "Offer a deck of large-print playing cards or a few big wooden dominoes to hold and sort.", simple: "Offer big dominoes to hold and line up.", items: "large-print cards, wooden dominoes", safety: SAFE },
    refs: [{ text: "Radio Flyer wagons", years: [1930, 1990] }, { text: "Lincoln Logs", years: [1916, 1990] }, { text: "jacks and marbles", years: [1900, 1970], anywhere: true },
      { text: "the Slinky, new in 1945", years: [1945, 1990] }, { text: "Mr. Potato Head, new in 1952", years: [1952, 1990] },
      { text: "the Hula-Hoop craze of 1958", years: [1958, 1970], anywhere: true }, { text: "hopscotch and jump rope", years: [1900, 1990], anywhere: true }, { text: "Schwinn bicycles", years: [1895, 1990] }],
    songs: ["daisy-bell", "take-me-out-to-the-ball-game"] },
  { id: "dance-night", title: "Dance Night", kind: "pastime", everyone: true, hobbies: ["dancing", "singing"],
    art: ["phonograph", "cathedral-radio"],
    invite: ["Tell me about the dances you went to.", "Tell me about dancing.", "Music for dancing."],
    starters: ["Where did you go dancing?", "Who was your favorite dance partner?", "What did you wear to a dance?", "Which song always got you on the floor?"],
    simple: ["Fast songs or slow ones?", "Tap your toes with me.", "A beautiful dance."],
    touch: { prompt: "Offer a light scarf to sway with while a favorite song plays.", simple: "Offer a soft scarf to hold and sway.", items: "a light scarf", safety: "Seated, or with support to stand." },
    refs: [{ text: "sock hops in the school gym", years: [1944, 1965] }, { text: "the jitterbug and swing dancing", years: [1935, 1955] },
      { text: "the Twist, 1960", years: [1960, 1970], anywhere: true }, { text: "ballroom dances with a live band", years: [1925, 1970], anywhere: true },
      { text: "American Bandstand", years: [1957, 1989] }, { text: "polka dances at the hall", years: [1900, 1990], anywhere: true }],
    songs: ["in-the-mood", "rock-around-the-clock", "blue-danube", "pennsylvania-polka"] },
  { id: "the-ballgame", title: "The Ballgame", kind: "pastime", hobbies: ["sports", "golf-bowling"],
    art: ["sunday-paper", "cards-and-dominoes"],
    invite: ["Tell me about the teams you cheered for.", "Tell me about the ballgame.", "Take me out to the ballgame!"],
    starters: ["Which team did you cheer for?", "What was it like to be at a game in person?", "Who played ball with you growing up?", "Where did you listen to the big games?"],
    simple: ["Baseball or football?", "A home run!", "Peanuts and popcorn."],
    touch: { prompt: "Offer a baseball or a soft ball to hold and turn by the seams.", simple: "Offer a soft ball to hold and squeeze.", items: "a baseball, a soft ball", safety: SAFE },
    refs: [{ text: "baseball on the radio", years: [1921, 1990] }, { text: "the World Series every October", years: [1903, 1990] },
      { text: "Friday-night high school football", years: [1920, 1990] }, { text: "bowling leagues", years: [1940, 1990] }],
    songs: ["take-me-out-to-the-ball-game"] },
  { id: "in-the-garden", title: "In the Garden", kind: "pastime", hobbies: ["gardening", "birds"],
    art: ["potting-bench", "watering-can", "garden-rose", "cardinal-branch"],
    invite: ["Tell me about your garden.", "Tell me about growing things.", "The garden in summer."],
    starters: ["What did you love to grow?", "Who taught you to garden?", "Which birds came to your yard?", "What did your garden look like in summer?"],
    simple: ["Flowers or vegetables?", "Flowers in bloom.", "A bird at the feeder."],
    touch: { prompt: "Offer a small pot of soil or a sprig of lavender or mint to touch and smell.", simple: "Offer a sprig of lavender to smell.", items: "a pot of soil, lavender, mint", safety: "Non-toxic plants only; wash hands after." },
    refs: [{ text: "victory gardens", years: [1942, 1946], avoid: ["war"] }, { text: "Burpee seed catalogs", years: [1900, 1990] },
      { text: "the Farmers' Almanac planting days", years: [1900, 1990] }] },
  { id: "faithful-friends", title: "Faithful Friends", kind: "pastime", hobbies: ["animals"],
    art: ["faithful-dog", "sleeping-cat"],
    invite: ["Tell me about the animals you loved.", "Tell me about your pets.", "A loyal friend."],
    starters: ["Which animal was your favorite?", "What was your dog or cat like?", "What tricks did your pets know?", "Who took care of the animals at your house?"],
    simple: ["Dogs or cats?", "A faithful friend.", "So soft to pet."],
    touch: { prompt: "Offer a soft, washable stuffed dog or cat to hold and stroke.", simple: "Offer a soft animal to hold.", items: "a soft stuffed animal", safety: "Offer it as a companion, never as a toy; follow their lead." },
    refs: [{ text: "Lassie on television", years: [1954, 1973] }, { text: "Rin Tin Tin", years: [1954, 1959] }] }
];

export interface Song { id: string; title: string; artist: string; year: number; genres: readonly string[]; regions?: readonly string[]; vocations?: readonly string[]; avoid?: readonly Avoid[]; singalong?: boolean; }
/* year 0: traditional, timeless. Genres match profile.html's music list. */
export const SONGS: readonly Song[] = [
  { id: "in-the-mood", title: "In the Mood", artist: "Glenn Miller Orchestra", year: 1939, genres: ["big-band"] },
  { id: "chattanooga-choo-choo", title: "Chattanooga Choo Choo", artist: "Glenn Miller Orchestra", year: 1941, genres: ["big-band"], vocations: ["railroad"] },
  { id: "sentimental-journey", title: "Sentimental Journey", artist: "Les Brown and Doris Day", year: 1945, genres: ["big-band", "crooners"] },
  { id: "boogie-woogie-bugle-boy", title: "Boogie Woogie Bugle Boy", artist: "The Andrews Sisters", year: 1941, genres: ["big-band"], vocations: ["military"], avoid: ["war"] },
  { id: "dont-fence-me-in", title: "Don't Fence Me In", artist: "Bing Crosby and the Andrews Sisters", year: 1944, genres: ["crooners", "country"], regions: ["plains", "southwest", "mountain-west"] },
  { id: "moonlight-in-vermont", title: "Moonlight in Vermont", artist: "Margaret Whiting", year: 1944, genres: ["crooners"], regions: ["new-england"] },
  { id: "you-are-my-sunshine", title: "You Are My Sunshine", artist: "Jimmie Davis", year: 1940, genres: ["country"], regions: ["south"], singalong: true },
  { id: "take-me-out-to-the-ball-game", title: "Take Me Out to the Ball Game", artist: "a sing-along favorite", year: 1908, genres: [], singalong: true },
  { id: "daisy-bell", title: "Daisy Bell (A Bicycle Built for Two)", artist: "a sing-along favorite", year: 1892, genres: [], singalong: true },
  { id: "home-on-the-range", title: "Home on the Range", artist: "a traditional cowboy song", year: 0, genres: ["country", "folk"], regions: ["plains", "mountain-west"], singalong: true },
  { id: "shine-on-harvest-moon", title: "Shine On, Harvest Moon", artist: "a sing-along favorite", year: 1908, genres: [], singalong: true },
  { id: "oh-what-a-beautiful-mornin", title: "Oh, What a Beautiful Mornin'", artist: "from Oklahoma!", year: 1943, genres: ["broadway"], regions: ["plains"], vocations: ["farming"], singalong: true },
  { id: "wabash-cannonball", title: "Wabash Cannonball", artist: "Roy Acuff", year: 1936, genres: ["country"], regions: ["midwest"], vocations: ["railroad"] },
  { id: "san-antonio-rose", title: "New San Antonio Rose", artist: "Bob Wills and His Texas Playboys", year: 1940, genres: ["country"], regions: ["southwest"] },
  { id: "blue-moon-of-kentucky", title: "Blue Moon of Kentucky", artist: "Bill Monroe", year: 1946, genres: ["country", "folk"], regions: ["appalachia", "south"] },
  { id: "foggy-mountain-breakdown", title: "Foggy Mountain Breakdown", artist: "Flatt and Scruggs", year: 1949, genres: ["country", "folk"], regions: ["appalachia"] },
  { id: "tennessee-waltz", title: "Tennessee Waltz", artist: "Patti Page", year: 1950, genres: ["country", "crooners"], regions: ["south", "appalachia"] },
  { id: "goodnight-irene", title: "Goodnight, Irene", artist: "The Weavers", year: 1950, genres: ["folk"], singalong: true },
  { id: "unforgettable", title: "Unforgettable", artist: "Nat King Cole", year: 1951, genres: ["crooners", "jazz-blues"] },
  { id: "singin-in-the-rain", title: "Singin' in the Rain", artist: "Gene Kelly", year: 1952, genres: ["broadway"], singalong: true },
  { id: "happy-trails", title: "Happy Trails", artist: "Roy Rogers and Dale Evans", year: 1952, genres: ["country"], regions: ["southwest", "mountain-west", "plains"] },
  { id: "jambalaya", title: "Jambalaya (On the Bayou)", artist: "Hank Williams", year: 1952, genres: ["country"], regions: ["south"], vocations: ["culinary"] },
  { id: "mr-sandman", title: "Mr. Sandman", artist: "The Chordettes", year: 1954, genres: ["crooners"] },
  { id: "rock-around-the-clock", title: "Rock Around the Clock", artist: "Bill Haley and His Comets", year: 1954, genres: ["rock-and-roll"] },
  { id: "que-sera-sera", title: "Que Sera, Sera", artist: "Doris Day", year: 1956, genres: ["crooners"], vocations: ["homemaking"], singalong: true },
  { id: "love-me-tender", title: "Love Me Tender", artist: "Elvis Presley", year: 1956, genres: ["rock-and-roll", "crooners"] },
  { id: "i-walk-the-line", title: "I Walk the Line", artist: "Johnny Cash", year: 1956, genres: ["country"] },
  { id: "tammy", title: "Tammy", artist: "Debbie Reynolds", year: 1957, genres: ["crooners"] },
  { id: "chicago-sinatra", title: "Chicago (That Toddlin' Town)", artist: "Frank Sinatra", year: 1957, genres: ["crooners"], regions: ["midwest"] },
  { id: "la-bamba", title: "La Bamba", artist: "Ritchie Valens", year: 1958, genres: ["latin", "rock-and-roll"], regions: ["southwest", "pacific"] },
  { id: "cielito-lindo", title: "Cielito Lindo", artist: "a traditional Mexican song", year: 0, genres: ["latin"], regions: ["southwest"], singalong: true },
  { id: "georgia-on-my-mind", title: "Georgia on My Mind", artist: "Ray Charles", year: 1960, genres: ["jazz-blues", "motown"], regions: ["south"] },
  { id: "wonderful-world-cooke", title: "Wonderful World", artist: "Sam Cooke", year: 1960, genres: ["motown"], vocations: ["teacher"] },
  { id: "crazy", title: "Crazy", artist: "Patsy Cline", year: 1961, genres: ["country"] },
  { id: "stand-by-me", title: "Stand by Me", artist: "Ben E. King", year: 1961, genres: ["motown"] },
  { id: "moon-river", title: "Moon River", artist: "Andy Williams", year: 1962, genres: ["crooners"] },
  { id: "cant-help-falling-in-love", title: "Can't Help Falling in Love", artist: "Elvis Presley", year: 1961, genres: ["rock-and-roll", "crooners"] },
  { id: "please-mr-postman", title: "Please Mr. Postman", artist: "The Marvelettes", year: 1961, genres: ["motown"], vocations: ["postal"] },
  { id: "surfin-usa", title: "Surfin' U.S.A.", artist: "The Beach Boys", year: 1963, genres: ["rock-and-roll"], regions: ["pacific"] },
  { id: "little-deuce-coupe", title: "Little Deuce Coupe", artist: "The Beach Boys", year: 1963, genres: ["rock-and-roll"], vocations: ["mechanic"], avoid: ["driving"] },
  { id: "six-days-on-the-road", title: "Six Days on the Road", artist: "Dave Dudley", year: 1963, genres: ["country"], vocations: ["driving"], avoid: ["driving"] },
  { id: "i-want-to-hold-your-hand", title: "I Want to Hold Your Hand", artist: "The Beatles", year: 1963, genres: ["rock-and-roll"] },
  { id: "fly-me-to-the-moon", title: "Fly Me to the Moon", artist: "Frank Sinatra with Count Basie", year: 1964, genres: ["crooners", "big-band"], vocations: ["engineering"] },
  { id: "my-girl", title: "My Girl", artist: "The Temptations", year: 1964, genres: ["motown"] },
  { id: "king-of-the-road", title: "King of the Road", artist: "Roger Miller", year: 1965, genres: ["country"], vocations: ["driving"] },
  { id: "green-acres", title: "Green Acres (the TV theme)", artist: "Eddie Albert and Eva Gabor", year: 1965, genres: ["broadway"], vocations: ["farming"] },
  { id: "do-re-mi", title: "Do-Re-Mi", artist: "from The Sound of Music", year: 1965, genres: ["broadway"], singalong: true },
  { id: "what-a-wonderful-world", title: "What a Wonderful World", artist: "Louis Armstrong", year: 1967, genres: ["jazz-blues"] },
  { id: "rocky-top", title: "Rocky Top", artist: "The Osborne Brothers", year: 1967, genres: ["country", "folk"], regions: ["appalachia"] },
  { id: "sweet-caroline", title: "Sweet Caroline", artist: "Neil Diamond", year: 1969, genres: ["rock-and-roll"], singalong: true },
  { id: "bridge-over-troubled-water", title: "Bridge over Troubled Water", artist: "Simon and Garfunkel", year: 1970, genres: ["folk"] },
  { id: "close-to-you", title: "(They Long to Be) Close to You", artist: "The Carpenters", year: 1970, genres: ["crooners"] },
  { id: "coat-of-many-colors", title: "Coat of Many Colors", artist: "Dolly Parton", year: 1971, genres: ["country"], regions: ["appalachia"], vocations: ["sewing"] },
  { id: "country-roads", title: "Take Me Home, Country Roads", artist: "John Denver", year: 1971, genres: ["folk", "country"], regions: ["appalachia"], avoid: ["home"], singalong: true },
  { id: "city-of-new-orleans", title: "City of New Orleans", artist: "Arlo Guthrie", year: 1972, genres: ["folk"], regions: ["south"], vocations: ["railroad"] },
  { id: "rocky-mountain-high", title: "Rocky Mountain High", artist: "John Denver", year: 1972, genres: ["folk", "country"], regions: ["mountain-west"] },
  { id: "lean-on-me", title: "Lean on Me", artist: "Bill Withers", year: 1972, genres: ["motown"] },
  { id: "pennsylvania-polka", title: "Pennsylvania Polka", artist: "The Andrews Sisters", year: 1942, genres: ["polka"], regions: ["northeast", "midwest"] },
  { id: "blue-danube", title: "The Blue Danube", artist: "Johann Strauss II", year: 0, genres: ["classical"] },
  { id: "clair-de-lune", title: "Clair de Lune", artist: "Claude Debussy", year: 0, genres: ["classical"] }
];

/* ---------- 3. Who the resident is ---------- */
interface ChoiceLike { code?: unknown; label?: unknown; }
export interface ProfileLike {
  id?: unknown;
  tier1_core?: { preferredName?: unknown; cognitiveTier?: unknown; occupation?: ChoiceLike | null; primaryVocation?: ChoiceLike | null;
    topicsToAvoid?: { topics?: ChoiceLike[] } | null; topHobbies?: ChoiceLike[] } | null;
  tier2_enrichment?: { age?: unknown; birthYear?: unknown; region?: ChoiceLike | null; hometown?: { environment?: ChoiceLike | null; place?: unknown } | null;
    music?: { genres?: ChoiceLike[]; artists?: unknown[]; favoriteSong?: unknown } | null; military?: { branch?: ChoiceLike | null; talkingAboutIt?: ChoiceLike | null } | null } | null;
}
export interface Person {
  name: string; tier: Tier; birthYear: number; birthYearKnown: boolean; bump: [number, number]; life: [number, number];
  vocation: Vocation; region: Region | null; state: string; setting: string; settingKind: string; placeLabel: string;
  avoid: Set<string>; genres: string[]; artists: string[]; favoriteSong: string; hobbies: string[]; military: "welcome" | "gentle" | "avoid" | "unknown" | "none";
}
const code = (c: ChoiceLike | null | undefined): string => c && c.code != null ? String(c.code) : "";
const clean = (v: unknown, max = 80): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
export function vocationFor(occupationCode: string): Vocation {
  return VOCATIONS.filter(v => v.occupations.indexOf(occupationCode) >= 0)[0] || VOCATIONS.filter(v => v.code === "general")[0];
}
/* The state (postal code) and region of a hometown such as "Minot, North Dakota" or "Dayton, OH". */
export function placeOf(place: string): { region: Region | null; state: string } {
  const p = " " + String(place || "").replace(/[.,;()]/g, " ").replace(/\s+/g, " ") + " ";
  let best: Region | null = null, bestLen = 0, state = "";
  for (const r of REGIONS) r.states.forEach((s, i) => {
    const hit = s.length === 2 ? new RegExp("\\s" + s + "\\s").test(p) : p.toLowerCase().indexOf(" " + s.toLowerCase() + " ") >= 0;
    if (hit && s.length > bestLen){                                    // "West Virginia" beats "Virginia"
      best = r; bestLen = s.length;
      state = r.us ? (s.length === 2 ? s : r.states[i + 1] || "") : "";
    }
  });
  return { region: best, state };
}
export const regionFromPlace = (place: string): Region | null => placeOf(place).region;
export function person(p: ProfileLike, today: Date = new Date()): Person {
  const t1 = (p && p.tier1_core) || {}, t2 = (p && p.tier2_enrichment) || {};
  const year = today.getFullYear();
  let by = Number(t2.birthYear), known = true;
  if (!(by >= 1900 && by <= year - 18)){ const age = Number(t2.age); by = age >= 18 && age <= 120 ? year - age : 1945; known = age >= 18 && age <= 120; }
  const tier = ([1, 2, 3].indexOf(Number(t1.cognitiveTier)) >= 0 ? Number(t1.cognitiveTier) : 2) as Tier;
  const pv = code(t1.primaryVocation), vocation = VOCATIONS.filter(v => v.code === pv)[0] || vocationFor(code(t1.occupation));
  const rc = code(t2.region), home = (t2.hometown || {}) as { environment?: ChoiceLike | null; place?: unknown };
  const fromPlace = placeOf(clean(home.place));
  const region = REGIONS.filter(r => r.code === rc)[0] || fromPlace.region || (code(home.environment) === "abroad" ? REGIONS.filter(r => r.code === "abroad")[0] : null);
  const state = fromPlace.region && region && fromPlace.region.code === region.code ? fromPlace.state : "";
  const set = SETTINGS[code(home.environment)] || { label: "", kind: "" };
  const mil = t2.military || {}, served = !!code(mil.branch) && ["none", "unknown"].indexOf(code(mil.branch)) < 0;
  const mt = code(mil.talkingAboutIt);
  const music = t2.music || {};
  return {
    name: clean(t1.preferredName, 40), tier, birthYear: by, birthYearKnown: known,
    bump: [by + 10, by + 30], life: [by + 5, Math.min(year, by + 60)],
    vocation, region, state, setting: set.label, settingKind: set.kind,
    placeLabel: [set.label, region && region.code !== "abroad" ? region.label : ""].filter(Boolean).join(" ") || (region ? region.label : ""),
    avoid: new Set(((t1.topicsToAvoid && t1.topicsToAvoid.topics) || []).map(code).filter(Boolean)),
    genres: (music.genres || []).map(code).filter(Boolean), artists: (music.artists || []).map(a => clean(a, 60)).filter(Boolean),
    favoriteSong: clean(music.favoriteSong, 80), hobbies: (t1.topHobbies || []).map(code).filter(Boolean),
    military: !served && vocation.code !== "military" ? "none" : mt === "welcome" || mt === "gentle" || mt === "avoid" ? mt : "unknown"
  };
}

/* ---------- 4. Choosing ---------- */
const blocked = (who: Person, avoid?: readonly string[]): boolean => !!avoid && avoid.some(a => who.avoid.has(a));
const overlaps = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] <= b[1] && b[0] <= a[1];
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T>(a: T[], r: () => number): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
function militaryOk(who: Person): boolean { return who.military === "welcome" || who.military === "gentle" || (who.military === "unknown" && who.vocation.code === "military"); }
/* Does a topic fit this resident, and how well (higher is closer to them)? */
export function fit(topic: Topic, who: Person): number {
  if (blocked(who, topic.avoid)) return 0;
  if (topic.vocations && topic.vocations.indexOf("military") >= 0 && !militaryOk(who)) return 0;
  const region = who.region ? who.region.code : "";
  let s = 0;
  if (topic.vocations && topic.vocations.indexOf(who.vocation.code) >= 0) s = Math.max(s, 100);
  if (topic.hobbies && topic.hobbies.some(h => who.hobbies.indexOf(h) >= 0)) s = Math.max(s, 70);
  if (topic.kind === "place"){
    const rMatch = !!region && !!topic.regions && topic.regions.indexOf(region) >= 0;
    const sMatch = !!who.settingKind && !!topic.settings && topic.settings.indexOf(who.settingKind) >= 0;
    const place = topic.match === "both" ? (rMatch && sMatch ? 80 : 0) : rMatch && sMatch ? 80 : rMatch ? 70 : sMatch ? 65 : 0;
    s = Math.max(s, place);
  }
  if (topic.everyone) s = Math.max(s, 40);
  return s;
}
export interface SongPick { title: string; artist: string; year: number; why: string; id: string; }
function songAge(song: Song, who: Person): string {
  if (!song.year) return "a song many people know by heart";
  const age = song.year - who.birthYear;
  if (!who.birthYearKnown) return "from " + song.year;
  if (age < 0) return "a standard from before they were born, " + song.year;
  if (age <= 12) return "a hit from their childhood, " + song.year;
  return "a hit when they were about " + age + ", " + song.year;
}
function pickSong(who: Person, topic: Topic, used: Set<string>, first: boolean, r: () => number): SongPick {
  if (first && who.favoriteSong && !used.has("fav")){
    used.add("fav");
    const key = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
    SONGS.forEach(s => { if (key(s.title) === key(who.favoriteSong)) used.add(s.id); });   // not again as a catalog pick
    return { id: "fav", title: who.favoriteSong, artist: who.artists[0] || "", year: 0, why: "their own favorite, from their profile" };
  }
  const region = who.region ? who.region.code : "";
  let best: Song | null = null, bestScore = -1;
  for (const s of SONGS){
    if (used.has(s.id) || blocked(who, s.avoid)) continue;
    if (s.vocations && s.vocations.indexOf("military") >= 0 && !militaryOk(who)) continue;
    let sc = r() * 4;
    const theirs = s.genres.some(g => who.genres.indexOf(g) >= 0);
    const elsewhere = !!s.regions && s.regions.indexOf(region) < 0 && !theirs;   // a regional song, for someone from elsewhere (unless it is their kind of music)
    if (topic.songs && topic.songs.indexOf(s.id) >= 0 && !elsewhere) sc += 30;
    if (elsewhere) sc -= 20;
    if (s.vocations && s.vocations.indexOf(who.vocation.code) >= 0) sc += 22;
    if (s.regions && s.regions.indexOf(region) >= 0) sc += 18;
    if (theirs) sc += 20;
    if (who.artists.some(a => s.artist.toLowerCase().indexOf(a.toLowerCase()) >= 0 && a.length > 3)) sc += 25;
    if (!s.year) sc += 8;
    else if (s.year >= who.bump[0] && s.year <= who.bump[1]) sc += 24;
    else if (s.year >= who.birthYear - 15 && s.year <= who.birthYear + 45) sc += 6;
    else sc -= 40;                                                   // from outside the years that mean something to them
    if (who.tier === 3 && s.singalong) sc += 14;
    if (sc > bestScore){ best = s; bestScore = sc; }
  }
  const s = best || SONGS[0];
  used.add(s.id);
  return { id: s.id, title: s.title, artist: s.artist, year: s.year, why: songAge(s, who) };
}
function refsFor(topic: Topic, who: Person, n: number, r: () => number): string[] {
  const region = who.region ? who.region.code : "", abroad = region === "abroad";
  // state references only for that state; regional ones only for that region; the rest are
  // North American, so someone raised abroad hears only those familiar everywhere
  const ok = topic.refs.filter(x => !blocked(who, x.avoid) && overlaps(x.years, who.life)
    && (x.states ? !!who.state && x.states.indexOf(who.state) >= 0 : x.regions ? x.regions.indexOf(region) >= 0 : !abroad || !!x.anywhere));
  const score = (x: Ref): number => (x.states ? 14 : x.regions ? 10 : 0) + (overlaps(x.years, who.bump) ? 6 : 0) + r();
  return ok.sort((a, b) => score(b) - score(a)).slice(0, n).map(x => x.text);
}
export interface Card {
  topic: string; title: string; kind: Topic["kind"]; art: string[]; invite: string;
  starters: [string, string, string]; song: SongPick; touch: { prompt: string; items: string; safety: string }; refs: string[];
}
/* The three starters: two from the topic, and one that names something
   from their own time and place when there is one (tiers 1 and 2). */
function startersFor(topic: Topic, who: Person, refs: string[], r: () => number): [string, string, string] {
  if (who.tier === 3){ const s = shuffle(topic.simple.filter(x => x !== topic.invite[2]), r); return [s[0], s[1], s[2]]; }
  const s = shuffle(topic.starters.slice(), r);
  const ref = refs[0];
  const third = ref ? "Tell me about " + ref + "." : s[2];
  return [s[0], s[1], third];
}
export interface DeckOptions { count?: number; theme?: "mixed" | "work" | "place" | "era" | "home"; seed?: string; today?: Date; }
export const THEMES: readonly { code: string; label: string }[] = [
  { code: "mixed", label: "A mix, closest to them first" }, { code: "work", label: "Their working life" },
  { code: "place", label: "Where they grew up" }, { code: "era", label: "Radio, television and movies" }, { code: "home", label: "Home, kitchen and pastimes" }
];
export function deck(profile: ProfileLike, options: DeckOptions = {}): { person: Person; cards: Card[] } {
  const who = person(profile, options.today), count = Math.max(1, Math.min(24, Math.round(options.count || 6))), theme = options.theme || "mixed";
  const r = rng((typeof profile.id === "string" ? profile.id : who.name) + "|" + (options.seed || "1") + "|" + theme);
  const inTheme = (t: Topic): boolean => theme === "mixed" || (theme === "work" ? t.kind === "work" : theme === "place" ? t.kind === "place" : theme === "era" ? t.kind === "era" : t.kind === "home" || t.kind === "pastime");
  const ranked = TOPICS.map(t => ({ t, s: fit(t, who) })).filter(x => x.s > 0 && inTheme(x.t)).sort((a, b) => b.s - a.s || (r() - .5));
  // one work card (theirs), then place, then era/home/pastime, then round again
  const order: Topic[] = [], left = ranked.map(x => x.t);
  const take = (pred: (t: Topic) => boolean): void => { const i = left.findIndex(pred); if (i >= 0) order.push(left.splice(i, 1)[0]); };
  while (left.length){
    const n = order.length;
    take(t => t.kind === "work"); take(t => t.kind === "place"); take(t => t.kind === "era"); take(t => t.kind === "home" || t.kind === "pastime");
    if (order.length === n) order.push(left.shift()!);
  }
  const used = new Set<string>(), cards: Card[] = [];
  for (let i = 0; i < Math.min(count, order.length); i++){            // never the same card twice
    const topic = order[i];
    const refs = refsFor(topic, who, 3, r);
    const art = topic.art.slice();
    const touch = topic.touch;
    cards.push({
      topic: topic.id, title: topic.title, kind: topic.kind, art,
      invite: topic.invite[who.tier - 1], starters: startersFor(topic, who, refs, r),
      song: pickSong(who, topic, used, i === 0, r),
      touch: { prompt: who.tier === 3 ? touch.simple : touch.prompt, items: touch.items, safety: touch.safety || SAFE },
      refs
    });
  }
  return { person: who, cards };
}

/* ---------- 5. Wording check (used by the tests; staff text can be checked too) ---------- */
const QUIZ = [/\bdo you remember\b/i, /\bremember when\b/i, /\bcan you (name|recall|tell me the name)\b/i, /\bwhat year\b/i, /\bwhat was the name of\b/i, /\bquiz\b/i, /\btest\b/i, /\bdon't you\b/i, /\bwho is this\b/i];
const ELDERSPEAK = [/\b(honey|sweetie|dearie|sweetheart|sugar|hon)\b[,!.]/i, /,\s*(honey|sweetie|dear|dearie|sweetheart|sugar|hon)\b/i, /\bgood (girl|boy)\b/i, /\bour (little )?(friend|resident)\b/i, /\bwe(?:'re| are) (going to|gonna) \w+ (our|we)\b/i, /\blittle one\b/i, /\byummy\b/i, /\bpotty\b/i];
export function toneProblems(text: string): string[] {
  const out: string[] = [];
  QUIZ.forEach(re => { if (re.test(text)) out.push("tests memory: " + re.source); });
  ELDERSPEAK.forEach(re => { if (re.test(text)) out.push("elderspeak: " + re.source); });
  return out;
}
