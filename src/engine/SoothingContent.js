/* =====================================================================
   Cognicopia Soothing Content: what the Instant Soothe packets are made of.

   PROMPTS    130 reminiscence invitations drawn from 1901 to 1989: a washboard,
              a party-line telephone, a transistor radio, the first microwave.
              Each one invites talk; none asks anyone to prove anything, and
              nothing is scored. Each has a short "cue" (the one thing printed
              large on a late-stage page), the senses it touches, and, for about
              a third of them, a plain historical fact for the early stage.
   PUZZLES    42 calm puzzles: word searches on a gentle theme, sets of words to
              circle if you like them (no right or wrong), and familiar pairs.
   GROUNDING  quiet lines for the breath and the body.
   TIPS       what the person sitting beside the resident can do, in two lines.

   Every string a resident can read passes the adult-dignity filter in
   ClinicalMatrix.js and the engine's own safety rules (no quizzing, no scoring,
   no baby talk, no war or loss); scripts/check-soothing.mjs lints all of it.
   The dates are the years a thing was common, not the years it began, except
   where a fact says when it began.

   Runs in the browser (window.CognicopiaSoothingContent) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";

  /* the three themes the caregiver picks from, and the mix */
  var THEMES = {
    nature: { id: "nature", code: "n", label: "Calming Nature & Gardens" },
    heritage: { id: "heritage", code: "h", label: "Classic Home & Heritage (1940s–1970s)", eras: [1940, 1979] },
    music: { id: "music", code: "m", label: "Music, Crafts & Nostalgia" },
    mix: { id: "mix", code: "", label: "Random / Surprise Mix" }
  };
  var CODE_OF = { nature: "n", heritage: "h", music: "m" };

  /* P(id, from, to, themes, title, cue, text, fact, tags, senses) */
  var split = function (s) { return s ? String(s).split(",") : []; };
  function P(id, from, to, themes, title, cue, text, fact, tags, senses) {
    return Object.freeze({ id: id, era: [from, to], themes: themes.split(""), title: title, cue: cue, text: text, fact: fact || "", tags: split(tags), senses: split(senses) });
  }

  var PROMPTS = [
    /* ---- the first decades: what parents and grandparents lived ---- */
    P("r001", 1901, 1929, "h", "Washday Monday", "Clean sheets", "Talk about washday: the big tubs, the washboard, and the smell of clean sheets drying on the line.", "", "laundry,home", "smell,touch"),
    P("r002", 1901, 1939, "h", "The Icebox", "Block of ice", "Picture the iceman arriving with a heavy block of ice for the icebox, and the cool air when the door opened.", "Electric refrigerators began to replace iceboxes in many homes in the 1930s and 1940s.", "kitchen,home", "touch,sound"),
    P("r003", 1901, 1949, "nh", "Lamplight Evenings", "Lamplight", "Think about evenings by lamplight: the warm glow on the table and the quiet after supper.", "", "home,evening", "sight"),
    P("r004", 1901, 1939, "h", "The Wood Cookstove", "Cookstove", "Talk about the wood cookstove: kindling in the morning, a warm kitchen and bread baking.", "", "kitchen,home", "smell,touch"),
    P("r005", 1901, 1949, "nh", "The Garden Patch", "Garden rows", "Describe a vegetable garden in summer: the straight rows, the rich soil and the first tomatoes of the season.", "", "garden,farm", "smell,taste,sight"),
    P("r006", 1901, 1959, "hm", "Sunday Best", "Sunday best", "Talk about getting dressed in your Sunday best: the polished shoes, the pressed collar and the hat.", "", "clothes,church", "sight,touch"),
    P("r007", 1901, 1939, "n", "Harvest Time", "Harvest", "Picture harvest time: golden fields, the sound of machines in the distance and a big meal for the whole crew.", "", "farm,harvest", "sound,taste,sight"),
    P("r008", 1901, 1959, "hm", "The Front Porch", "Front porch", "Think about a summer evening on the front porch: the creak of the swing and neighbors waving by.", "", "porch,neighbors", "sound,sight"),
    P("r009", 1905, 1969, "h", "The Party Line", "Telephone", "Talk about the party-line telephone: a special ring that meant the call was for your house.", "Party lines let several households share one telephone line, each with its own ring.", "telephone,neighbors", "sound"),
    P("r010", 1901, 1929, "h", "The General Store", "General store", "Picture the general store: the barrels, the jars of candy and the smell of coffee and leather.", "", "shop,town", "smell,sight"),
    P("r011", 1901, 1939, "h", "A Walk to School", "Lunch pail", "Talk about walking to a one-room schoolhouse on a cold morning, with a lunch pail swinging at your side.", "", "school,walking", "touch,sight"),
    P("r012", 1901, 1949, "m", "The Piano in the Parlor", "Piano", "Think about a piano in the parlor, the family gathered around it and songs everyone knew by heart.", "", "piano,family", "sound"),
    P("r013", 1906, 1929, "m", "The Phonograph", "Victrola", "Picture a wind-up phonograph: the crank, the heavy record and the first crackle before the music began.", "Records for wind-up phonographs turned at about 78 times a minute.", "records,music", "sound,touch"),
    P("r014", 1901, 1939, "hm", "Sewing by Hand", "Needle and thread", "Talk about mending and sewing by hand with a thimble, a spool of thread and a quiet afternoon.", "", "sewing,crafts", "touch"),
    P("r015", 1901, 1949, "hm", "The Quilting Bee", "Quilt", "Think about women gathered around a quilting frame, stitching together and trading stories.", "", "quilt,crafts", "touch,sound"),
    P("r016", 1908, 1935, "h", "The Model T", "Model T", "Picture the Model T Ford: the crank, the black paint and the first family drive.", "The Model T went on sale in 1908 and was built until 1927.", "car,travel", "sight,sound"),
    P("r017", 1910, 1939, "hm", "The Ice Cream Social", "Ice cream social", "Talk about an ice cream social on the church lawn: hand-cranked freezers, long tables and lemonade.", "", "church,summer", "taste,sound"),
    P("r018", 1915, 1929, "m", "The Picture Show", "Picture show", "Think about the picture show with its piano music and the flicker of a silent film.", "Movies began to talk in 1927.", "movies,town", "sound,sight"),
    P("r019", 1920, 1939, "hm", "The First Radio", "Radio set", "Think about the first radio in the house: the glowing dial and the family gathered close to hear a program.", "Regular commercial radio broadcasts in the United States began in 1920.", "radio,family", "sound,sight"),
    P("r020", 1920, 1949, "m", "Dance Hall Nights", "Dance hall", "Talk about dance hall evenings: the live band, the waltz and the shining floor.", "", "dance,music", "sound,sight"),
    P("r021", 1920, 1949, "nh", "The County Fair", "County fair", "Picture the county fair: the pie contest, the prize quilts, the smell of popcorn and the lights of the Ferris wheel.", "", "fair,summer", "smell,sight,taste"),
    P("r022", 1920, 1959, "h", "The Milkman", "Milk bottles", "Think about milk bottles on the porch in the early morning, with the cream rising at the top.", "", "kitchen,morning", "sight,taste"),
    P("r023", 1920, 1959, "h", "Saturday in Town", "Saturday in town", "Talk about Saturday night in town: the shops open late, neighbors visiting and a treat for the ride home.", "", "town,shop", "sound,taste"),
    P("r024", 1920, 1939, "m", "The Charleston", "The Charleston", "Think about the Charleston and the lively dance steps people showed off at parties.", "The Charleston became a national dance craze in the mid-1920s.", "dance,music", "sound"),
    P("r025", 1925, 1950, "m", "Saturday Night Barn Dance", "Barn dance", "Picture a radio barn dance on Saturday night, with fiddles, laughter and boots on the floor.", "A Nashville radio barn dance that began in 1925 later became the Grand Ole Opry.", "radio,dance", "sound"),
    P("r026", 1910, 1939, "h", "Airplanes Overhead", "Airplane", "Talk about the excitement of the first airplanes overhead, and how everyone came outside to watch.", "The Wright brothers made their first powered flight in December 1903.", "travel,sky", "sight,sound"),
    P("r027", 1901, 1959, "n", "Wildflowers in the Meadow", "Wildflowers", "Describe a meadow full of wildflowers in June and the hum of the bees nearby.", "", "flowers,meadow", "sight,sound,smell"),
    P("r028", 1930, 1959, "h", "Making Things Last", "Patched and mended", "Talk about making things last: patching a knee, saving string and turning feed sacks into shirts.", "", "sewing,home", "touch"),
    P("r029", 1930, 1949, "hm", "The Family Radio Hour", "Evening radio", "Think about the family radio in the evening: favorite programs and everyone quiet to listen.", "By 1940, more than 80 percent of American homes had a radio.", "radio,family", "sound"),
    P("r030", 1930, 1959, "h", "Fresh Bread", "Fresh bread", "Talk about the smell of fresh bread and the first store-bought sliced loaves.", "Sliced bread was first sold in the late 1920s and was common by the 1930s.", "kitchen,bread", "smell,taste"),
    P("r031", 1930, 1955, "hm", "The Movie House", "Movie house", "Picture the movie house on Saturday: the velvet seats, the popcorn and the big screen glowing.", "Movies began to talk in 1927, and by the 1930s the talkies filled the theaters.", "movies,town", "sight,taste"),
    P("r032", 1933, 1969, "h", "The Drive-In Theater", "Drive-in", "Think about a summer night at the drive-in: the speaker on the window and the big screen under the stars.", "The first drive-in theater opened in New Jersey in 1933.", "movies,summer", "sight,sound"),
    P("r033", 1935, 1969, "h", "Board Game Night", "Board game", "Talk about a family board game on a winter night, with the dice, the snacks and the laughter.", "Monopoly went on sale in 1935.", "games,family", "sound,taste"),
    P("r034", 1930, 1969, "hn", "Canning Season", "Jars of peaches", "Picture canning season: steamy kitchens, rows of jars cooling on the counter and the lids popping one by one.", "", "kitchen,garden", "smell,sound"),
    P("r035", 1930, 1959, "h", "The Mail-Order Catalog", "Catalog", "Think about the big mail-order catalog: circling favorites at the kitchen table and waiting for the package to arrive.", "The Sears catalog sold nearly everything, even kits to build a whole house.", "home,shop", "sight"),
    P("r036", 1930, 1969, "hn", "A Family Road Trip", "Road trip", "Think about a family road trip: maps unfolded on the dashboard, roadside stands and the radio playing.", "U.S. Route 66 was established in 1926.", "travel,car", "sight,sound"),
    P("r037", 1935, 1949, "m", "Big Band on the Radio", "Big band", "Talk about big band music on the radio: the swing of the horns and dancing in the kitchen.", "Big band swing was at its height in the late 1930s and the 1940s.", "radio,dance", "sound"),
    P("r038", 1920, 1969, "h", "Sunday Dinner", "Sunday dinner", "Picture Sunday dinner: the good dishes, a roast in the oven and everyone around one long table.", "", "family,kitchen", "smell,taste,sight"),
    P("r039", 1901, 1989, "n", "A Winter Walk", "Fresh snow", "Picture a winter walk after fresh snow: quiet air, bright cold and footprints on the path.", "", "winter,walking", "sound,sight,touch"),
    /* ---- the forties and fifties ---- */
    P("r040", 1920, 1969, "n", "The Skating Pond", "Skating pond", "Picture the frozen pond: skates laced tight, cold cheeks and hot cocoa waiting at home.", "", "winter,pond", "touch,taste"),
    P("r041", 1940, 1969, "hm", "Tupperware Parties", "Tupperware", "Talk about a Tupperware party in the living room, new containers passed around and neighbors chatting.", "Tupperware parties became popular in the late 1940s and 1950s.", "kitchen,neighbors", "sound,touch"),
    P("r042", 1940, 1969, "hm", "The Soda Fountain", "Soda fountain", "Think about the soda fountain: the jukebox, the stools that spun and a milkshake in a tall glass.", "", "town,music", "taste,sound"),
    P("r043", 1946, 1960, "h", "Instant Photographs", "Instant photo", "Talk about a camera that made a picture in minutes, and a photograph you could hold while it developed.", "Instant cameras went on sale in 1948.", "photos,home", "sight,touch"),
    P("r044", 1948, 1969, "m", "The Long-Playing Record", "LP record", "Picture a long-playing record: sliding it from its sleeve, the needle dropping and a whole side of songs.", "The long-playing record was introduced in 1948.", "records,music", "sound,touch"),
    P("r045", 1920, 1969, "hn", "The Sunday Drive", "Sunday drive", "Think about a Sunday drive: windows down, farms rolling by and a stop for ice cream.", "", "car,family", "sight,taste"),
    P("r046", 1940, 1959, "m", "Swing Dancing", "Swing dance", "Picture swing dancing: the spinning, the laughter and shoes polished for the dance.", "The Lindy Hop, a famous swing dance, began in Harlem in the late 1920s.", "dance,music", "sound,sight"),
    P("r047", 1901, 1969, "h", "The Five-and-Dime", "Five-and-dime", "Talk about the five-and-dime: wooden floors, a lunch counter and little treasures for a nickel.", "", "shop,town", "sight,smell"),
    P("r048", 1945, 1969, "h", "A New Washing Machine", "Washing machine", "Think about the day a washing machine arrived and washday got easier.", "Automatic washing machines became common in American homes in the late 1940s and 1950s.", "home,laundry", "sound"),
    P("r049", 1950, 1969, "h", "The First Television", "Television set", "Picture the first television in the neighborhood: a small round screen, rabbit-ear antennas and neighbors gathered to watch.", "By 1960, close to 90 percent of American homes had a television.", "television,neighbors", "sight,sound"),
    P("r050", 1951, 1959, "h", "Monday Night Comedy", "Comedy show", "Think about a favorite television comedy in the 1950s and the whole family laughing together.", "I Love Lucy first aired in 1951.", "television,family", "sound"),
    P("r051", 1950, 1969, "h", "TV Dinners", "TV dinner", "Talk about the first TV dinners: the little foil tray with its compartments, eaten in front of the television.", "Frozen TV dinners were introduced in the early 1950s.", "kitchen,television", "taste,sight"),
    P("r052", 1954, 1969, "m", "The Transistor Radio", "Transistor radio", "Picture a small transistor radio carried to the park or the beach, favorite songs coming from one little speaker.", "The first pocket transistor radio went on sale in 1954.", "radio,music", "sound"),
    P("r053", 1956, 1969, "m", "Rock and Roll Arrives", "Rock and roll", "Talk about rock and roll arriving on the radio and in the living room, and the dancing that followed.", "Elvis Presley appeared on The Ed Sullivan Show in 1956.", "music,dance", "sound"),
    P("r054", 1950, 1969, "h", "Tail Fins and Chrome", "Tail fins", "Picture a shiny car with tail fins parked at the curb, the chrome gleaming in the sun.", "Tail fins on American cars were most popular in the late 1950s.", "car,town", "sight"),
    P("r055", 1950, 1969, "h", "Dressing Up for a Dance", "Swirling skirt", "Think about dressing up for a Saturday night: a swirling skirt or a pressed suit and polished shoes.", "", "clothes,dance", "sight,touch"),
    P("r056", 1950, 1969, "h", "The Station Wagon", "Station wagon", "Talk about a family vacation in the station wagon: suitcases on top, maps on the dash and a motel with a pool.", "The station wagon was the family car of the 1950s and 1960s.", "car,travel", "sight"),
    P("r057", 1950, 1979, "hm", "The Hi-Fi Record Player", "Record player", "Picture the record player in the living room: a stack of records, a favorite song and the soft crackle before it starts.", "The long-playing record, introduced in 1948, held far more music than the older kind.", "records,home", "sound"),
    P("r058", 1950, 1969, "hm", "The Roadside Diner", "Diner", "Think about a roadside diner: the chrome counter, a slice of pie and the jukebox in the corner.", "", "town,travel", "taste,sound"),
    P("r059", 1930, 1979, "hm", "Polka Night", "Polka band", "Picture a polka band at the hall: accordions, quick feet and dancers going round the floor.", "", "dance,music", "sound,sight"),
    P("r060", 1950, 1979, "h", "League Bowling Night", "Bowling league", "Talk about league bowling night: the rumble of the lanes, team shirts and cheering for a strike.", "Machines that set up the pins by themselves spread through bowling alleys in the 1950s.", "games,town", "sound"),
    P("r061", 1950, 1979, "n", "A Quiet Lake", "Lake at dawn", "Picture a quiet lake at dawn, a line in the water and the smell of coffee and pine.", "", "lake,morning", "sight,smell"),
    /* ---- the sixties and seventies ---- */
    P("r062", 1960, 1979, "h", "Color Television", "Color TV", "Think about the first color television in the living room and how bright everything looked.", "Color television became common in American homes in the later 1960s.", "television,home", "sight"),
    P("r063", 1960, 1979, "m", "The Beatles on Television", "The Beatles", "Talk about the night the Beatles appeared on television and how much people talked about it the next day.", "The Beatles first appeared on The Ed Sullivan Show in February 1964.", "television,music", "sound"),
    P("r064", 1964, 1979, "h", "A New Mustang", "Mustang", "Picture a brand-new Mustang in the driveway, sleek and bright, with the whole street admiring it.", "Ford introduced the Mustang in April 1964.", "car,town", "sight"),
    P("r065", 1963, 1979, "h", "The ZIP Code", "ZIP code", "Talk about writing letters and the new five-digit ZIP code added to every address.", "ZIP Codes were introduced in 1963.", "letters,home", "sight"),
    P("r066", 1960, 1979, "n", "The Backyard Barbecue", "Barbecue", "Picture a backyard barbecue: the smell of charcoal, long shadows and lawn chairs in a circle.", "", "summer,family", "smell,sight"),
    P("r067", 1960, 1979, "m", "Folk Songs and Guitars", "Guitar", "Think about folk songs around a guitar and voices joining in on the chorus.", "Folk music had a great revival in the late 1950s and the 1960s.", "music,family", "sound"),
    P("r068", 1960, 1979, "h", "The New Supermarket", "Supermarket", "Talk about the new supermarket: wide aisles, shopping carts and shelves stacked with colorful boxes.", "", "shop,town", "sight,sound"),
    P("r069", 1969, 1989, "h", "A Walk on the Moon", "Moon landing", "Think about gathering around the television to watch astronauts walk on the moon.", "Astronauts first walked on the moon in July 1969.", "television,family", "sight"),
    P("r070", 1960, 1979, "h", "Harvest Gold Kitchens", "Harvest gold", "Picture a kitchen in avocado green or harvest gold, with a new matching stove and refrigerator.", "Avocado green and harvest gold were favorite appliance colors in the 1970s.", "kitchen,home", "sight"),
    P("r071", 1967, 1989, "h", "The First Microwave", "Microwave oven", "Talk about the first microwave oven on the kitchen counter and popcorn that popped in minutes.", "The first countertop microwave oven for the home was sold in 1967.", "kitchen,home", "sound,smell"),
    P("r072", 1960, 1979, "hm", "The Stereo Console", "Stereo", "Think about a big wooden stereo cabinet with a turntable and a stack of favorite albums.", "Stereo records went on sale in 1958, and stereo cabinets soon filled living rooms.", "records,home", "sound,sight"),
    P("r073", 1960, 1979, "n", "A Picnic by the Lake", "Picnic", "Describe a picnic by the lake: a checkered cloth, sandwiches and cold lemonade in the shade.", "", "summer,lake", "taste,sight"),
    P("r074", 1961, 1979, "h", "The Slide Show", "Slide show", "Picture an evening slide show: the projector's hum, a bright square on the wall and travel stories.", "The Kodak Carousel slide projector was introduced in 1961.", "photos,family", "sight,sound"),
    P("r075", 1970, 1989, "n", "The First Earth Day", "Planting trees", "Think about planting trees and tidying parks on the first Earth Day.", "The first Earth Day was held on April 22, 1970.", "garden,town", "sight,touch"),
    P("r076", 1974, 1989, "h", "CB Radio", "CB radio", "Talk about CB radio in the truck: nicknames and chatter on the open road.", "CB radios became a popular craze in the mid-1970s.", "radio,travel", "sound"),
    P("r077", 1970, 1989, "m", "The Disco Floor", "Disco", "Picture a disco floor: a mirrored ball, colored lights and everybody moving.", "Disco dancing was at its peak in the late 1970s.", "dance,music", "sight,sound"),
    P("r078", 1970, 1989, "h", "Wood Paneling and Shag", "Shag carpet", "Think about the family room with wood paneling, thick shag carpet and a big console television.", "", "home,television", "touch,sight"),
    P("r079", 1970, 1989, "nm", "Hanging Plants", "Hanging plants", "Talk about hanging plants in macramé holders, ferns in the window and a green thumb.", "", "garden,crafts", "sight,touch"),
    P("r080", 1970, 1989, "m", "The Cassette Tape", "Cassette tape", "Picture a cassette tape of favorite songs taped off the radio, pressing play and record together.", "The compact cassette tape was introduced in 1963 and was everywhere by the 1970s.", "music,radio", "sound,touch"),
    P("r081", 1977, 1989, "h", "The Video Store", "Video store", "Talk about the video rental store: shelves of tapes, picking a movie for Friday night and popcorn.", "Home video recorders went on sale in the United States in 1977.", "movies,town", "sight,taste"),
    P("r082", 1950, 1989, "hm", "The Church Potluck", "Potluck supper", "Talk about a church potluck supper: casseroles lined up, a Jell-O salad and everyone bringing a favorite dish.", "", "church,kitchen", "taste,sight"),
    /* ---- the eighties ---- */
    P("r083", 1980, 1989, "m", "The Compact Disc", "Compact disc", "Picture the first compact discs: the shiny little disc, no needle and clear sound.", "Compact discs went on sale in the early 1980s.", "records,music", "sound,sight"),
    P("r084", 1981, 1989, "m", "Music Videos", "Music videos", "Talk about music videos on television and the bands everyone was watching.", "MTV launched in August 1981.", "television,music", "sight,sound"),
    P("r085", 1979, 1989, "m", "The Walkman", "Walkman", "Picture a small cassette player with headphones, with music wherever you walked.", "The Sony Walkman was introduced in 1979.", "music,walking", "sound"),
    P("r086", 1981, 1989, "h", "The Home Computer", "Home computer", "Talk about the first home computer: the glowing green letters and the click of the keyboard.", "The IBM Personal Computer went on sale in 1981.", "home,desk", "sight,sound"),
    P("r087", 1980, 1989, "h", "Morning Exercise Class", "Exercise class", "Picture a morning exercise class with upbeat music, headbands and leg warmers.", "", "dance,music", "sound"),
    P("r088", 1980, 1989, "h", "The Answering Machine", "Answering machine", "Talk about the first answering machine blinking in the hallway and a stack of messages waiting.", "Answering machines became common in American homes in the 1980s.", "telephone,home", "sound,sight"),
    P("r089", 1980, 1989, "hm", "The Fall Craft Fair", "Craft fair", "Picture a fall craft fair: hand-painted signs, quilts and a cup of warm cider.", "", "crafts,autumn", "sight,taste"),
    P("r090", 1980, 1989, "n", "Backyard Tomatoes", "Ripe tomatoes", "Think about backyard tomatoes in late summer, warm from the sun and eaten right off the vine.", "", "garden,summer", "taste,smell"),
    /* ---- everyday and always: nature, craft and music across the years ---- */
    P("r091", 1901, 1989, "n", "Birds at the Feeder", "Bird feeder", "Picture the feeder outside the kitchen window and a bright red cardinal arriving at breakfast.", "", "birds,morning", "sight,sound"),
    P("r092", 1901, 1989, "n", "The First Robin", "First robin", "Think about the first robin of spring, hopping across the thawing lawn.", "", "birds,spring", "sight"),
    P("r093", 1901, 1989, "n", "Apple Blossoms", "Apple blossoms", "Describe an orchard in blossom: pink and white petals drifting in the breeze.", "", "orchard,spring", "sight,smell"),
    P("r094", 1901, 1989, "n", "Lilacs in May", "Lilacs", "Picture a lilac hedge in May and the sweet smell drifting through the open window.", "", "flowers,spring", "smell,sight"),
    P("r095", 1901, 1989, "n", "Rain on the Roof", "Rain on the roof", "Think about the sound of soft rain on the roof on a quiet afternoon.", "", "rain,home", "sound"),
    P("r096", 1901, 1969, "n", "The Hayfield", "Cut hay", "Talk about the smell of a freshly cut hayfield on a warm day.", "", "farm,summer", "smell,sight"),
    P("r097", 1901, 1989, "n", "Stepping Stones", "The creek", "Picture a shallow creek with stepping stones and sunlight flickering on the water.", "", "creek,summer", "sight,sound"),
    P("r098", 1901, 1959, "n", "Wild Plums", "Wild plums", "Describe picking wild plums along a country road and the jam made from them.", "", "fruit,summer", "taste,sight"),
    P("r099", 1901, 1989, "n", "The Prairie Sky", "Prairie sky", "Picture a wide prairie sky at dusk, with the last gold light on the wheat.", "", "prairie,evening", "sight"),
    P("r100", 1901, 1989, "n", "Quiet Snowfall", "Snowfall", "Think about a quiet snowfall at night and how still everything becomes.", "", "winter,evening", "sight,sound"),
    P("r101", 1901, 1989, "n", "Fireflies", "Fireflies", "Picture fireflies blinking over the lawn on a warm summer evening.", "", "summer,evening", "sight"),
    P("r102", 1901, 1989, "n", "The Cornfield", "Cornfield", "Describe the rustle of a tall cornfield in a late-summer breeze.", "", "farm,summer", "sound,sight"),
    P("r103", 1901, 1989, "n", "The Frog Pond", "Evening pond", "Think about a pond in the evening, with frogs singing and the water turning silver.", "", "pond,evening", "sound,sight"),
    P("r104", 1901, 1989, "n", "Sunrise on the Lake", "Sunrise", "Picture sunrise over a lake: mist lifting, a loon calling and the water going gold.", "", "lake,morning", "sight,sound"),
    P("r105", 1901, 1989, "n", "Geese Going South", "Geese overhead", "Think about geese flying south in autumn, their calls drifting down from a pale sky.", "", "birds,autumn", "sound,sight"),
    P("r106", 1901, 1989, "n", "The Harvest Moon", "Harvest moon", "Picture a big harvest moon rising over the fields, orange and low in the sky.", "", "autumn,evening", "sight"),
    P("r107", 1901, 1989, "nh", "Rhubarb Pie", "Rhubarb pie", "Talk about the first rhubarb of spring and the pie that came out of the oven.", "", "garden,kitchen", "taste,smell"),
    P("r108", 1901, 1989, "n", "Peonies in June", "Peonies", "Picture peonies in June, heavy blossoms bending toward the grass after the rain.", "", "flowers,summer", "sight,smell"),
    P("r109", 1901, 1989, "n", "A Bouquet from the Field", "Field bouquet", "Describe a jar of wildflowers picked on a walk and set on the kitchen table.", "", "flowers,home", "sight,smell"),
    P("r110", 1901, 1989, "nh", "Maple Syrup Time", "Maple syrup", "Think about maple syrup time: the sap buckets, the steam and the sweet smell in the sugar house.", "", "farm,spring", "smell,taste"),
    P("r111", 1901, 1989, "n", "Picking Berries", "Berry picking", "Picture picking berries on a sunny morning, warm fruit and stained fingers.", "", "fruit,summer", "taste,touch"),
    P("r112", 1901, 1959, "nh", "The Clothesline", "Clothesline", "Think about sheets and shirts on the clothesline, moving in a warm breeze.", "", "laundry,summer", "sight,smell"),
    P("r113", 1901, 1989, "n", "Morning Dew", "Morning dew", "Picture the grass in the early morning, bright with dew, and the first birds beginning to sing.", "", "morning,garden", "sight,sound"),
    P("r114", 1901, 1989, "n", "Bees in the Clover", "Clover", "Describe a clover field in summer and the soft hum of bees moving among the flowers.", "", "meadow,summer", "sound,sight"),
    P("r115", 1901, 1989, "nm", "A Concert in the Park", "Band concert", "Picture a band concert in the park: lawn chairs, a bandstand and music drifting over the trees.", "", "music,summer", "sound,sight"),
    P("r116", 1901, 1989, "m", "Singing in the Kitchen", "Singing", "Talk about singing along while working in the kitchen, a favorite song for every chore.", "", "music,kitchen", "sound"),
    P("r117", 1901, 1969, "m", "The Harmonica", "Harmonica", "Think about someone playing a harmonica on the porch after supper.", "", "music,porch", "sound"),
    P("r118", 1901, 1989, "m", "Whistling a Tune", "Whistling", "Picture someone whistling a tune while they worked, and the whole house knowing they were near.", "", "music,home", "sound"),
    P("r119", 1901, 1989, "m", "The Knitting Circle", "Knitting", "Talk about a knitting circle: needles clicking, a ball of yarn rolling and good conversation.", "", "crafts,friends", "sound,touch"),
    P("r120", 1901, 1989, "m", "Crocheted Doilies", "Doilies", "Think about crocheted doilies on the arms of the sofa and the lace in every window.", "", "crafts,home", "sight,touch"),
    P("r121", 1901, 1989, "m", "A Wooden Workbench", "Workbench", "Picture a workbench in the garage: the smell of sawdust, a project half finished and the tools hanging in a row.", "", "crafts,garage", "smell,sight"),
    P("r122", 1901, 1989, "m", "Handwritten Recipe Cards", "Recipe cards", "Talk about a box of handwritten recipe cards, stained with butter and loved by many hands.", "", "kitchen,crafts", "sight,touch"),
    P("r123", 1901, 1989, "hm", "The Family Photograph Album", "Photo album", "Think about turning the pages of the family photograph album, and the stories behind every picture.", "", "photos,family", "sight,touch"),
    P("r124", 1901, 1969, "hm", "Letters by Hand", "A letter", "Talk about writing a letter by hand and the joy of a letter arriving in the mailbox.", "", "letters,home", "sight,touch"),
    P("r125", 1901, 1989, "hm", "The Rotary Telephone", "Rotary phone", "Picture a rotary telephone in the hallway: the heavy receiver and the slow whirr of the dial.", "Push-button telephones arrived in 1963, but many homes kept the rotary dial for years.", "telephone,home", "sound,touch"),
    P("r126", 1901, 1989, "hm", "The Typewriter", "Typewriter", "Think about the clack of a typewriter, the bell at the end of the line and a fresh sheet of paper.", "The IBM Selectric typewriter, with its spinning ball of type, arrived in 1961.", "desk,letters", "sound,touch"),
    P("r127", 1901, 1989, "m", "Sheet Music on the Stand", "Sheet music", "Picture sheet music propped on the stand and a favorite song played again and again.", "", "music,piano", "sound,sight"),
    P("r128", 1901, 1989, "hm", "The Cast-Iron Skillet", "Cast-iron skillet", "Talk about the cast-iron skillet: heavy in the hand, seasoned by years of Sunday breakfasts.", "", "kitchen,home", "touch,smell"),
    P("r129", 1901, 1949, "h", "The Barn Raising", "Barn raising", "Picture neighbors gathering to raise a barn: hammers ringing and a long table of food.", "", "farm,neighbors", "sound,taste"),
    P("r130", 1901, 1989, "h", "The Barber Shop", "Barber shop", "Think about the barber shop: the striped pole, the leather chair and the smell of talc and soap.", "", "town,shop", "smell,sight")
  ];

  /* what to ask about, in an open way, after a prompt, by the senses it touches (the early and middle stages only) */
  var FOLLOW = {
    smell: "What did it smell like?", sound: "What sounds went with it?", touch: "What did it feel like in your hands?",
    taste: "What did it taste like?", sight: "What colors do you picture?", people: "Who was there with you?", place: "Where did it happen?", feeling: "How did it make you feel?"
  };

  /* ---------- puzzles ---------- */
  var W = function (id, themes, title, words) { return Object.freeze({ id: id, kind: "search", themes: themes.split(""), title: title, words: words.split(/\s+/) }); };
  var L = function (id, themes, title, items) { return Object.freeze({ id: id, kind: "likes", themes: themes.split(""), title: title, items: items.split("|") }); };
  var F = function (id, themes, title, pairs) {
    return Object.freeze({ id: id, kind: "finish", themes: themes.split(""), title: title, pairs: pairs.split("|").map(function (p) { var a = p.split(">"), o = a[1].split(","); return { stem: a[0], answer: o[0], others: o.slice(1) }; }) });
  };

  var PUZZLES = [
    W("ws01", "n", "Garden Words", "GARDEN LILAC PEONY TULIP TOMATO RHUBARB SPROUT BLOSSOM TROWEL CLOVER DAISY FERN POPPY MARIGOLD"),
    W("ws02", "n", "Morning Light", "SUNRISE DEW ROBIN MEADOW BREEZE COFFEE PORCH QUIET GOLDEN WINDOW MORNING BIRDSONG MIST FIELD"),
    W("ws03", "nh", "A Quiet Evening", "LAMP TWILIGHT CRICKET SWING LEMONADE FIREFLY STARS CALM SUNSET PORCH SHADOW QUILT LANTERN"),
    W("ws04", "h", "The Kitchen Table", "BREAD BUTTER KETTLE APRON PIE PEACH CINNAMON OVEN SPOON TEAPOT CUPS FLOUR JAM BISCUIT SKILLET"),
    W("ws05", "n", "Autumn Harvest", "PUMPKIN MAPLE CORN APPLE CIDER BARN WHEAT HAY ACORN QUILT SQUASH ORCHARD HARVEST GOURD"),
    W("ws06", "h", "Winter Warmth", "SCARF MITTENS COCOA HEARTH WOOL SNOWFALL CANDLE BLANKET COZY FROST SLEIGH EVERGREEN KNIT STOVE"),
    W("ws07", "n", "Spring Rain", "PUDDLE UMBRELLA ROBIN CROCUS RAIN MIST BUDS LILAC GREEN SHOWER RAINBOW FRESH BLOSSOM"),
    W("ws08", "n", "Summer Days", "PICNIC LAKE SHADE HAMMOCK CLOVER BREEZE SUNHAT LEMONADE CRICKET BASKET WATERMELON DAYLIGHT BERRIES"),
    W("ws09", "m", "Music Time", "PIANO MELODY FIDDLE WALTZ CHORUS HARMONY RHYTHM ACCORDION POLKA RECORD RADIO TUNE BANJO GUITAR VIOLIN SONG"),
    W("ws10", "m", "Handwork", "KNITTING QUILT THREAD NEEDLE CROCHET YARN BUTTONS THIMBLE LACE PATTERN WEAVE SEWING STITCH RIBBON DOILY FABRIC"),
    W("ws11", "h", "Sunday Dinner", "ROAST GRAVY POTATOES BISCUITS PICKLES PLATTER CANDLE NAPKIN DESSERT CARROTS FAMILY CASSEROLE CUSTARD CELERY"),
    W("ws12", "h", "The Front Porch", "ROCKER SWING LEMONADE NEIGHBOR WAVE SCREEN LANTERN GERANIUM CRICKETS STEPS BREEZE EVENING WICKER RAILING"),
    W("ws13", "hm", "The Old Radio", "DIAL ANTENNA STATION TUNING SPEAKER COMEDY SERIAL VOLUME STATIC PROGRAM ANNOUNCER MUSIC WALNUT CABINET"),
    W("ws14", "h", "Main Street", "BAKERY DINER MARQUEE BARBER PHARMACY STOREFRONT SIDEWALK AWNING TROLLEY HARDWARE FOUNTAIN CORNER LIBRARY GROCER"),
    W("ws15", "n", "At the Bird Feeder", "CARDINAL ROBIN SPARROW FINCH CHICKADEE WREN FEEDER SEED BLUEBIRD ORIOLE JAY NUTHATCH SONG BRANCH"),
    W("ws16", "n", "The Prairie Sky", "WHEAT SUNSET HORIZON CLOUDS SUNFLOWER BREEZE MEADOWLARK GRASS FIELD WINDMILL PRAIRIE HARVEST GOLDEN EVENING"),
    W("ws17", "n", "Lake Mornings", "LAKE DOCK PADDLE LOON REEDS MIST CATTAILS SUNRISE PINE RIPPLE SHORE CANOE PEBBLES QUIET"),
    W("ws18", "h", "Family Recipes", "RECIPE FLOUR YEAST SUGAR CINNAMON DOUGH WHISK PINCH RHUBARB BAKING CARDS APRON SPATULA MIXING"),
    W("ws19", "m", "The Dance Floor", "WALTZ POLKA SWING FOXTROT BALLROOM ORCHESTRA SQUARE PARTNER TWIRL RHYTHM BAND SHOES CORSAGE"),
    W("ws20", "h", "Old-Fashioned Tools", "HAMMER SAW LEVEL CHISEL PLANE WRENCH ANVIL BUCKET RAKE SHOVEL HOE PLIERS WORKBENCH"),

    L("as01", "n", "A Garden", "Ripe tomatoes|Sweet peas|Watering can|Buzzing bees|Garden gloves|Fresh soil|Tulip beds|Morning dew"),
    L("as02", "h", "A Quiet Afternoon", "Porch swing|Warm tea|Soft blanket|Open window|Lilac scent|Rocking chair|Sunlit room|Gentle humming"),
    L("as03", "m", "Music", "Piano|Harmonica|Waltz|Singing along|Record player|Radio dial|Whistling|Dancing"),
    L("as04", "h", "The Kitchen", "Warm bread|Fresh coffee|Apple pie|Wooden spoon|Cookie jar|Cast-iron pan|Teapot|Checkered cloth"),
    L("as05", "h", "Winter Evenings", "Wool socks|Falling snow|Hot cocoa|Woodstove|Quilted blanket|Frosty window|Candlelight|A good book"),
    L("as06", "n", "Summer", "Lemonade|Picnic basket|Shade tree|Lake breeze|Hammock|Fireflies|Straw hat|Corn on the cob"),
    L("as07", "n", "Autumn", "Crisp apples|Maple leaves|Hay wagon|Pumpkin bread|Warm cider|Geese overhead|Wool sweater|Harvest moon"),
    L("as08", "n", "Spring", "First robin|Crocus|Soft rain|Muddy boots|Apple blossoms|New leaves|Open windows|Birdsong"),
    L("as09", "m", "Handwork", "Knitting|Crochet|Quilting|Embroidery|Woodcarving|Mending|Pottery|Rug braiding"),
    L("as10", "h", "Family Time", "Sunday dinner|Front porch|Photo album|Card games|Picnic table|Old letters|Family stories|Holiday recipes"),
    L("as11", "m", "Dancing", "Waltz|Polka|Square dance|Swing dance|Dance hall|Live band|Polished shoes|Swirling skirt"),
    L("as12", "h", "Main Street", "Bakery window|Barber pole|Soda fountain|Hardware store|Corner drugstore|Movie marquee|Shop awnings|Park bench"),
    L("as13", "n", "Birds", "Cardinal|Robin|Bluebird|Chickadee|Meadowlark|Goldfinch|Wren|Oriole"),
    L("as14", "hm", "Radio Days", "Evening programs|Glowing dial|Big band|Baseball broadcast|Weather report|Comedy hour|Soft static|Walnut cabinet"),

    F("fp01", "h", "In the Kitchen", "Salt and>pepper,window,button|Bread and>butter,pencil,window|Cup and>saucer,hammer,ladder|Knife and>fork,button,candle|Peaches and>cream,hammer,tulip|Bacon and>eggs,ribbon,gravel"),
    F("fp02", "hm", "Sewing Basket", "Needle and>thread,bucket,pepper|Thimble and>needle,spoon,lantern|Pins and>needles,windows,saucers|Scissors and>fabric,butter,lantern|Hook and>eye,cream,table|Cloth and>pattern,hammer,bread"),
    F("fp03", "n", "In the Garden", "Sun and>rain,spoon,ribbon|Flowers and>bees,buttons,cups|Roots and>branches,pillows,kettles|Hoe and>rake,spoon,saucer|Seeds and>soil,ribbon,candle|Fruit and>vegetables,hammers,windows"),
    F("fp04", "m", "Music and Song", "Rock and>roll,paper,stove|Song and>dance,button,bucket|Fiddle and>bow,spoon,kettle|Piano and>bench,hammer,basket|Words and>music,boots,gravel|Rhythm and>rhyme,bread,pencil"),
    F("fp05", "h", "On the Porch", "Rocking>chair,hammer,gravel|Front>porch,bucket,saucer|Screen>door,spoon,mitten|Peace and>quiet,bread,ribbon|Back and>forth,butter,lantern|Rise and>shine,pencil,bucket"),
    F("fp06", "h", "Everyday Things", "Pen and>paper,bucket,spoon|Hammer and>nails,butter,ribbon|Black and>white,saucer,pillow|Day and>night,mitten,bread|Shoes and>socks,gravel,candle|Lock and>key,pudding,bucket"),
    F("fp07", "n", "Weather and Seasons", "Wind and>rain,button,saucer|Sun and>moon,hammer,spoon|Snow and>ice,gravel,butter|Spring and>summer,pencil,bucket|Hot and>cold,ribbon,lantern|Cloud and>sky,bread,hammer"),
    F("fp08", "h", "Dinner Table", "Meat and>potatoes,hammer,ladder|Tea and>toast,bucket,pencil|Soup and>sandwich,ribbon,saucer|Cheese and>crackers,lantern,hammer|Peas and>carrots,spoon,bucket|Rice and>beans,pencil,ribbon")
  ];

  /* ---------- quiet lines for the breath and the body ---------- */
  var GROUNDING = [
    { id: "g01", text: "Breathe in slowly... and out slowly.", short: "Breathe in. Breathe out." },
    { id: "g02", text: "Rest your hands in your lap and feel their warmth.", short: "Feel your hands." },
    { id: "g03", text: "Feel your feet resting on the floor.", short: "Feel your feet." },
    { id: "g04", text: "Look at one thing nearby that you like.", short: "Look. Breathe slowly." },
    { id: "g05", text: "Listen for the quietest sound in the room.", short: "Listen. Breathe slowly." },
    { id: "g06", text: "Feel the smooth paper under your fingers.", short: "Feel the paper." },
    { id: "g07", text: "Let your shoulders drop and settle.", short: "Let your shoulders drop." },
    { id: "g08", text: "Take one slow breath in, and one slow breath out.", short: "One slow breath." },
    { id: "g09", text: "You are safe here. Someone is beside you.", short: "You are safe here." },
    { id: "g10", text: "Notice something soft nearby, and touch it gently.", short: "Touch something soft." },
    { id: "g11", text: "Take all the time you like.", short: "Take your time." },
    { id: "g12", text: "Look out of the window for a moment, if you can.", short: "Look outside." }
  ];
  var RHYTHM = [
    { id: "b01", text: "Breathe in as the line rises. Breathe out as it falls.", short: "In as it rises. Out as it falls." },
    { id: "b02", text: "Follow the path slowly, one breath at a time.", short: "One breath at a time." },
    { id: "b03", text: "Trace the path with one finger, as slowly as you like.", short: "Trace it slowly." }
  ];

  /* ---------- what the person beside the resident can do (the tip printed at the foot of a page) ---------- */
  var TIP = function (id, fw, text) { return Object.freeze({ id: id, fw: fw, text: "Clinical Tip: " + text }); };
  var TIPS = [
    TIP("t01", "communication", "Approach from the front, say their name, and keep your voice low and slow. One short sentence at a time."),
    TIP("t02", "environment", "Lower the noise: turn off the television, close the door, and move to a quieter spot if you can."),
    TIP("t03", "validation", "Name the feeling first: \"This is upsetting. I am right here with you.\" Do not argue or correct."),
    TIP("t04", "sensory", "Sit beside them, not across. Match their pace and breathe slowly so they can follow your calm."),
    TIP("t05", "environment", "Check the basics: pain, thirst, hunger, the toilet, glasses, hearing aids, and a room that is too warm or too cool."),
    TIP("t06", "montessori", "Offer the page, then wait. Offer, never insist. If they push it away, set it down nearby and stay."),
    TIP("t07", "communication", "Keep your hands visible and relaxed. Offer one simple choice, such as \"This one or that one?\""),
    TIP("t08", "sensory", "Dim harsh lights and close the curtains against glare. Late-afternoon light and shadows can confuse."),
    TIP("t09", "validation", "If they ask for someone or somewhere, join the feeling: \"Tell me about her.\" Redirect only after calm returns."),
    TIP("t10", "motor", "Rest a hand lightly over theirs for the first line only, then let go. Offer a thick marker they can grip easily."),
    TIP("t11", "environment", "Stay with them. A calm, familiar person nearby is often the most soothing thing in the room."),
    TIP("t12", "communication", "Ask open questions instead: say \"Tell me about...\" and let a silence be fine."),
    TIP("t13", "sensory", "Offer a warm drink, a soft blanket or familiar music if welcomed. Check for allergies first."),
    TIP("t14", "environment", "Note what helped (the time, the place, what you tried) and share it with the care team. Patterns guide the care plan.")
  ];

  /* the instruction line on each kind of page, by stage */
  var INSTRUCTIONS = {
    prompt: { early: "Take your time. Talk about it together, or just think about it.", middle: "Take your time. We can talk about it together.", late: "" },
    motif: { early: "Look at the shape. Trace it with a finger or color it, whatever feels good.", middle: "Look at the picture. Trace it with a finger, or color it.", late: "Look. Trace with a finger." },
    path: { early: "Trace the path slowly with a finger or a thick marker.", middle: "Trace the path slowly with a finger or a thick marker.", late: "Trace with a finger." },
    search: { early: "Circle each word. They go across, down and slanted.", middle: "Circle each word. The first letter of each has a box." },
    likes: { early: "Circle the ones you like. Any choice is fine.", middle: "Circle the ones you like. Any choice is fine." },
    finish: { early: "Circle the word that goes with it.", middle: "Circle the word that goes with it." }
  };

  /* what a page for the stage is called in the foot of the sheet */
  var STAGE_LABEL = { early: "Mild / Early", middle: "Moderate / Mid", late: "Acute / Late" };

  root.CognicopiaSoothingContent = Object.freeze({
    VERSION: VERSION, THEMES: THEMES, CODE_OF: CODE_OF, PROMPTS: PROMPTS, FOLLOW: FOLLOW, PUZZLES: PUZZLES,
    GROUNDING: GROUNDING, RHYTHM: RHYTHM, TIPS: TIPS, INSTRUCTIONS: INSTRUCTIONS, STAGE_LABEL: STAGE_LABEL
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
