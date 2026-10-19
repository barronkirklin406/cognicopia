/* =====================================================================
   Cognicopia Tablet Activities: the local banks.

   Everything the word activities draw from, kept in this one file so the
   tablet never asks the internet for a puzzle:

     PACKS    thematic word-search packs (3 to 6 letter words)
     CLUES    crossword clue sets: nostalgia, everyday objects, nature, music,
              and the sayings and songs everyone knows
     SAYINGS  proverbs, hymns and folk songs to finish
     OBJECTS  things to spell, each drawn in js/tabletArt.js

   Written for adults: warm, plain, never a quiz about the past. Songs and
   hymns are traditional or in the public domain, and only a few words of
   each are used. Every word and every sentence passes the same dignity
   rules as the printed packets (scripts/check-tablet.mjs proves it).
   Pure data: it runs in the browser and in Node.
   ===================================================================== */
(function (root) {
  "use strict";
  var B = root.CognicopiaTabletBanks = {};
  var words = function (s) { return s.split(/\s+/).filter(Boolean); };

  /* ---------- word-search packs: [id, name, topics, words] ---------- */
  B.PACKS = [
    ["musicals", "1950s musicals", "music dancing movies", "ACT CUE HIT SET GIGI KATE MARIA TONY JETS SHARKS ELIZA LADY KING ANNA SIAM GUYS DOLLS MUSIC MARIAN PAJAMA WENDY PETER SING DANCE STAGE TUNE SONG CHORUS BRAVO"],
    ["kitchen", "Kitchen tools", "cooking", "WHISK LADLE GRATER PEELER TONGS SIEVE KNIFE SPOON FORK BOWL PAN POT LID MASHER TRAY MIXER TIMER SCALE PRESS KETTLE"],
    ["farm", "Farm animals", "farm-animals farming", "COW PIG HEN GOAT SHEEP HORSE MULE DUCK GOOSE TURKEY CHICK LAMB BULL CALF COLT FOAL DONKEY"],
    ["garden", "In the garden", "gardening", "ROSE SEED SOIL RAKE HOE SPADE TROWEL HOSE PLANT WEED BLOOM BULB STEM LEAF VINE POT SHEARS MULCH"],
    ["seasons", "The four seasons", "weather trees-orchards", "SPRING SUMMER AUTUMN WINTER ICE SKY SNOW RAIN LEAF BLOOM FROST BREEZE SUN WIND HEAT MIST SLEET THAW CHILL WARM COOL"],
    ["cars", "Classic cars", "cars", "CAR GAS OIL TOP FORD BUICK NASH DODGE JEEP FINS CHROME COUPE WAGON SEDAN TRUCK HORN WHEEL TIRE DRIVE ROAD HOOD TRUNK BUMPER HUDSON"],
    ["states", "States", "travel-trips", "OHIO IOWA UTAH TEXAS MAINE IDAHO ALASKA OREGON NEVADA KANSAS HAWAII DAKOTA"],
    ["comfort", "Comfort foods", "cooking", "SOUP STEW PIE TOAST BREAD CAKE PASTA RICE BEANS CHILI PIZZA GRAVY CORN HAM EGGS BACON OATS CREAM SCONE COCOA BUTTER HONEY JAM CHEESE"],
    ["birds", "Birds", "birds", "ROBIN WREN CROW OWL DOVE HAWK FINCH JAY SWAN DUCK GOOSE EAGLE LARK TERN GULL QUAIL HERON STORK CRANE"],
    ["flowers", "Flowers", "gardening", "BUD ROSE TULIP LILY DAISY IRIS PEONY ASTER PANSY POPPY LILAC ORCHID VIOLET MUM FERN CLOVER"],
    ["vegetables", "Vegetables", "gardening cooking", "PEA YAM CORN PEAS BEANS BEET KALE LEEK ONION CARROT SQUASH OKRA RADISH POTATO TURNIP CELERY PEPPER SPUD"],
    ["fruits", "Fruits", "trees-orchards cooking", "APPLE PEAR PLUM PEACH GRAPE LEMON MELON CHERRY BERRY LIME FIG DATE MANGO BANANA ORANGE KIWI PRUNE"],
    ["weather", "The weather", "weather", "RAIN SNOW WIND HAIL FOG SUN STORM CLOUD BREEZE FROST SLEET MIST SKY SHOWER SUNNY WINDY CLEAR HUMID COOL WARM"],
    ["home", "Home and hearth", "home-comforts housework", "LAMP RUG SOFA CHAIR TABLE CLOCK QUILT SHELF BED DOOR STOVE PORCH BROOM MIRROR PILLOW RADIO VASE FRAME HEARTH"],
    ["sewing", "Sewing and crafts", "sewing-crafts", "PIN BOW THREAD NEEDLE YARN KNIT QUILT BUTTON SCARF LACE FELT PATCH SEAM HEM WOOL SILK PINS SNAP ZIPPER BOBBIN SHEARS"],
    ["music", "Music and song", "music dancing", "JIG SAX BANJO FIDDLE PIANO DRUM HARP TUNE SONG WALTZ POLKA HYMN CHOIR BELL FLUTE ORGAN BUGLE BASS HORN CHORD NOTE TEMPO LYRIC OPERA"],
    ["radio", "Radio days", "radio-tv music", "AIR RADIO DIAL NEWS STATIC TUNE VOICE SHOW WAVE SPORTS MUSIC DRAMA SOUND KNOB BAND HOST SONG"],
    ["trains", "Trains and travel", "trains travel-trips", "TRAIN RAIL TRACK STEAM ENGINE TICKET TRIP BUS SHIP PLANE ROAD MAP BAG CASE DEPOT STOP GATE"],
    ["seaside", "At the seaside", "boats travel-trips", "SAND WAVE SHELL BOAT PIER SAIL TIDE SEA SHORE BEACH CRAB GULL DUNE SURF FOAM ANCHOR DOCK NET PEBBLE"],
    ["baking", "Baking day", "cooking", "FLOUR SUGAR EGGS BUTTER YEAST DOUGH OVEN PAN CAKE PIE BREAD ROLL BAKE MIX SALT CRUST ICING SPICE MILK APRON"],
    ["workshop", "The workshop", "tools-workshop", "HAMMER NAIL SAW DRILL PLANE SCREW BOLT WRENCH VISE LEVEL CLAMP TAPE RULER FILE AXE CHISEL PLIERS SANDER BENCH WOOD GLUE"],
    ["tea", "Tea time", "coffee-tea", "TEA CUP POT SPOON SUGAR LEMON MILK SAUCER TRAY HONEY CREAM SCONE JAM KETTLE TEAPOT BREW STEEP LEAF MUG"],
    ["pets", "Pets", "dogs cats", "DOG CAT FISH BIRD LEASH BONE BOWL COLLAR PAW TAIL FUR RABBIT TURTLE KITTEN PARROT BELL TOY"],
    ["pastimes", "Pastimes", "sports card-board-games children-games", "TAG ROD BALL BAT GOLF CARDS CHESS DARTS BINGO DICE BRIDGE PUZZLE RACE TENNIS BOWL PICNIC KITE HIKE GAMES SWING"],
    ["holidays", "Holidays", "celebrations", "CARD GIFT PARADE FLAG FEAST CANDLE BELL STAR PIE BOW WREATH TREE LIGHTS CAKE PARTY TOAST"],
    ["colors", "Colors", "", "RED BLUE GREEN GOLD PINK GRAY TAN ROSE TEAL PLUM AMBER IVORY BROWN WHITE BLACK CREAM PEACH LILAC SILVER ORANGE YELLOW PURPLE"],
    ["family", "Family", "photographs", "MOM DAD SON AUNT UNCLE NIECE COUSIN SISTER TWIN KIN FAMILY NEPHEW HOME LOVE WIFE"],
    ["town", "Main Street", "town-main-street", "INN BUS BANK SHOP BAKERY STORE CAFE DINER MARKET CHURCH SCHOOL PARK POST BARBER STREET CORNER SIGN MAIL FIRE HALL"],
    ["movies", "At the movies", "movies", "SET HIT FILM STAR MOVIE SCREEN TICKET SEAT DRAMA COMEDY ACTOR SCENE CAST REEL SOUND LIGHTS"],
    ["school", "School days", "school books-reading", "BOOK DESK PENCIL CHALK SLATE BELL CLASS LESSON PAPER RULER MAP GLOBE READ WRITE ERASER NOTES SPELL MATH ART"],
    ["lake", "A day at the lake", "fishing boats", "LAKE BOAT FISH DOCK OAR SAIL CANOE REEDS PIER CATCH ROD REEL BAIT NET SHORE TROUT BASS PERCH"],
    ["camping", "Camping", "picnics-camping parks", "TENT FIRE CAMP TRAIL WOODS PINE LOG STAR CANOE MAP HIKE PACK SMORES LAKE MOON"]
  ].map(function (p) { return { id: p[0], label: p[1], topics: words(p[2]), words: words(p[3]) }; });

  /* ---------- crossword clue sets: [id, title, topics, "WORD|clue", ...] ---------- */
  B.CLUES = [
    /* ---- places and times we know ---- */
    ["radio-days", "The radio years", "radio-tv music",
      "RADIO|The box the family gathered around in the evening", "DIAL|Turn it to find a station", "NEWS|Read on the air each evening", "TUNE|A melody you can hum", "STATIC|The crackle between stations", "DRAMA|A story told by voices only", "BAND|A group playing swing music", "SHOW|A program with a host and guests", "VOICE|What the announcer spoke with", "SOUND|What the speaker carries to your ear"],
    ["main-street", "Main Street", "town-main-street",
      "BANK|Where savings were kept", "STORE|A shop with a bell over the door", "DINER|A place for pie and coffee", "BARBER|Where a haircut and a shave were had", "MARKET|Where fruit and bread were bought", "PARK|A bench under the trees in town", "CHURCH|A steeple you could see from afar", "STREET|Where the parade marched", "CORNER|Where two streets meet", "MAIL|Delivered to the door each day"],
    ["soda-fountain", "The soda fountain", "diner-soda-fountain",
      "SODA|A fizzy drink poured at the counter", "STRAW|A paper tube for sipping", "FLOAT|Ice cream in a glass of root beer", "SHAKE|A thick, cold milk drink", "CHERRY|The red fruit on top of a sundae", "STOOL|A round seat at the counter", "SUNDAE|Ice cream with syrup and toppings", "CONE|A crisp holder for ice cream", "MALT|A flavor added to a milk shake"],
    ["front-porch", "The front porch", "home-comforts",
      "SWING|A seat that sways on chains", "PORCH|A covered place to sit in the evening", "RAIL|The wooden bar along the edge", "STEPS|You climb these to reach the door", "CHAIR|A rocking one is a favorite", "GLASS|Tall, filled with lemonade and ice", "SCREEN|A door that lets in air but not bugs", "MAT|Wipe your shoes on it", "BREEZE|Gentle air on a warm evening", "LAMP|Glows by the door at dusk"],
    ["movie-night", "A night at the movies", "movies",
      "FILM|A picture shown on a screen", "SCREEN|Where the picture appears", "TICKET|Paper that gets you in", "SEAT|Where you sit", "CANDY|A sweet treat from the counter", "STAR|A famous actor", "REEL|Film wound on a wheel", "LIGHTS|They dim before the show", "COMEDY|A film made to be laughed at", "ACTOR|Plays a part in a story"],
    ["county-fair", "The county fair", "county-fair",
      "FAIR|Rides, games and pies on a summer day", "RIDE|The Ferris wheel is one", "PRIZE|A ribbon for the best pie", "PIE|Baked for the judges", "CORN|Eaten from the cob at the fair", "GAME|Toss a ring to win a prize", "BARN|Where the animals are shown", "BLUE|The color of a first-prize ribbon", "TENT|Canvas shelter for a show", "CROWD|People gathered together"],
    ["school-days", "School days", "school books-reading",
      "SLATE|A small board to write on with chalk", "CHALK|A white stick for the blackboard", "DESK|Where a student sits", "BELL|Rings to start class", "BOOK|Opened to read a lesson", "PENCIL|Write with it, then sharpen it", "PAPER|Pages to write on", "READ|Look at words and understand them", "SPELL|Say the letters of a word", "LESSON|What the teacher taught"],
    ["sunday-dinner", "Sunday dinner", "cooking celebrations",
      "ROAST|Meat cooked slowly in the oven", "GRAVY|Poured over potatoes", "ROLLS|Warm bread from the basket", "PEAS|Small green vegetables from a pod", "PIE|The dessert, cut in slices", "TABLE|Where the family gathered", "PLATE|Passed around, then filled", "CARVE|Slice the roast", "GRACE|A short prayer before the meal", "SALAD|Greens in a big bowl"],
    ["celebrations", "Parties and celebrations", "celebrations",
      "CAKE|Candles go on top", "GIFT|Wrapped with a bow", "PARTY|Friends gathered to celebrate", "CARD|Sent with good wishes", "DANCE|Move to the music", "TOAST|Raise a glass and say a few words", "MUSIC|The band plays it", "CANDLE|Blown out after a wish", "FEAST|A big meal for many", "GUEST|Invited to the party"],
    ["wash-day", "Wash day", "housework",
      "SOAP|Makes the suds", "TUB|A big basin for washing", "LINE|Where sheets hang to dry", "PIN|Holds a shirt on the line", "IRON|Smooths the wrinkles with heat", "STARCH|Makes collars crisp", "BASKET|Carries the laundry", "SHEET|Spread on a bed", "TOWEL|Dries you off", "FOLD|Make a neat square of a towel"],
    ["railroads", "Railroads", "trains",
      "TRAIN|Cars pulled along a track", "RAIL|Part of the track", "STEAM|What powered the old engines", "TICKET|Paper to board", "DEPOT|Another word for a small station", "CARGO|Freight carried on the cars", "TRACK|The train runs along it", "ENGINE|Pulls the cars", "COAL|Burned to make steam", "GATE|Lowered at a crossing"],
    ["cars-roads", "Cars on the road", "cars",
      "WHEEL|Turned by the driver", "HORN|Beep, beep", "HOOD|Lifts to show the engine", "TIRE|Rubber around the wheel", "ROAD|Where you drive", "TRUNK|Holds the luggage", "FINS|Tail decorations on 1950s cars", "CHROME|Shiny metal trim", "DRIVE|Take a trip in the car", "FORD|A famous car maker", "SEDAN|A four-door car"],
    ["general-store", "The general store", "town-main-street",
      "SCALE|Weighed the flour and sugar", "JAR|Glass holder for penny candy", "CANDY|A sweet treat in a jar", "BARREL|Held pickles or crackers", "CLERK|Helped you find what you needed", "STOVE|A pot-bellied one warmed the shop", "BELL|Rang when the door opened", "FLOUR|Sold in a big cloth sack", "APRON|Worn by the shopkeeper", "SHELF|Rows held cans and boxes"],
    ["post-office", "The post office", "letters",
      "STAMP|Stuck in the corner of an envelope", "LETTER|A note sent in the mail", "MAIL|What the carrier delivers", "BOX|Where letters wait", "CARD|Sent for a birthday", "ZIP|Part of the address code", "SEAL|Close an envelope with it", "PARCEL|A wrapped package", "CLERK|Sells the stamps", "SORT|Put letters in order"],

    /* ---- everyday things ---- */
    ["old-kitchen", "The old kitchen", "cooking housework",
      "STOVE|Where the kettle sits", "KETTLE|Whistles when the water boils", "PANTRY|A small room for storing food", "OVEN|Bakes the bread", "APRON|Worn to keep clothes clean", "SPOON|Stirs the soup", "BOWL|Holds cereal or soup", "ICEBOX|Kept food cold before refrigerators", "PUMP|Brought water up from the well", "SINK|Where dishes are washed"],
    ["sewing-circle", "The sewing circle", "sewing-crafts",
      "THREAD|Pulled through the needle", "NEEDLE|Sharp and thin, with an eye", "PATCH|Mends a hole", "QUILT|A blanket stitched from squares", "YARN|Knitted into a scarf", "BUTTON|Fastens a coat", "SEAM|Where two pieces are sewn together", "WOOL|Soft fiber from a sheep", "HEM|The folded edge of a skirt", "LACE|Delicate openwork cloth", "FELT|A soft, pressed fabric"],
    ["workshop", "The workshop", "tools-workshop",
      "HAMMER|Drives in a nail", "NAIL|Pounded into wood", "SAW|Cuts a board", "DRILL|Makes a hole", "PLANE|Smooths the wood", "SCREW|Driven in with a twisting tool", "BOLT|Fastened with a nut", "LEVEL|Shows if a shelf is straight", "CLAMP|Holds two boards together", "RULER|Measures in inches", "BENCH|Where the work is done"],
    ["desk-drawer", "The desk drawer", "office-work letters",
      "PEN|Writes in ink", "PAPER|Sheets to write on", "STAMP|Pressed on an envelope", "CLIP|Holds pages together", "RULER|Draws a straight line", "TAPE|A sticky strip for wrapping", "GLUE|Holds paper together", "INK|Fills the fountain pen", "STAPLE|A bent wire that binds pages", "ERASER|Rubs out pencil marks"],
    ["bedroom", "The bedroom", "home-comforts",
      "BED|Where you sleep", "PILLOW|Rest your head on it", "QUILT|A patchwork cover", "LAMP|Glows on the nightstand", "CLOSET|Where clothes hang", "MIRROR|Shows your reflection", "RUG|A soft mat by the bed", "CLOCK|Ticks on the shelf", "SHEET|A smooth layer on the mattress", "DRAPES|Pulled closed at night", "SOCK|Warm for cold toes", "SLEEP|What a bed is for"],
    ["bathroom", "The bathroom", "grooming",
      "SOAP|Lathers up in the sink", "TOWEL|Hangs on the rack", "COMB|Smooths the hair", "BRUSH|Used on hair or teeth", "MIRROR|Hangs above the sink", "SINK|Has a faucet", "TUB|For a long, warm soak", "RAZOR|Used for shaving", "SPONGE|Soaks up water", "TOWELS|Stacked in a pile"],
    ["living-room", "The living room", "home-comforts",
      "SOFA|A long cushioned seat", "RADIO|Played the evening programs", "CLOCK|Ticks on the mantel", "LAMP|Lights a good book", "RUG|Covers the floor", "PIANO|Stood against the wall", "CHAIR|A cozy place to sit", "VASE|Holds a bouquet", "FRAME|Surrounds a photograph", "DOILY|A lace mat under a lamp"],
    ["closet", "The closet", "winter-clothes summer-clothes",
      "COAT|Worn on a cold day", "HAT|Sits on top of the head", "SCARF|Wrapped around the neck", "GLOVE|Keeps one hand warm", "BOOT|Worn in the snow", "SOCK|Pulled over the foot", "DRESS|A one-piece outfit", "SHIRT|Buttons down the front", "BELT|Holds up the trousers", "TIE|Knotted at the collar"],
    ["table-setting", "Setting the table", "cooking",
      "PLATE|Holds the dinner", "FORK|Has four tines", "KNIFE|Cuts the meat", "SPOON|For soup", "NAPKIN|Folded beside the plate", "GLASS|Filled with water", "CLOTH|Spread over the table", "SAUCER|Goes under a cup", "CANDLE|Glows in the center", "BOWL|Holds the salad", "CUP|Holds tea or coffee", "SALT|A shaker for the table", "TRAY|Carries the dishes"],
    ["garden-shed", "The garden shed", "gardening",
      "RAKE|Gathers the leaves", "HOE|Chops the weeds", "SPADE|Digs the beds", "HOSE|Carries the water", "POT|Holds a plant", "SHEARS|Trim the hedge", "CART|Wheeled across the yard", "TWINE|Ties up the beans", "SEEDS|Packets of next summer's flowers", "GLOVES|Protect the hands"],
    ["tea-time", "Tea time", "coffee-tea",
      "TEAPOT|Holds the hot tea", "CUP|Sipped from", "SAUCER|Rests beneath the cup", "SPOON|Stirs in the sugar", "TRAY|Carries the tea things", "LEMON|A slice for the tea", "SCONE|Served with jam", "KETTLE|Boils the water", "CREAM|Poured into the tea", "SUGAR|Sweetens the cup"],
    ["picnic-basket", "The picnic basket", "picnics-camping",
      "BASKET|Carries the lunch", "GRASS|Where the blanket is spread", "SHADE|A cool spot under a tree", "ANTS|Uninvited guests at the picnic", "FRUIT|Apples and grapes, packed in a bag", "CHEESE|Sliced with crackers", "NAPKIN|Wipe your hands with it", "JUG|Holds the cold drink", "TREE|Gives shade", "KITE|Flown on a breezy day"],
    ["handbag", "In the handbag", "grooming",
      "PURSE|Carries the coins", "COMB|Neatens the hair", "KEYS|Open the doors", "HANKY|A cloth for a sneeze", "GLOVES|Kept for chilly days", "LIST|Written before shopping", "CASH|Paper money", "PHOTO|A small picture of family", "MINT|A fresh little candy", "FAN|Cools you on a warm day"],
    ["summer-wear", "Summer clothes", "summer-clothes",
      "HAT|Shades the face", "SANDAL|An open shoe for warm days", "SHORTS|Short trousers for hot weather", "SHIRT|A light cotton top", "DRESS|A one-piece outfit for warm weather", "STRAW|A kind of hat for the sun", "SHADES|Dark glasses", "TOWEL|Dries you after a swim", "FAN|Moves the warm air", "SUNHAT|Wide-brimmed and light"],
    ["staying-warm", "Staying warm", "weather winter-clothes",
      "COCOA|A warm drink on a cold day", "QUILT|A cozy cover", "FIRE|Crackles on the hearth", "BOOTS|Keep feet dry in snow", "SOCKS|Woolen foot warmers", "HEATER|Warms a chilly room", "HEARTH|The floor of a fireplace", "SHAWL|Draped over the shoulders", "SLED|Slides down a snowy hill", "MITTEN|Covers the whole hand"],

    /* ---- food ---- */
    ["fruit-stand", "The fruit stand", "trees-orchards cooking",
      "APPLE|Crisp and red or green", "PEAR|Sweet and shaped like a bell", "PLUM|Purple, with a stone inside", "PEACH|Fuzzy and juicy", "GRAPE|Grows in bunches on a vine", "LEMON|Sour and yellow", "MELON|Big and round, juicy inside", "CHERRY|Small, red, with a pit", "BERRY|Tiny and sweet", "ORANGE|A round citrus fruit"],
    ["vegetable-patch", "The vegetable patch", "gardening cooking",
      "CORN|Tall stalks with golden ears", "PEAS|Round and green in a pod", "BEANS|Climb up poles", "BEET|A red root", "KALE|A leafy green", "ONION|Makes you tear up", "CARROT|An orange root", "SQUASH|A large garden gourd", "POTATO|Dug from the ground", "RADISH|A small, peppery root"],
    ["breakfast", "Breakfast", "cooking",
      "TOAST|Browned bread", "EGGS|Scrambled or fried", "BACON|Sizzles in the pan", "OATS|Cooked into porridge", "JAM|Spread on toast", "MILK|Poured over cereal", "COFFEE|A hot drink to start the day", "JUICE|Squeezed from an orange", "BUTTER|Melts on pancakes", "SYRUP|Poured on pancakes"],
    ["sweet-treats", "Sweet treats", "cooking celebrations",
      "PIE|Apple or cherry, in slices", "CAKE|Layers with frosting", "COOKIE|Baked with chocolate chips", "FUDGE|Rich chocolate candy", "ICING|Spread on cake", "TART|A small fruit pie", "CREAM|Whipped for the top", "SUGAR|Makes things sweet", "WAFER|A thin, crisp biscuit", "SYRUP|Thick and sweet"],
    ["lunch-box", "The lunch box", "lunches",
      "LUNCH|A midday meal", "BOX|Holds the lunch", "APPLE|Often packed", "MILK|A small carton", "BREAD|Sliced for a sandwich", "HAM|A sandwich filling", "CHEESE|Another filling", "NAPKIN|Folded on top", "PICKLE|A crunchy slice", "CARROT|A crunchy stick"],
    ["baking-day", "Baking day", "cooking",
      "FLOUR|Sifted for the cake", "SUGAR|Sweet and granulated", "YEAST|Makes bread rise", "DOUGH|Kneaded and left to rise", "OVEN|Heated to 350 degrees", "CRUST|The golden edge of a pie", "ICING|Spread on a cake", "BAKE|Cook in the oven", "SPICE|Cinnamon is one", "BREAD|A warm loaf", "BUTTER|Creamed with sugar"],

    /* ---- nature and seasons ---- */
    ["farm-day", "A day on the farm", "farming farm-animals",
      "BARN|A red building for hay", "HAY|Dried grass for the horses", "COW|Gives milk", "CORN|A tall crop with golden ears", "FENCE|Keeps the sheep in the field", "PLOW|Turns the soil before planting", "SILO|A tall tower for grain", "HEN|Lays the eggs", "WELL|Dug for water", "FIELD|A wide space for crops", "HORSE|Pulled the plow long ago"],
    ["songbirds", "Birds at the feeder", "birds",
      "ROBIN|A red-breasted visitor in spring", "WREN|A small brown singer", "FINCH|A little bird that loves seed", "NEST|Built from twigs", "FEEDER|Hangs in the yard with seed", "SEED|What birds peck at", "EGG|Blue, in a robin's nest", "WING|Used for flying", "DOVE|A gentle gray bird that coos", "CROW|A big black bird", "OWL|Hoots at night"],
    ["fishing-trip", "A fishing trip", "fishing boats",
      "ROD|Held in your hand to cast", "REEL|Winds in the line", "BAIT|A worm on the hook", "HOOK|Sharp and curved", "LAKE|Still water to fish in", "BOAT|Rowed out to the middle", "TROUT|A speckled fish", "CATCH|What you bring home", "DOCK|A wooden walkway into the water", "NET|Scoops up the fish", "FLOAT|A bobber that rides on the water"],
    ["weather-watch", "The weather", "weather",
      "RAIN|Drops from the clouds", "SNOW|White flakes in winter", "WIND|Moves the leaves", "HAIL|Frozen pellets from the sky", "FOG|Low cloud that hides the road", "STORM|Thunder and lightning", "CLOUD|A fluffy shape in the sky", "FROST|A white coating on the window", "BREEZE|A light wind", "SUN|It rises in the east", "SLEET|Rain mixed with ice"],
    ["four-seasons", "The four seasons", "weather trees-orchards",
      "SPRING|Flowers appear", "SUMMER|The warmest season", "AUTUMN|Leaves turn gold", "WINTER|Snow and cold", "BLOOM|Open in the spring", "LEAF|Drifts from a tree in October", "FROST|Appears on cold mornings", "WARM|Comfortable, like a sunny day", "CHILL|A cool feeling in the air", "THAW|Ice turns to water"],
    ["beach-day", "By the sea", "boats travel-trips",
      "SAND|Golden grains underfoot", "WAVE|Rolls onto the shore", "SHELL|Found on the beach", "PIER|Stretches out over the water", "SAIL|Catches the wind on a boat", "TIDE|Rises and falls", "SHORE|Where land meets sea", "GULL|A white bird that calls", "CRAB|A sideways walker", "DUNE|A hill of sand", "FOAM|White bubbles on a wave"],
    ["camp-out", "Camping", "picnics-camping parks",
      "TENT|A canvas shelter", "FIRE|Warm and crackling at night", "WOODS|Tall trees all around", "TRAIL|A path through the forest", "PACK|Carried on the back", "STAR|Twinkles above the campsite", "CANOE|Paddled across the lake", "PINE|An evergreen tree", "MAP|Shows the way", "HIKE|A long walk outdoors", "LOG|A piece of firewood"],
    ["orchard", "The orchard", "trees-orchards",
      "TREE|Tall, with branches and leaves", "APPLE|Picked in autumn", "PEAR|Another orchard fruit", "BRANCH|Holds the leaves", "LEAF|Green in summer", "ROOT|The underground part of a tree", "BARK|The rough outside of a trunk", "ACORN|A nut from an oak", "SHADE|A cool place beneath the branches", "OAK|A strong, spreading tree", "MAPLE|Its syrup is sweet"],
    ["wildflowers", "Flowers", "gardening",
      "ROSE|A thorny stem and a fragrant bloom", "TULIP|Planted as a bulb in autumn", "LILY|A trumpet-shaped flower", "DAISY|White petals around a yellow center", "IRIS|A tall flower in purple or gold", "PANSY|A velvety flower with a little face", "POPPY|A bright field flower", "LILAC|A fragrant purple spring bush", "ASTER|A star-shaped flower", "PEONY|A big, ruffled bloom"],

    /* ---- music, books and making things ---- */
    ["music-time", "Music", "music dancing",
      "PIANO|Eighty-eight keys", "DRUM|Beat it with sticks", "HARP|Plucked strings in a tall frame", "FLUTE|Blown across the top", "BANJO|A twangy, round-bodied instrument", "CHOIR|Singers who gather in rows", "HYMN|A song of praise", "WALTZ|A dance in three-four time", "POLKA|A lively dance", "TUNE|Hum it", "SONG|Words set to music"],
    ["dance-floor", "Dancing", "dancing music",
      "WALTZ|Three beats to the measure", "POLKA|A lively dance", "SWING|A lively dance of the 1940s", "JIVE|A quick, bouncy dance", "STEP|One move in a dance", "PAIR|Two partners", "FLOOR|Where couples dance", "BAND|Plays for the dancers", "TWIRL|Spin around", "DANCE|Move to the music"],
    ["books", "Books and reading", "books-reading",
      "BOOK|Pages bound together", "PAGE|One sheet in a book", "NOVEL|A long made-up story", "STORY|A tale to tell", "AUTHOR|Writes the book", "SHELF|Where books stand", "COVER|Protects the pages", "READ|Enjoy a book", "TITLE|The name on the cover", "POEM|Verses that may rhyme"],
    ["painting", "Painting and crafts", "sewing-crafts",
      "PAINT|Brushed on a canvas", "BRUSH|Holds the paint", "EASEL|Stands to hold a canvas", "CANVAS|Stretched cloth for a painting", "CLAY|Shaped by hand and fired", "PAPER|Folded or cut or painted on", "GLUE|Sticks things together", "YARN|Woven into a pattern", "SKETCH|A quick drawing", "FRAME|Surrounds the finished picture"],

    /* ---- sayings and songs everyone knows: finish the line ---- */
    ["sayings-one", "Famous sayings", "",
      "FRIEND|A dog is man's best ___", "WORM|The early bird catches the ___", "NEVER|Better late than ___", "AWAY|An apple a day keeps the doctor ___", "EARNED|A penny saved is a penny ___", "WASTE|Haste makes ___", "LEAP|Look before you ___", "WORDS|Actions speak louder than ___", "ONE|Two heads are better than ___"],
    ["sayings-two", "More famous sayings", "",
      "LINING|Every cloud has a silver ___", "BASKET|Do not put all your eggs in one ___", "HATCH|Do not count your chickens before they ___", "BROTH|Too many cooks spoil the ___", "MOSS|A rolling stone gathers no ___", "BOILS|A watched pot never ___", "POLICY|Honesty is the best ___", "WORK|Many hands make light ___", "FIRE|Where there is smoke, there is ___"],
    ["sayings-colors", "Colorful sayings", "",
      "BLUE|Once in a ___ moon", "GOLD|All that glitters is not ___", "PINK|Tickled ___", "GREEN|A gardener with a ___ thumb", "RED|Paint the town ___", "BLACK|The pot calling the kettle ___", "WHITE|A ___ lie, told kindly", "SILVER|Every cloud has a ___ lining"],
    ["sayings-animals", "Animal sayings", "farm-animals birds",
      "BEE|Busy as a ___", "FOX|Sly as a ___", "OWL|Wise as an ___", "BEAR|Hungry as a ___", "MULE|Stubborn as a ___", "LAMB|Gentle as a ___", "HORSE|Do not look a gift ___ in the mouth", "BIRD|A little ___ told me", "MOUSE|Quiet as a ___", "DOGS|Let sleeping ___ lie"],
    ["sayings-food", "Food sayings", "cooking",
      "PIE|As American as apple ___", "BEANS|Spill the ___", "BUTTER|Bread and ___", "POD|Two peas in a ___", "CAKE|A piece of ___", "PICKLE|In a ___", "EYE|The apple of my ___", "EARTH|The salt of the ___", "CROP|The cream of the ___", "SALT|Take it with a grain of ___"],
    ["sayings-weather", "Weather sayings", "weather",
      "DOGS|It is raining cats and ___", "STORM|The calm before the ___", "SUN|Make hay while the ___ shines", "SHINE|Come rain or ___", "DAY|Save it for a rainy ___", "RAIN|Right as ___", "WIND|Which way the ___ blows", "SNOW|White as ___"],
    ["sayings-time", "Sayings about time", "",
      "FUN|Time flies when you are having ___", "RISE|Early to bed and early to ___", "SHINE|Rise and ___", "CHARM|Third time is the ___", "NIGHT|Day and ___", "LATE|Better ___ than never", "NINE|A stitch in time saves ___", "YEAR|Happy New ___", "TIME|Once upon a ___"],
    ["sayings-home", "Home and heart", "home-comforts",
      "HOME|There is no place like ___", "BEST|East or west, home is ___", "HEART|Home is where the ___ is", "CASTLE|A person's home is their ___", "SWEET|Home, ___ home", "DOOR|Knock, and the ___ will open", "LIGHT|Leave the porch ___ on", "SAFE|Home is a ___ harbor"],
    ["carols", "Carols and winter songs", "celebrations music",
      "BELLS|Jingle ___", "HALLS|Deck the ___", "SNOW|Dashing through the ___", "CALM|Silent night, holy night, all is ___", "SING|Hark! The herald angels ___", "WORLD|Joy to the ___", "MANGER|Away in a ___", "NOEL|The First ___"],
    ["folk-songs", "Folk songs", "music",
      "RANGE|Home on the ___", "BALL|Take me out to the ___ game", "OCEAN|My Bonnie lies over the ___", "BOAT|Row, row, row your ___", "MOON|Shine on, harvest ___", "RULE|School days, dear golden ___", "ROSE|The yellow ___ of Texas", "SONG|Camptown ladies sing this ___"],
    ["hymns", "Hymns of comfort", "music celebrations",
      "GRACE|Amazing ___, how sweet the sound", "AGES|Rock of ___", "LIGHT|This little ___ of mine", "THEE|Nearer, my God, to ___", "VISION|Be thou my ___", "FLOW|Praise God from whom all blessings ___", "LORD|The ___ is my shepherd"],
    ["pairs", "Pairs that go together", "",
      "PEPPER|Salt and ___", "THREAD|Needle and ___", "KEY|Lock and ___", "SEEK|Hide and ___", "WATER|Soap and ___", "WHITE|Black and ___", "NIGHT|Day and ___", "ROLL|Rock and ___", "EGGS|Ham and ___", "FORK|Knife and ___"]
  ].map(function (c) {
    return { id: c[0], title: c[1], topics: words(c[2]), entries: c.slice(3).map(function (e) { var k = e.indexOf("|"); return [e.slice(0, k), e.slice(k + 1)]; }) };
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
