// The development library: activities, trivia sets and reminiscence prompts.
// Generated into platform/supabase/seed.sql by build-seed.mjs.
const act = (title, category, stage, formats, themes, minutes, summary, extra = {}) => ({
  title, category, stage,
  payload: { summary, minutes, formats, ...(themes.length ? { themes } : {}), ...extra },
});

export const ACTIVITIES = [
  // ---- the ten items the seed has always had (now with formats and themes) ----
  act("Sing-along classics", "music", "universal", ["active", "printable"], ["music"], 20, "Public-domain classics in very large type to sing together.", { group_friendly: true, sensory: true, template: { generator: "lyric-sheet", params: {} } }),
  act("Chair yoga", "movement", "universal", ["active"], [], 20, "Gentle seated stretches, led from the front of the room.", { group_friendly: true, sensory: true, template: { generator: "chair-yoga", params: {} } }),
  act("Large-print word search", "word", "early", ["games", "printable"], [], 20, "A 12 or 15 square word search with the words listed beneath it.", { group_friendly: false, sensory: false, template: { generator: "search-large", params: {} } }),
  act("Guided word search", "word", "middle", ["games", "printable"], [], 15, "A small 8 square word search; the first letter of each word is boxed.", { group_friendly: false, sensory: false, template: { generator: "search-guided", params: {} } }),
  act("Line tracing", "movement", "late", ["printable"], [], 15, "Thick paths to trace with a finger or a marker: fine motor, one at a time.", { group_friendly: false, sensory: true, template: { generator: "line-tracing", params: {} } }),
  act("Coloring page", "cognicopia-coloring", "universal", ["printable"], [], 30, "Bold adult line art; the detail of the picture follows the stage.", { group_friendly: true, sensory: true, template: { generator: "cognicopia-coloring", params: {} } }),
  act("Number ladders", "numbers", "early", ["games", "printable"], [], 15, "Counting on by 1s, 2s, 5s and 10s.", { group_friendly: false, sensory: false, template: { generator: "number-ladder", params: {} } }),
  act("Letter tracing", "letters", "late", ["printable"], [], 15, "Very large letters to trace: tactile and calm.", { group_friendly: false, sensory: true, template: { generator: "letter-tracing", params: {} } }),
  act("Orientation board", "multisensory", "universal", ["printable"], [], 10, "A giant-type board for the day, the date and the weather.", { group_friendly: true, sensory: true, template: { generator: "orientation-board", params: {} } }),
  act("Memory lane", "word", "universal", ["reminiscence"], [], 30, "Reminiscence prompts with no right or wrong answers.", { group_friendly: true, sensory: false, template: { generator: "memory-lane", params: {} } }),

  // ---- movement and music ----
  act("Walking club", "movement", "early", ["active"], ["spring", "summer", "autumn", "garden"], 25, "A slow stroll, indoors or out, with a stop to notice something along the way.", { group_friendly: true, sensory: true, steps: ["Choose a flat, well-lit route and a point to stop.", "Bring water and a chair for anyone who wants to rest.", "Name one thing to look for before you set off."] }),
  act("Stretch and sway to the big bands", "movement", "early", ["active"], ["nostalgia-1940s", "music"], 20, "Seated stretches and slow swaying to big band recordings.", { group_friendly: true, sensory: true }),
  act("Seated twist to the sixties", "movement", "middle", ["active"], ["nostalgia-1960s", "music"], 15, "A gentle seated twist to 1960s dance songs; arms only for anyone who prefers.", { group_friendly: true, sensory: true }),
  act("Scarf dancing", "movement", "middle", ["active"], ["music"], 20, "Light scarves waved slowly to familiar music, seated or standing with support.", { group_friendly: true, sensory: true, materials: ["Light chiffon scarves", "Familiar music"] }),
  act("Balloon volley", "movement", "universal", ["active", "games"], ["summer"], 15, "Keep a balloon in the air together, seated, at a gentle pace.", { group_friendly: true, sensory: true }),
  act("Beanbag targets", "movement", "universal", ["active", "games"], [], 20, "Seated tosses at a tabletop target, with scores to add.", { group_friendly: true, sensory: true, template: { generator: "beanbag-target", params: {} } }),
  act("Seated rhythm", "movement", "universal", ["active"], ["music"], 15, "Clap and tap patterns everyone follows in time.", { group_friendly: true, sensory: true, template: { generator: "seated-rhythm", params: {} } }),
  act("Paper airplanes", "movement", "early", ["active", "games"], ["aviation"], 25, "Fold paper airplanes and fly them down a taped runway.", { group_friendly: true, sensory: false, materials: ["Plain paper", "Masking tape for the runway"], steps: ["Fold one airplane together first, a step at a time.", "Mark the runway and take turns to fly.", "Measure and cheer the longest glide."] }),
  act("Planting herbs", "multisensory", "middle", ["active", "sensory"], ["spring", "garden", "home-kitchen"], 30, "Pot basil, mint or parsley and rub a leaf to smell it.", { group_friendly: true, sensory: true, materials: ["Small pots", "Potting soil", "Herb seedlings that are safe if touched or tasted"], steps: ["Check for plant or soil allergies first.", "Hand over one pot and one seedling at a time."] }),
  act("Flower arranging", "multisensory", "early", ["active", "sensory"], ["spring", "garden"], 30, "Cut and arrange fresh flowers for the dining room.", { group_friendly: true, sensory: true, materials: ["Fresh flowers", "Blunt scissors", "Small vases"] }),
  act("Music and humming circle", "music", "late", ["active", "sensory"], ["music"], 15, "Familiar tunes played softly and hummed along to, in a small circle.", { group_friendly: true, sensory: true }),

  // ---- games and printable sheets ----
  act("Easy crossword", "word", "early", ["games", "printable"], [], 25, "A 9 by 9 crossword in large print, with a picture clue beside each word.", { group_friendly: false, sensory: false }),
  act("Word scramble: spring", "word", "early", ["games", "printable"], ["spring", "garden"], 15, "Spring words with the letters mixed up and a picture clue for each.", { group_friendly: false, sensory: false, template: { generator: "scramble", params: {} } }),
  act("Word scramble: the sky", "word", "early", ["games", "printable"], ["aviation"], 15, "Flight words (wing, pilot, runway) with the letters mixed up.", { group_friendly: false, sensory: false, template: { generator: "scramble", params: {} } }),
  act("Large-print sudoku", "numbers", "early", ["games", "printable"], [], 20, "4 by 4 and 6 by 6 puzzles with one solution each.", { group_friendly: false, sensory: false, template: { generator: "mini-sudoku", params: {} } }),
  act("Money counting", "numbers", "early", ["games", "printable"], ["nostalgia-1950s"], 20, "Coins at true size with old-time prices: a ready group conversation.", { group_friendly: true, sensory: false, template: { generator: "money-count", params: {} } }),
  act("Singer and song match", "music", "early", ["games", "printable"], ["music", "nostalgia-1960s"], 15, "Match singers to their songs, or songs to their years.", { group_friendly: false, sensory: false, template: { generator: "singer-match", params: {} } }),
  act("Alphabet sweep: the garden", "letters", "early", ["games"], ["garden", "spring"], 20, "One theme, A to Z: a natural group brainstorm.", { group_friendly: true, sensory: false, template: { generator: "alphabet-sweep", params: {} } }),
  act("Name three", "word", "universal", ["games"], [], 15, "Naming prompts; one answer is plenty at the advanced stage.", { group_friendly: true, sensory: false, template: { generator: "name-three", params: {} } }),
  act("Goes together", "word", "middle", ["games"], ["home-kitchen"], 15, "Everyday pairs such as salt and pepper, in fewer and larger pieces.", { group_friendly: true, sensory: false, template: { generator: "goes-together", params: {} } }),
  act("Matching pairs: everyday objects", "word", "middle", ["games", "printable"], ["home-kitchen"], 15, "Six large picture cards to match, such as a cup and its saucer.", { group_friendly: false, sensory: false }),
  act("Large dot-to-dot", "numbers", "middle", ["games", "printable"], [], 15, "A simple picture that appears as the dots are joined in order.", { group_friendly: false, sensory: false }),
  act("Recipe cards to read aloud", "word", "middle", ["printable", "reminiscence"], ["home-kitchen", "nostalgia-1950s"], 20, "Large-print family-style recipes to read aloud and talk about.", { group_friendly: true, sensory: false }),
  act("Large-piece puzzle", "word", "late", ["games"], [], 20, "A six to twelve piece puzzle with big, thick pieces and a clear picture.", { group_friendly: false, sensory: true }),
  act("Sorting buttons", "word", "late", ["games", "sensory"], ["home-kitchen"], 15, "Sort large buttons by color into bowls: familiar, tactile and calming.", { group_friendly: false, sensory: true, materials: ["Large buttons (too big to swallow)", "Shallow bowls"] }),
  act("Coloring: spring flowers", "cognicopia-coloring", "universal", ["printable"], ["spring", "garden"], 30, "Bold line art of spring flowers.", { group_friendly: true, sensory: true }),
  act("Coloring: airplanes", "cognicopia-coloring", "universal", ["printable"], ["aviation"], 30, "Bold line art of classic airplanes.", { group_friendly: true, sensory: true }),
  act("Coloring: classic cars", "cognicopia-coloring", "universal", ["printable"], ["road-trips", "nostalgia-1950s"], 30, "Bold line art of 1950s cars.", { group_friendly: true, sensory: true }),
  act("Coloring: autumn leaves", "cognicopia-coloring", "universal", ["printable"], ["autumn"], 30, "Bold line art of autumn leaves.", { group_friendly: true, sensory: true }),
  act("Coloring: winter cottage", "cognicopia-coloring", "universal", ["printable"], ["winter"], 30, "Bold line art of a snowy cottage.", { group_friendly: true, sensory: true }),
  act("Coloring: summer picnic", "cognicopia-coloring", "universal", ["printable"], ["summer"], 30, "Bold line art of a picnic by the lake.", { group_friendly: true, sensory: true }),
  act("Seasons photo sheet", "multisensory", "universal", ["printable", "sensory"], ["spring", "summer", "autumn", "winter"], 15, "Large seasonal photographs with one word each, to look at and talk about.", { group_friendly: true, sensory: true }),

  // ---- sensory ----
  act("Hand massage", "multisensory", "late", ["sensory"], [], 15, "A gentle hand massage with a lotion the person's skin is known to tolerate.", { group_friendly: false, sensory: true, steps: ["Ask first, and stop if the person pulls away.", "Check care plans and skin for allergies or sensitivity."] }),
  act("Texture box", "multisensory", "late", ["sensory"], [], 15, "Soft, smooth and rough fabrics to hold and sort by feel.", { group_friendly: false, sensory: true, materials: ["Velvet, flannel, silk, wool swatches"] }),
  act("Aroma moments", "multisensory", "late", ["sensory"], ["spring", "garden"], 15, "Fresh herbs and lavender sachets to smell, one at a time.", { group_friendly: false, sensory: true, steps: ["Check for allergies and sensitivities first.", "Offer one scent at a time, with a pause between."] }),
  act("Window bird watching", "multisensory", "late", ["sensory"], ["garden", "spring", "winter"], 20, "Sit by a window with a bird feeder and share short comments on what comes.", { group_friendly: true, sensory: true }),
  act("Watching the sky", "multisensory", "late", ["sensory"], ["aviation", "summer"], 20, "Watch the clouds and any airplanes pass from a window or the patio.", { group_friendly: true, sensory: true }),
  act("Airport sounds", "multisensory", "late", ["sensory"], ["aviation"], 15, "Recordings of propeller engines and jets, played quietly one at a time, with a model plane to hold.", { group_friendly: true, sensory: true, materials: ["Quiet recordings of airplane engines", "A light model airplane"], steps: ["Play one sound at a time and pause between them.", "Offer the model to hold, and watch for comfort."] }),
  act("Cloud shapes", "multisensory", "middle", ["sensory", "games"], ["aviation", "summer"], 20, "Look at large photographs of clouds and sky, and name the shapes together.", { group_friendly: true, sensory: true, materials: ["Large photographs of clouds and sky"] }),
  act("Fly a kite", "movement", "middle", ["active"], ["aviation", "spring"], 25, "A light kite flown on the patio on a calm day, with a helper to hold the line.", { group_friendly: true, sensory: true, materials: ["A light kite with a long line"] }),
  act("Flight crossword", "word", "early", ["games", "printable"], ["aviation"], 20, "A large-print crossword of flight words with a word bank.", { group_friendly: false, sensory: false }),
  act("Airplane memory cards", "word", "middle", ["games", "reminiscence"], ["aviation", "nostalgia-1950s"], 20, "Large photographs of airplanes from propellers to jets to turn over and match.", { group_friendly: true, sensory: false, materials: ["Large photographs of airplanes, printed in pairs"] }),
  act("Warm towel folding","multisensory", "late", ["sensory"], ["home-kitchen"], 15, "Fold warm, freshly dried towels: a familiar task with a comforting feel.", { group_friendly: true, sensory: true }),
  act("Photo album browse", "multisensory", "late", ["sensory", "reminiscence"], ["nostalgia-1950s", "nostalgia-1960s"], 20, "Large-print books of vintage photographs to turn through together.", { group_friendly: true, sensory: true }),
  act("Baking day aromas", "multisensory", "middle", ["sensory", "reminiscence"], ["home-kitchen", "autumn", "winter"], 30, "Bake something simple so the unit fills with a familiar smell.", { group_friendly: true, sensory: true, steps: ["Check each person's diet and swallowing guidance before offering a taste.", "Let people measure, pour or stir."] }),
  act("Autumn leaf sort", "multisensory", "middle", ["sensory", "games"], ["autumn", "garden"], 20, "Sort real leaves by color and shape and feel their edges.", { group_friendly: true, sensory: true }),

  // ---- trivia ----
  { title: "Finish the saying", category: "trivia", stage: "universal", payload: { summary: "Familiar sayings to finish aloud, together.", minutes: 15, formats: ["trivia"], group_friendly: true, sensory: false, questions: [
    { q: "A penny saved is a penny ...", a: "earned" }, { q: "Better late than ...", a: "never" }, { q: "Many hands make ...", a: "light work" },
    { q: "An apple a day keeps the ... away", a: "doctor" }, { q: "A stitch in time saves ...", a: "nine" } ] } },
  { title: "Familiar songs: finish the line", category: "trivia", stage: "middle", payload: { summary: "Song titles to finish together, with the tune hummed to help.", minutes: 15, formats: ["trivia"], themes: ["music", "nostalgia-1950s"], group_friendly: true, sensory: false, questions: [
    { q: "You Are My ...", a: "Sunshine" }, { q: "Take Me Out to the ...", a: "Ball Game" }, { q: "Row, row, row your ...", a: "boat" }, { q: "Home, home on the ...", a: "range" } ] } },
  { title: "Spring in the garden", category: "trivia", stage: "early", payload: { summary: "Easy questions about spring, flowers and weather.", minutes: 15, formats: ["trivia"], themes: ["spring", "garden"], group_friendly: true, sensory: false, questions: [
    { q: "Which bird is a famous sign of spring: a robin or a penguin?", a: "A robin" }, { q: "What do bees collect from flowers?", a: "Nectar" },
    { q: "Which is planted in autumn to bloom in spring: tulip bulbs or tomato seeds?", a: "Tulip bulbs" }, { q: "April showers bring what?", a: "May flowers" } ] } },
  { title: "Up in the air", category: "trivia", stage: "early", payload: { summary: "Questions about flying, from the first airplane onward.", minutes: 15, formats: ["trivia"], themes: ["aviation"], group_friendly: true, sensory: false, questions: [
    { q: "Which brothers made the first powered airplane flight, in 1903?", a: "The Wright brothers" }, { q: "In which state, at Kitty Hawk, did they fly?", a: "North Carolina" },
    { q: "What is the long strip where airplanes take off called?", a: "A runway" }, { q: "Which pilot flew alone and nonstop across the Atlantic in 1927?", a: "Charles Lindbergh" } ] } },
  { title: "Classic television", category: "trivia", stage: "middle", payload: { summary: "Gentle questions about favorite shows of the 1950s and 1960s.", minutes: 15, formats: ["trivia"], themes: ["nostalgia-1950s", "nostalgia-1960s"], group_friendly: true, sensory: false, questions: [
    { q: "In I Love Lucy, what was Lucy's husband called: Ricky or Fred?", a: "Ricky" }, { q: "On which night was The Ed Sullivan Show famously on: Sunday or Wednesday?", a: "Sunday" },
    { q: "In The Andy Griffith Show, was Andy the sheriff or the barber?", a: "The sheriff" } ] } },
  { title: "Kitchen and home", category: "trivia", stage: "universal", payload: { summary: "Everyday questions about cooking and the home.", minutes: 15, formats: ["trivia"], themes: ["home-kitchen"], group_friendly: true, sensory: false, questions: [
    { q: "What makes bread rise: yeast or salt?", a: "Yeast" }, { q: "Before refrigerators, what kept food cold: an ice box or a toaster?", a: "An ice box" }, { q: "Which belongs on the stove: a skillet or a rake?", a: "A skillet" } ] } },
  { title: "Sing and say together", category: "trivia", stage: "late", payload: { summary: "Two or three very familiar lines, started for the person to finish.", minutes: 10, formats: ["trivia", "active"], themes: ["music"], group_friendly: true, sensory: true, questions: [
    { q: "Twinkle, twinkle, little ...", a: "star" }, { q: "Amazing grace, how sweet the ...", a: "sound" }, { q: "Jingle bells, jingle bells, jingle all the ...", a: "way" } ] } },
  { title: "Finish the song", category: "trivia", stage: "universal", payload: { summary: "Famous song titles to finish, called out as a group.", minutes: 15, formats: ["trivia"], themes: ["music"], group_friendly: true, sensory: false, template: { generator: "finish-song", params: {} }, questions: [
    { q: "Good night, ...", a: "Irene" }, { q: "I've Been Working on the ...", a: "Railroad" }, { q: "Let Me Call You ...", a: "Sweetheart" } ] } },
];

