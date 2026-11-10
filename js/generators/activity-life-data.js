/* =====================================================================
   What the life pages are made from (window.CognicopiaLifeData).

   The pages in js/generators/activity-life.js are about one person: their work, the place they come from, the
   songs and sayings of the years they were young, the things in their kitchen. This file is what those pages
   draw on when the profile says which trade, which region and which years. It holds plain words only: no
   picture is described or drawn here (pictures are the finished drawings in the coloring library).

   Rules for anything added here:
     - true and checkable (a date, a landmark, what a tool is for); nothing invented about a place or a person
     - an adult's words: no baby talk, no praise, nothing that tests ("Tell me about", never "Can you name")
     - a song is named by title, artist and year; its words are never printed here (lyrics that are printed
       live in activity-modules.js and are held to scripts/check-public-domain.mjs)
   scripts/check-activity-life.mjs reads every entry: tone, shape, dates in range, ladders one letter a rung.
   Works in the browser and in Node. No network, no storage.
   ===================================================================== */
(function (root) {
  "use strict";
  var D = {};

  /* ---------- a trade: its tools and what each is for, two ways to sort, things to talk about ----------
     Keyed by the Studio's ten kinds of former work (activity-modules.js VOCATIONS). */
  D.TRADES = {
    farmer: { place: "the farm", worker: "farmer",
      tools: [["Plow", "turns the soil"], ["Seed drill", "plants the rows"], ["Pitchfork", "lifts the hay"], ["Milk pail", "carries the milk"], ["Combine", "brings in the grain"], ["Fence pliers", "mend the wire"]],
      talk: ["What did the first hour of a farm morning look like?", "Which season kept you busiest?", "Tell me about an animal you liked working with."] },
    teacher: { place: "the classroom", worker: "teacher",
      tools: [["Chalk", "writes on the board"], ["Grade book", "keeps the marks"], ["Hand bell", "calls the class in"], ["Pointer", "shows the place on the map"], ["Red pencil", "marks the papers"], ["Globe", "shows the whole world"]],
      talk: ["Which grade or subject did you teach?", "What did your classroom look like?", "Tell me about a lesson you enjoyed giving."] },
    nurse: { place: "the ward", worker: "nurse",
      tools: [["Thermometer", "takes a temperature"], ["Stethoscope", "listens to the heart"], ["Chart", "keeps the notes"], ["Watch with a second hand", "counts a pulse"], ["Bandage roll", "covers and protects"], ["Cap and pin", "finish the uniform"]],
      talk: ["Which shift did you like best?", "Tell me about the people you worked beside.", "What did you always carry in your pockets?"] },
    cook: { place: "the kitchen", worker: "cook",
      tools: [["Rolling pin", "rolls the dough"], ["Whisk", "beats the eggs"], ["Ladle", "serves the soup"], ["Measuring cup", "measures the flour"], ["Skillet", "fries and browns"], ["Oven mitt", "protects the hand"]],
      talk: ["What did people ask you to make again and again?", "What did the kitchen smell like on a busy day?", "Tell me about the biggest meal you ever cooked."] },
    mechanic: { place: "the garage", worker: "mechanic",
      tools: [["Wrench", "turns a bolt"], ["Jack", "lifts the car"], ["Grease gun", "oils the joints"], ["Spark plug", "fires the engine"], ["Tire iron", "changes a wheel"], ["Feeler gauge", "sets the gap"]],
      talk: ["Which engine did you like working on?", "What did the garage sound like on a busy day?", "Tell me about a repair you were proud of."] },
    secretary: { place: "the office", worker: "secretary",
      tools: [["Typewriter", "types the letters"], ["Shorthand pad", "takes dictation"], ["Filing cabinet", "keeps the papers"], ["Switchboard", "connects the calls"], ["Stapler", "fastens the pages"], ["Carbon paper", "makes a copy"]],
      talk: ["What did your desk look like?", "Who did you work for, and what were they like?", "Tell me about a busy day at the office."] },
    carpenter: { place: "the workshop", worker: "carpenter",
      tools: [["Hammer", "drives a nail"], ["Hand saw", "cuts a board"], ["Level", "shows what is true"], ["Plane", "smooths the wood"], ["Chisel", "cuts a joint"], ["Tape measure", "measures twice"]],
      talk: ["What is the best thing you ever built?", "Which wood did you like to work with?", "Tell me about the tools you kept closest."] },
    driver: { place: "the road", worker: "driver",
      tools: [["Road map", "shows the route"], ["Log book", "records the miles"], ["Tire gauge", "checks the air"], ["Two-way radio", "talks to other drivers"], ["Thermos", "keeps the coffee hot"], ["Side mirror", "shows the road behind"]],
      talk: ["Which stretch of road did you like best?", "What did you haul, and where did it go?", "Tell me about a place you always stopped."] },
    shopkeeper: { place: "the store", worker: "shopkeeper",
      tools: [["Cash register", "rings up the sale"], ["Scale", "weighs the goods"], ["Ledger", "keeps the accounts"], ["Price tags", "mark the cost"], ["Paper sacks", "carry the goods home"], ["Shop bell", "says someone has come in"]],
      talk: ["What did the store sell the most of?", "Tell me about a customer you were always glad to see.", "What did opening time look like?"] },
    seamstress: { place: "the sewing room", worker: "seamstress",
      tools: [["Thimble", "protects the finger"], ["Tape measure", "takes the size"], ["Pattern", "shows the pieces"], ["Pinking shears", "cut a neat edge"], ["Bobbin", "holds the lower thread"], ["Pin cushion", "keeps the pins"]],
      talk: ["What did you most like to sew?", "Which cloth felt best in your hands?", "Tell me about something you made for someone."] }
  };
  /* when the work is not one of the ten: any working life */
  D.WORK_TALK = ["Tell me about the work you did.", "What did a good day at work look like?", "Who taught you the job?", "What were you known for at work?"];

  /* ---------- a region: things seen there and things eaten there ----------
     Keyed by the reminiscence engine's region codes (assets/services/reminiscenceEngine.js REGIONS). Landmarks are well
     known and real; a town's own landmarks are never guessed: the page asks about the town by name. */
  D.REGIONS = {
    "midwest": { sights: ["The Great Lakes", "Red barns and silos", "Corn standing tall in July", "A county fair in August", "The Gateway Arch"], tastes: ["Sweet corn on the cob", "A fish fry on Friday", "Rhubarb pie"] },
    "plains": { sights: ["Grain elevators against the sky", "Wheat moving in the wind", "The Badlands", "Mount Rushmore", "A rodeo in summer"], tastes: ["Kuchen", "Chokecherry jelly", "A hot dish at a potluck"] },
    "northeast": { sights: ["The Statue of Liberty", "Niagara Falls", "The boardwalk at the shore", "Row houses on a city street", "The Liberty Bell"], tastes: ["A soft pretzel", "Apple cider in the fall", "A slice of cheesecake"] },
    "new-england": { sights: ["A lighthouse on the coast", "Maple trees in October", "A covered bridge", "Stone walls along the road", "A white steeple on the green"], tastes: ["Clam chowder", "Maple syrup", "Blueberry pie"] },
    "south": { sights: ["Magnolia trees in bloom", "A wide front porch", "The Mississippi River", "Spanish moss on the oaks", "Fireflies at dusk"], tastes: ["Biscuits and gravy", "Sweet tea", "Peach cobbler"] },
    "appalachia": { sights: ["The Blue Ridge Mountains", "Mist in the hollows", "The Great Smoky Mountains", "A quilt on the porch rail", "A fiddle tune on Saturday night"], tastes: ["Cornbread", "Apple butter", "Soup beans"] },
    "southwest": { sights: ["The Grand Canyon", "Saguaro cactus", "Adobe houses", "Red rock mesas", "A desert sunset"], tastes: ["Green chile", "Warm tortillas", "Pinto beans"] },
    "mountain-west": { sights: ["The Rocky Mountains", "Old Faithful at Yellowstone", "Aspen trees turning gold", "A wide sky from edge to edge", "Elk in a meadow"], tastes: ["Huckleberry pie", "Trout from the stream", "Sourdough pancakes"] },
    "pacific": { sights: ["The Golden Gate Bridge", "Redwood trees", "The Pacific at sunset", "Orange groves", "Mount Rainier"], tastes: ["Fresh salmon", "Sourdough bread", "Oranges off the tree"] },
    "canada": { sights: ["The Rockies at Banff", "Maple leaves in autumn", "Niagara Falls", "Wheat on the prairie", "A skating rink in winter"], tastes: ["Butter tarts", "Maple syrup", "Split pea soup"] }
  };
  /* when the region is not known, or is outside these: any place a person grew up */
  D.ANYWHERE = { sights: ["The main street of town", "The house you grew up in", "The school yard", "A favorite place outdoors", "The view from the kitchen window"], tastes: ["Sunday dinner", "Something from the garden", "A treat from the bakery"] };
  /* the states and provinces of each region, for a hometown written as "Scobey, Montana" (two-letter codes too) */
  D.STATES = {
    "midwest": ["Ohio", "OH", "Indiana", "IN", "Illinois", "IL", "Michigan", "MI", "Wisconsin", "WI", "Minnesota", "MN", "Iowa", "IA", "Missouri", "MO"],
    "plains": ["North Dakota", "ND", "South Dakota", "SD", "Nebraska", "NE", "Kansas", "KS", "Oklahoma", "OK"],
    "northeast": ["New York", "NY", "New Jersey", "NJ", "Pennsylvania", "PA", "Delaware", "DE", "Maryland", "MD", "District of Columbia", "DC"],
    "new-england": ["Maine", "ME", "New Hampshire", "NH", "Vermont", "VT", "Massachusetts", "MA", "Rhode Island", "RI", "Connecticut", "CT"],
    "south": ["Virginia", "VA", "North Carolina", "NC", "South Carolina", "SC", "Georgia", "GA", "Florida", "FL", "Alabama", "AL", "Mississippi", "MS", "Louisiana", "LA", "Arkansas", "AR", "Texas", "TX"],
    "appalachia": ["West Virginia", "WV", "Kentucky", "KY", "Tennessee", "TN"],
    "southwest": ["Arizona", "AZ", "New Mexico", "NM"],
    "mountain-west": ["Colorado", "CO", "Utah", "UT", "Nevada", "NV", "Wyoming", "WY", "Montana", "MT", "Idaho", "ID"],
    "pacific": ["California", "CA", "Oregon", "OR", "Washington", "WA", "Alaska", "AK", "Hawaii", "HI"],
    "canada": ["Canada", "Ontario", "Quebec", "Manitoba", "Saskatchewan", "Alberta", "British Columbia", "Nova Scotia", "New Brunswick"]
  };
  D.HOME_TALK = ["The street I lived on was", "The best thing to eat there was", "On a summer evening we would", "The neighbors I think of are", "In winter the town looked"];

  /* ---------- songs after 1972, by title, artist and year (the reminiscence engine's list ends there) ---------- */
  D.SONGS = [
    { title: "Tie a Yellow Ribbon Round the Ole Oak Tree", artist: "Tony Orlando and Dawn", year: 1973 },
    { title: "Top of the World", artist: "The Carpenters", year: 1973 },
    { title: "Annie's Song", artist: "John Denver", year: 1974 },
    { title: "Rhinestone Cowboy", artist: "Glen Campbell", year: 1975 },
    { title: "Dancing Queen", artist: "ABBA", year: 1976 },
    { title: "You Light Up My Life", artist: "Debby Boone", year: 1977 },
    { title: "The Gambler", artist: "Kenny Rogers", year: 1978 },
    { title: "9 to 5", artist: "Dolly Parton", year: 1980 },
    { title: "On the Road Again", artist: "Willie Nelson", year: 1980 },
    { title: "Islands in the Stream", artist: "Kenny Rogers and Dolly Parton", year: 1983 },
    { title: "Girls Just Want to Have Fun", artist: "Cyndi Lauper", year: 1983 },
    { title: "I Just Called to Say I Love You", artist: "Stevie Wonder", year: 1984 },
    { title: "Forever and Ever, Amen", artist: "Randy Travis", year: 1987 },
    { title: "Don't Worry, Be Happy", artist: "Bobby McFerrin", year: 1988 }
  ];

  /* ---------- sayings of the day, by the decade a person turned twenty: [the saying, what it meant] ---------- */
  D.SAYINGS = {
    1940: [["Swell", "very good"], ["Gee whiz", "what a surprise"], ["In the groove", "doing it just right"], ["Take a powder", "leave in a hurry"], ["Cooking with gas", "getting it right"], ["What's buzzin', cousin?", "what is new?"]],
    1950: [["Cool", "very good"], ["Daddy-o", "friend"], ["See you later, alligator", "goodbye"], ["Made in the shade", "everything is fine"], ["Peachy keen", "just right"], ["Cruising", "driving around for fun"]],
    1960: [["Groovy", "very good"], ["Far out", "amazing"], ["Outta sight", "wonderful"], ["A gas", "great fun"], ["Hang loose", "relax"], ["Dig it", "understand and like it"]],
    1970: [["Right on", "I agree"], ["Keep on truckin'", "keep going"], ["10-4, good buddy", "message received"], ["Boogie", "dance"], ["Catch you on the flip side", "see you later"], ["Dynamite", "excellent"]],
    1980: [["Awesome", "wonderful"], ["Totally", "completely"], ["Rad", "excellent"], ["Chill out", "relax"], ["Couch potato", "someone who loves the sofa"], ["Where's the beef?", "where is the good part?"]]
  };

  /* ---------- then and now: [the old thing, what does its job today, a library drawing of the old thing if there is one] ---------- */
  D.THEN_NOW = [
    ["Rotary telephone", "Cell phone", "rotary_telephone"], ["Typewriter", "Computer keyboard", "typewriter"], ["Cathedral radio", "Music on a phone", "cathedral_radio"],
    ["Oil lantern", "Flashlight", "oil_lantern"], ["Steam locomotive", "Diesel train", "steam_locomotive"], ["Jukebox", "A playlist", "jukebox"], ["Biplane", "Jet airliner", "biplane"],
    ["Icebox", "Refrigerator", ""], ["Washboard", "Washing machine", ""], ["Clothesline", "Clothes dryer", ""], ["Road map", "Directions from a phone", ""], ["Encyclopedia set", "Looking it up online", ""],
    ["Film camera", "Phone camera", ""], ["Percolator", "Drip coffee maker", ""], ["Telegram", "Text message", ""], ["Carbon paper", "Copy machine", ""], ["Slide rule", "Pocket calculator", ""],
    ["Party line", "A phone line of your own", ""], ["Milk bottles at the door", "A carton from the store", ""], ["Card catalog", "The library's computer", ""], ["Egg beater", "Electric mixer", ""],
    ["Drive-in movie", "Movies at home", ""], ["Rabbit-ear antenna", "Cable television", ""], ["Mail-order catalog", "Shopping online", ""]
  ];
  D.THEN_TALK = ["Something I still like the old way is", "Something that is easier now is", "The first one of these we owned was"];

  /* ---------- a day, morning and evening ---------- */
  D.DAY = {
    morning: { title: "My morning", pic: "teacup", steps: ["Open the curtains", "Wash my face", "Brush my teeth", "Get dressed", "Sit down to breakfast", "Look at the day ahead"] },
    evening: { title: "My evening", pic: "oil_lantern", steps: ["Sit down to supper", "Change into night clothes", "Wash up", "Brush my teeth", "Set out tomorrow's clothes", "Lights low, and rest"] }
  };
  D.DAY_CHOICES = { morning: ["Coffee", "Tea", "Juice", "Water"], evening: ["Some music", "A little reading", "A quiet talk", "Straight to rest"] };

  /* ---------- dishes: what goes in and how it is made; regions say where a dish is most at home ---------- */
  D.DISHES = [
    { name: "Apple pie", regions: [], ingredients: ["Apples", "Sugar", "Cinnamon", "Butter", "Pie crust"], steps: ["Peel and slice the apples", "Stir in the sugar and cinnamon", "Fill the crust and dot with butter", "Bake until golden"] },
    { name: "Buttermilk biscuits", regions: ["south", "appalachia"], ingredients: ["Flour", "Baking powder", "Butter", "Buttermilk", "Salt"], steps: ["Cut the butter into the flour", "Stir in the buttermilk", "Pat out and cut the rounds", "Bake until tall and golden"] },
    { name: "Chicken soup", regions: [], ingredients: ["Chicken", "Carrots", "Celery", "Onion", "Noodles"], steps: ["Simmer the chicken", "Add the vegetables", "Add the noodles", "Season and serve hot"] },
    { name: "Pot roast", regions: [], ingredients: ["Beef roast", "Potatoes", "Carrots", "Onion", "Broth"], steps: ["Brown the roast", "Add the vegetables and broth", "Cover and cook slowly", "Serve with the gravy"] },
    { name: "Cornbread", regions: ["south", "appalachia", "southwest"], ingredients: ["Cornmeal", "Flour", "Egg", "Milk", "Butter"], steps: ["Mix the dry things", "Stir in the egg and milk", "Pour into a hot skillet", "Bake until golden"] },
    { name: "A loaf of bread", regions: [], ingredients: ["Flour", "Yeast", "Water", "Salt", "A little sugar"], steps: ["Mix and knead the dough", "Let it rise", "Shape the loaves", "Bake until it sounds hollow"] },
    { name: "Sugar cookies", regions: [], ingredients: ["Butter", "Sugar", "Egg", "Flour", "Vanilla"], steps: ["Cream the butter and sugar", "Add the egg and flour", "Roll and cut the shapes", "Bake until the edges turn gold"] },
    { name: "Hot dish", regions: ["plains", "midwest"], ingredients: ["Ground beef", "Onion", "Cream soup", "Vegetables", "Potatoes on top"], steps: ["Brown the beef and onion", "Stir in the soup and vegetables", "Top with the potatoes", "Bake until bubbling"] },
    { name: "Clam chowder", regions: ["new-england"], ingredients: ["Clams", "Potatoes", "Onion", "Milk", "Butter"], steps: ["Cook the onion in butter", "Add the potatoes and simmer", "Stir in the clams and milk", "Serve with crackers"] },
    { name: "A pot of chili", regions: ["southwest", "plains"], ingredients: ["Beef", "Beans", "Tomatoes", "Onion", "Chili powder"], steps: ["Brown the beef and onion", "Add the tomatoes and beans", "Stir in the chili powder", "Simmer low and slow"] },
    { name: "Peach cobbler", regions: ["south"], ingredients: ["Peaches", "Sugar", "Flour", "Milk", "Butter"], steps: ["Melt the butter in the dish", "Pour in the batter", "Spoon the peaches on top", "Bake until golden"] },
    { name: "Pancakes", regions: ["mountain-west", "pacific"], ingredients: ["Flour", "Egg", "Milk", "Baking powder", "Butter"], steps: ["Stir the batter", "Heat the griddle", "Pour and wait for bubbles", "Flip and stack"] },
    { name: "Potato salad", regions: [], ingredients: ["Potatoes", "Eggs", "Celery", "Onion", "Dressing"], steps: ["Boil the potatoes and eggs", "Chop everything", "Fold in the dressing", "Chill before serving"] },
    { name: "Meatloaf", regions: [], ingredients: ["Ground beef", "Bread crumbs", "Egg", "Onion", "Ketchup"], steps: ["Mix it all by hand", "Shape the loaf", "Spread ketchup on top", "Bake, then let it rest"] }
  ];
  D.DISH_TALK = ["I made it for", "The secret to it was", "It was on the table whenever"];

  /* ---------- comforts: what a person might like right now, a few to a page ---------- */
  D.COMFORTS = [
    { label: "Something to drink", options: ["Warm tea", "Coffee", "Cold water", "Lemonade"] },
    { label: "Something to hear", options: ["Some music", "The radio", "Birdsong", "Quiet"] },
    { label: "Somewhere to be", options: ["By the window", "Outside", "In my chair", "With company"] },
    { label: "Something to hold", options: ["A soft blanket", "A warm hand", "A photograph", "A warm cup"] },
    { label: "Something to do", options: ["A short walk", "Looking at pictures", "Folding towels", "A rest"] }
  ];

  /* ---------- word play ---------- */
  /* two words that make one */
  D.COMPOUNDS = [["sun", "flower"], ["rain", "coat"], ["door", "bell"], ["tea", "pot"], ["book", "shelf"], ["rail", "road"], ["pan", "cake"], ["back", "yard"], ["straw", "berry"], ["blue", "bird"],
    ["cup", "cake"], ["farm", "house"], ["butter", "milk"], ["foot", "ball"], ["mail", "box"], ["table", "cloth"], ["wind", "mill"], ["pop", "corn"], ["wheel", "barrow"], ["home", "town"],
    ["note", "book"], ["day", "light"], ["moon", "light"], ["hay", "stack"], ["tooth", "brush"], ["sea", "shell"], ["grape", "fruit"], ["snow", "flake"], ["school", "house"], ["news", "paper"],
    ["sun", "rise"], ["bed", "spread"], ["pocket", "book"], ["black", "berry"], ["over", "coat"], ["hand", "shake"]];
  /* a story with gaps: words are chosen first (each by its kind), then the story is read with them in. "ask" may name a
     part of the person's life to offer as an idea: person, place, song or pet. */
  D.STORIES = [
    { title: "A fine day out", blanks: [["A season", ""], ["Something to wear", ""], ["A place", "place"], ["A person", "person"], ["Something from the kitchen", ""]],
      text: "One fine (1) morning I put on my (2) and set out for (3). On the way I met (4), who was carrying (5). We laughed all the way home." },
    { title: "Supper at our house", blanks: [["A main dish", ""], ["A vegetable", ""], ["A person", "person"], ["A song", "song"], ["A game", ""]],
      text: "For supper we had (1) with a side of (2). (3) said it was the best ever. Afterwards we put on (4) and played (5) until late." },
    { title: "The road trip", blanks: [["A kind of car", ""], ["A town or a state", "place"], ["A song", "song"], ["Something to eat", ""], ["A time of day", ""]],
      text: "We packed the (1) and drove to (2). The radio played (3). We stopped for (4) and were home again by (5)." },
    { title: "My garden", blanks: [["A flower", ""], ["A vegetable", ""], ["A bird or an animal", "pet"], ["A month", ""], ["A neighbor or a friend", "person"]],
      text: "This year I planted (1) and (2). A (3) kept visiting. By (4) there was enough to share with (5)." }
  ];
  /* word ladders: change one letter on each rung. [word, a plain clue]; the first word is given. tags say whose ladder it
     is (a pastime, a trade), so a gardener's ladder can end on ROSE. */
  D.LADDERS = [
    { tags: ["farm", "farmer", "farming", "ranch"], rungs: [["FORD", ""], ["FORT", "A place with strong walls"], ["FORM", "A paper to fill in"], ["FARM", "Fields, a barn and animals"]] },
    { tags: ["bake", "baking", "cook", "cooking"], rungs: [["LIME", ""], ["LIKE", "To be fond of"], ["LAKE", "Water with a shore all round"], ["BAKE", "What an oven does"]] },
    { tags: ["fish", "fishing"], rungs: [["CASH", ""], ["WASH", "Done with soap and water"], ["WISH", "Made on a star"], ["FISH", "It swims"]] },
    { tags: ["sing", "singing", "choir", "music"], rungs: [["FIND", ""], ["KIND", "Gentle and good"], ["KING", "He wears a crown"], ["SING", "What a choir does"]] },
    { tags: ["home", "family"], rungs: [["ROSE", ""], ["ROPE", "Used to tie things"], ["HOPE", "A good feeling about tomorrow"], ["HOME", "Where the heart is"]] },
    { tags: ["bird", "birds", "birdwatching"], rungs: [["WAND", ""], ["WIND", "It moves the leaves"], ["BIND", "To tie together"], ["BIRD", "It sings in the morning"]] },
    { tags: ["book", "books", "reading", "teacher", "library"], rungs: [["TOOL", ""], ["COOL", "A little cold"], ["COOK", "To make a meal"], ["BOOK", "Pages between two covers"]] },
    { tags: ["golf"], rungs: [["TOLD", ""], ["COLD", "Not warm"], ["GOLD", "A shiny yellow metal"], ["GOLF", "Played with clubs on a green"]] },
    { tags: ["rose", "roses", "garden", "gardening", "flowers"], rungs: [["NINE", ""], ["NONE", "Not any"], ["NOSE", "It smells the flowers"], ["ROSE", "A flower with thorns"]] },
    { tags: ["barn", "horses", "farmer"], rungs: [["CORD", ""], ["CORN", "It grows on a cob"], ["BORN", "How a life begins"], ["BARN", "Where the hay is kept"]] },
    { tags: ["song", "songs", "music", "dancing"], rungs: [["LINE", ""], ["LONE", "All by itself"], ["LONG", "Not short"], ["SONG", "Something to sing"]] },
    { tags: ["town", "travel"], rungs: [["LAWN", ""], ["DAWN", "The first light of day"], ["DOWN", "The opposite of up"], ["TOWN", "Smaller than a city"]] },
    { tags: ["work", "secretary", "shopkeeper"], rungs: [["CARD", ""], ["CORD", "A strong string"], ["WORD", "Letters that mean something"], ["WORK", "What a job is"]] },
    { tags: ["boat", "boating", "sailing"], rungs: [["COOL", ""], ["COAL", "Black rock that burns"], ["COAT", "Worn in the cold"], ["BOAT", "It floats"]] },
    { tags: ["cake", "baking"], rungs: [["BIKE", ""], ["LIKE", "To be fond of"], ["LAKE", "Water with a shore all round"], ["CAKE", "Served on a birthday"]] },
    { tags: ["game", "games", "cards", "bingo"], rungs: [["SALT", ""], ["SALE", "When prices come down"], ["SAME", "Not different"], ["GAME", "Played for fun"]] },
    { tags: [], rungs: [["COLD", ""], ["CORD", "A strong string"], ["CARD", "Sent on a birthday"], ["WARD", "A part of a town"], ["WARM", "Not cold"]] }
  ];

  /* ---------- sentence openings for a life story ---------- */
  D.LIFE_TALK = ["A year I like to think about is", "Something I am proud of is", "A place I was happy was", "Someone who helped me along was", "The work I liked best was", "A day I would live again is"];
  /* the chapters of any life, for a page whose owner has no dates on file yet */
  D.LIFE_CHAPTERS = ["Where I was born", "Where I went to school", "My first job", "A home of my own", "Where I live now"];
  D.FAMILY_TALK = ["Someone I would like to tell you about is", "The one who makes me laugh is", "We always got together for", "A name that runs in the family is"];
  D.WHO_TALK = ["Someone who visits me is", "Someone I like to hear from is", "Someone I think of often is"];

  root.CognicopiaLifeData = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