const prompt = (topic, stage, decade, senses, themes, opener, followUps, extra = {}) => ({
  title: topic, category: "reminiscence", stage,
  payload: { summary: opener, minutes: stage === "late" ? 10 : 20, formats: ["reminiscence"], themes: [`nostalgia-${decade}s`, ...themes], decade, senses, follow_ups: followUps, group_friendly: true, sensory: true, ...extra },
});
const TASTE_STEP = "Check each person's diet and swallowing guidance before offering any taste.";

export const PROMPTS = [
  // ---------------- 1940s ----------------
  prompt("The radio after supper", "early", 1940, ["sound"], ["music"], "Families gathered around the radio in the evening. What did your household listen to?", ["Was there a favorite program, or a favorite voice?", "Where did the radio sit in the room?", "Who got the best seat?"]),
  prompt("Saturday night at the dance hall", "universal", 1940, ["sound"], ["music"], "Big bands filled dance halls on a Saturday night. Tell me about a night out dancing.", ["Dancing, or watching the dancers?", "A slow song or a fast one?"]),
  prompt("Sunday dinner in the oven", "universal", 1940, ["smell", "taste"], ["home-kitchen"], "A Sunday roast filled many homes with its smell by noon. Tell me what Sunday dinner smelled like at your house.", ["Roast chicken or roast beef?", "A big table or a small one?"], { steps: [TASTE_STEP] }),
  prompt("Ice cream on a hot day", "late", 1940, ["taste"], ["summer"], "Ice cream was a real treat on a hot day. Vanilla or chocolate?", ["Vanilla, with a cherry on top.", "A cool, sweet taste on a warm day."], { steps: [TASTE_STEP], materials: ["Ice cream, only if the diet allows"] }),
  prompt("A wool coat", "middle", 1940, ["touch"], [], "Wool coats kept everyone warm through the winter. Feel this wool: how does it compare to what you wore?", ["Was your coat heavy, or light?", "Who did the mending?"], { materials: ["A wool swatch"] }),
  prompt("The streetcar on the corner", "universal", 1940, ["sight"], ["road-trips"], "Streetcars ran through many towns. Tell me where the streetcar took you.", ["A ride with family or with friends?", "Standing, or finding a seat?"]),
  prompt("The party-line telephone", "middle", 1940, ["sound"], [], "Many homes shared a telephone line with the neighbors. Tell me about the telephone at your house.", ["Was it on the wall or on a table?", "Who called most often?"]),
  prompt("Wash day and the clothesline", "universal", 1940, ["sight", "smell"], ["home-kitchen"], "Clothes dried in the sun on a line, and the sheets smelled wonderful. Tell me about wash day.", ["Hanging sheets, or folding them?", "Sunny days, or windy ones?"]),
  prompt("Fresh-cut grass", "late", 1940, ["smell"], ["summer", "garden"], "The smell of a freshly mown lawn means summer is here. Warm sun, and fresh grass.", ["Soft, green grass.", "A shady spot on the porch."], { materials: ["A handful of fresh-cut grass, if available"] }),
  prompt("Cards at the kitchen table", "early", 1940, ["touch", "sight"], [], "Cards on the kitchen table after supper were a favorite pastime. What games did your family play?", ["Who played to win?", "Who dealt?"], { materials: ["A deck of playing cards"] }),
  // ---------------- 1950s ----------------
  prompt("The first television", "early", 1950, ["sight"], [], "Many families got their first television in the 1950s. Tell me about the first one you watched.", ["What did the family watch together?", "Who sat closest to the screen?"]),
  prompt("Rock and roll on the radio", "universal", 1950, ["sound"], ["music"], "A new kind of music took over the radio in the 1950s. Tell me about the music you liked to listen to.", ["Dancing to it, or just listening?", "Did the family like it, or not so much?"]),
  prompt("The soda fountain", "middle", 1950, ["taste"], [], "A root beer float at the soda fountain was a favorite treat. What was your order?", ["A float, or a milkshake?", "Who did you go with?"], { steps: [TASTE_STEP] }),
  prompt("Saturday at the movies", "early", 1950, ["sight"], [], "A Saturday matinee was an outing for many families. Tell me about a favorite trip to the movies.", ["What did you see?", "What did you buy at the counter?"]),
  prompt("Dressed up for Sunday", "middle", 1950, ["touch"], [], "Starched collars and pressed dresses were the Sunday way. Feel this cotton: what was Sunday dress like?", ["Crisp, or soft?", "Who ironed the shirts?"], { materials: ["A starched cotton swatch"] }),
  prompt("The jukebox", "universal", 1950, ["sound"], ["music"], "A nickel bought a song at the diner. Tell me about a song you might have played.", ["Dancing along, or tapping a foot?", "Picking the song, or letting a friend pick?"]),
  prompt("The new car", "early", 1950, ["smell", "sight"], ["road-trips"], "A new car's smell, with its fresh seats, was a big event. Tell me about your family's car.", ["What color was it?", "Where did you drive first?"]),
  prompt("The Hula-Hoop craze", "universal", 1950, ["sight", "touch"], ["summer"], "In 1958 the Hula-Hoop swept the country. Tell me about trying one.", ["Around the waist, or around an arm?", "In the yard, or in the street?"], { materials: ["A hoop, if the group would like to try"] }),
  prompt("The backyard barbecue", "universal", 1950, ["smell", "taste"], ["summer"], "Charcoal smoke meant a summer cookout. Tell me what was on the grill at your house.", ["Burgers or hot dogs?", "Corn on the cob, or potato salad?"], { steps: [TASTE_STEP] }),
  prompt("A soft bedspread", "late", 1950, ["touch"], ["home-kitchen"], "Soft chenille bedspreads were in many bedrooms. Feel this soft fabric: cozy.", ["Soft and warm.", "A quilt on the bed."], { materials: ["A chenille or soft cotton blanket"] }),
  // ---------------- 1960s ----------------
  prompt("The Beatles on television", "early", 1960, ["sound"], ["music"], "In February 1964 the Beatles appeared on The Ed Sullivan Show. Tell me about the music of those years.", ["Who in the family liked it?", "Did you have a favorite song?"]),
  prompt("Motown", "universal", 1960, ["sound"], ["music"], "Motown songs got everyone dancing. Tell me a song that makes you tap your foot.", ["Dancing with a partner, or on your own?", "On the radio, or at a party?"]),
  prompt("Watching the moon landing", "early", 1960, ["sight"], ["aviation"], "In July 1969 people all over the world watched the moon landing on television. Tell me about that evening.", ["Who watched with you?", "What was the room like?"]),
  prompt("A Polaroid photograph", "middle", 1960, ["touch", "sight"], [], "Polaroid cameras gave you the picture in minutes. Hold this photograph: tell me about a favorite snapshot.", ["Who is in it?", "Where was it taken?"], { materials: ["An old photograph or a photo print"] }),
  prompt("Coffee on the stove", "universal", 1960, ["smell"], ["home-kitchen"], "A percolator bubbling on the stove meant morning had begun. Tell me about your mornings.", ["Up early, or sleeping in?", "Toast, or a sweet roll?"], { materials: ["Freshly brewed coffee, if the diet allows the smell and a sip"] }),
  prompt("Lemonade at the picnic", "late", 1960, ["taste"], ["summer"], "Lemonade at a picnic on a warm day: cool and sweet.", ["Sweet or tart?", "Cold in the cup."], { steps: [TASTE_STEP] }),
  prompt("Folk songs and guitars", "early", 1960, ["sound"], ["music"], "Guitars and folk songs were everywhere in the early 1960s. Tell me about singing or playing in those days.", ["Who played?", "Which song did everyone know?"]),
  prompt("The family station wagon", "universal", 1960, ["sight"], ["road-trips"], "The station wagon carried the whole family on vacation. Tell me about a family vacation.", ["Window seat, or the middle?", "A picnic, or a stop at a diner?"]),
  prompt("A crocheted blanket", "late", 1960, ["touch"], ["home-kitchen"], "Handmade crocheted blankets were found in many living rooms. Feel the soft yarn: warm and cozy.", ["Soft yarn.", "Cozy in the chair."], { materials: ["A crocheted afghan or soft yarn"] }),
  prompt("Learning the Twist", "middle", 1960, ["sound"], ["music"], "The Twist dance craze began in 1960. Tell me about dancing in those days.", ["Where did you dance?", "Who was the best dancer?"]),
  // ---------------- 1970s ----------------
  prompt("Disco nights", "early", 1970, ["sound"], ["music"], "Disco filled dance floors in the late 1970s. Tell me about a night of dancing.", ["What did you wear?", "Who did you go with?"]),
  prompt("Harvest gold and avocado green", "universal", 1970, ["sight"], ["home-kitchen"], "Kitchens in the 1970s were often harvest gold or avocado green. Tell me about the color of your kitchen.", ["The stove, or the refrigerator?", "Cooking on your own, or with company?"]),
  prompt("The CB radio", "universal", 1970, ["sound"], ["road-trips"], "Truckers and families used CB radios in the 1970s. Tell me about road trips in those days.", ["A CB handle, or just a radio?", "A short trip, or a long one?"]),
  prompt("Shag carpet", "middle", 1970, ["touch"], ["home-kitchen"], "Shag carpet was soft underfoot. Feel this shaggy fabric: what was the carpet like at home?", ["What color was it?", "Who vacuumed it?"], { materials: ["A shaggy fabric or fleece swatch"] }),
  prompt("Fondue and Jell-O", "universal", 1970, ["taste"], ["home-kitchen"], "Fondue pots and Jell-O molds were dinner party favorites. Tell me about a dinner you hosted or enjoyed.", ["A small party, or a big one?", "Fondue, or Jell-O?"], { steps: [TASTE_STEP] }),
  prompt("Bread in the oven", "late", 1970, ["smell"], ["home-kitchen"], "Homemade bread in the oven smells like home. Warm and sweet.", ["Warm, fresh bread.", "The kitchen on a cold day."], { materials: ["A loaf of fresh bread, if the diet allows"], steps: [TASTE_STEP] }),
  prompt("Saturday morning cartoons", "early", 1970, ["sight"], [], "Saturday morning cartoons, with a bowl of cereal, were a ritual for many children. What was Saturday morning like at your house?", ["Who woke up first?", "What was the favorite show?"]),
  prompt("The Mary Tyler Moore Show", "early", 1970, ["sound", "sight"], [], "The Mary Tyler Moore Show ran from 1970 to 1977. Tell me about a favorite show of that decade.", ["Who watched with you?", "Which theme song could you hum?"]),
  prompt("Macramé and plant hangers", "middle", 1970, ["touch"], ["garden"], "Macramé plant hangers hung in many windows. Feel this knotted cord: did anyone you know make them?", ["What plant hung in yours?", "Who taught you to knot?"], { materials: ["A length of knotted cord"] }),
  prompt("Iced tea on the porch", "late", 1970, ["taste", "smell"], ["summer"], "A cold glass of iced tea on the porch: cool and refreshing.", ["Lemon, or plain?", "Cool in the glass."], { steps: [TASTE_STEP] }),
];
