/* =====================================================================
   COGNICOPIA_COLORING PROMPT ENGINE AND DIGNITY FILTER
   Builds strict line-art prompts for image generators (Midjourney, Stable
   Diffusion, DALL-E 3) so new artwork arrives already close to the
   Cognicopia Coloring print standard, and checks any title, tag, caption or prompt
   for childish, quizzing or talking-down language.

   Nothing here calls a generator or any other service: it only writes
   text. Staff paste a prompt into the tool they use, or run
   scripts/coloring_prompts.mjs for a batch, then bring the images back in
   with scripts/ingest_coloring_assets.mjs, which checks and normalizes
   them and holds them for review before they reach any resident.
   Runs as a plain browser script and in Node (vm).
   ===================================================================== */
(function(root){
"use strict";

var POSITIVE = "Professional print-ready black-and-white vector line-art coloring page for adults, {SUBJECT}, crisp continuous paths, mechanically and anatomically coherent proportions, clean black contours enclosing every colorable region, intentional interior dividers that meet contours cleanly, consistent line weight, pure black ink on pure white, 0% grayscale shading, no pencil texture, no cross-hatching, no stray or overlapping strokes, no lines bleeding beyond boundaries, uncluttered 3:4 portrait composition, dignity-first adult coloring page";
var NEGATIVE = [
  "shading", "grayscale", "color", "gray fills", "gradients", "transparency", "realistic photo",
  "thin or broken lines", "sketchy lines", "pencil texture", "cross-hatching", "complex hatch shading",
  "stray strokes", "bleeding lines", "open or unclosed contours", "floating line artifacts",
  "distorted geometry", "overlapping messy strokes", "lines extending beyond shape boundaries",
  "cluttered background", "extra limbs", "childish", "cartoon faces", "tiny details", "noise", "blur",
  "text", "letters", "watermark", "frame"
];
var CATEGORY_WORDS = {
  "classic-vehicles":"mechanically plausible vehicle proportions, aligned wheels with clean hubs, coherent body panels, trim that follows the body without stray overlaps",
  "botanical-garden":"botanically coherent plant structure, natural leaf attachment, smooth enclosed leaf silhouettes, continuous unbroken leaf veins",
  "wildlife-nature":"recognizable natural anatomy and balanced proportions, clean enclosed body and wing shapes, no duplicated or disconnected parts",
  "nostalgic-heritage":"recognizable era-appropriate object proportions and construction, clean joined contours, consistent perspective",
  "architecture":"structurally coherent architectural perspective, aligned doors and windows, straight continuous roof and wall contours",
  "home-everyday":"recognizable everyday-object proportions, coherent construction and handles, clean enclosed silhouettes",
  "bold-easy-patterns":"regular repeating geometry, aligned pattern edges, evenly spaced enclosed regions"
};
/* What each tier asks of the picture, in words a generator follows. */
var TIER_WORDS = {
  1: { add:"Early Tier: high visual interest with accurate structural detail, crisp medium-bold outer contours, defined colorable internal zones, 30 to 60 clearly enclosed colorable areas", neg:[] },
  2: { add:"Middle Tier: one clear subject, bold outer contours, simplified interior detail, zero background clutter, clear figure-ground separation, balanced negative space, 12 to 30 large enclosed colorable areas", neg:["busy background"] },
  3: { add:"Late Tier: one iconic focal subject only, ultra-thick high-contrast outlines, ultra-simplified bold geometry, maximum-size coloring targets, only 4 to 12 very large enclosed colorable areas, nothing in the background", neg:["background scenery", "small parts", "fine interior lines", "text"] }
};
var GENERATORS = {
  "midjourney":       { label:"Midjourney",             note:"Paste into /imagine. --ar sets the 3:4 page; --no lists what to leave out." },
  "stable-diffusion": { label:"Stable Diffusion / SDXL", note:"Put the negative prompt in its own box. 1536 x 2048 keeps the 3:4 page." },
  "dall-e-3":         { label:"DALL-E 3",               note:"DALL-E has no negative prompt, so the things to avoid are written into the request." }
};

/* Build the prompt for one subject at one tier. */
function build(subject, tier, generator, category){
  tier = TIER_WORDS[tier] ? tier : 2;
  var subj = String(subject || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  var categoryRule = CATEGORY_WORDS[category] || "";
  var positive = POSITIVE.replace("{SUBJECT}", subj) + (categoryRule ? ", " + categoryRule : "") + ", " + TIER_WORDS[tier].add;
  var negative = NEGATIVE.concat(TIER_WORDS[tier].neg);
  var out = { subject:subj, category:category || null, tier:tier, positive:positive, negative:negative };
  out.text = format(out, generator || "midjourney");
  return out;
}
function format(p, generator){
  if (generator === "stable-diffusion") return "Prompt: " + p.positive + "\nNegative prompt: " + p.negative.join(", ") + "\nSize: 1536 x 2048 (3:4)";
  if (generator === "dall-e-3") return p.positive + ". Avoid: " + p.negative.join(", ") + ". A tall portrait page, 3:4.";
  return p.positive + " --ar 3:4 --no " + p.negative.join(", ");
}
/* All three generators at once, for a design or a free subject. */
function buildAll(subject, tier, category){
  var base = build(subject, tier, null, category), out = { subject:base.subject, category:base.category, tier:base.tier, positive:base.positive, negative:base.negative, prompts:{} };
  Object.keys(GENERATORS).forEach(function(k){ out.prompts[k] = format(base, k); });
  return out;
}

/* ---------- dignity-first filter ----------
   Words that make an adult's page read as a child's, memory-quiz openings
   that test rather than invite, and pet names that talk down. Checked on
   subjects, titles, tags and captions: never on the negative prompt, which
   names these things on purpose to keep them out. */
var JUVENILE = ["cute", "cutesy", "kawaii", "chibi", "cartoon", "cartoonish", "cartoony", "baby", "babies", "toddler", "nursery", "kiddie", "kiddy", "kids",
  "for children", "children's", "childish", "childlike", "smiley", "smiling face", "happy face", "funny face", "silly", "googly", "teddy", "teddy bear", "unicorn",
  "princess", "fairy", "fairies", "clown", "emoji", "mascot", "anime", "manga", "big eyes", "puppy eyes", "doodle", "cupcake", "lollipop", "kitty", "doggy", "bunny", "piggy", "ducky"];
var QUIZ = ["do you remember", "can you remember", "don't you remember", "try to remember", "remember when", "what year was", "can you name", "name the", "quiz", "test your"];
var ELDERSPEAK = ["sweetie", "dearie", "sweetheart", "good girl", "good boy", "little old", "oldie", "golden oldie", "young lady", "young man"];
/* pet names that are also ordinary words (honey, dear, hon) count only when
   they address someone: "Thank you, honey." but not "sweeten with honey" */
var VOCATIVE = /(?:^|[,.!?;]\s*)(honey|dear|hon|sugar)\s*[,.!?]|,\s*(honey|dear|hon|sugar)\b/i;
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function dignityCheck(text){
  var t = " " + String(text || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ") + " ";
  var hits = [];
  [["juvenile", JUVENILE], ["memory-test", QUIZ], ["elderspeak", ELDERSPEAK]].forEach(function(set){
    set[1].forEach(function(w){ if (new RegExp(" " + escRe(w) + " ").test(t)) hits.push({ term:w, kind:set[0] }); });
  });
  var v = VOCATIVE.exec(String(text || ""));
  if (v) hits.push({ term:(v[1] || v[2]).toLowerCase(), kind:"elderspeak" });
  return hits;
}

/* ---------- subjects for new artwork ----------
   Ideas for the next pages to generate: adult, familiar, era-true and
   easy to draw in bold lines. [category, subject, tags, best tiers] */
var IDEAS = [
  ["classic-vehicles", "a 1955 two-tone hardtop sedan seen from the side on a quiet street", ["cars", "1950s"], [1, 2, 3]],
  ["classic-vehicles", "a 1920s open touring car with spoked wheels", ["cars", "1920s"], [1, 2]],
  ["classic-vehicles", "a rounded 1960s camper van seen from the side", ["vans", "1960s", "road-trips"], [1, 2, 3]],
  ["classic-vehicles", "a 1940s milk delivery truck", ["trucks", "1940s", "deliveries"], [1, 2, 3]],
  ["classic-vehicles", "a farm tractor pulling a hay wagon", ["farm", "tractors"], [1, 2]],
  ["classic-vehicles", "a paddle-wheel riverboat", ["boats", "rivers"], [1, 2]],
  ["classic-vehicles", "a wooden canoe resting at the edge of a lake", ["boats", "lakes"], [2, 3]],
  ["classic-vehicles", "a vintage filling station pump", ["gas-stations", "1950s"], [2, 3]],
  ["classic-vehicles", "a classic city bus from the 1950s", ["buses", "city", "1950s"], [1, 2]],
  ["classic-vehicles", "a propeller airliner parked on the runway", ["airplanes", "travel"], [1, 2]],
  ["classic-vehicles", "a horse-drawn buggy on a country lane", ["buggies", "horses", "country"], [1, 2]],
  ["classic-vehicles", "a steam engine crossing a stone bridge", ["trains", "bridges"], [1]],
  ["classic-vehicles", "a 1950s station wagon loaded for a picnic", ["cars", "picnics", "1950s"], [1, 2]],
  ["classic-vehicles", "a vintage motorcycle with a sidecar", ["motorcycles"], [1, 2]],
  ["classic-vehicles", "a fishing trawler in the harbor", ["boats", "harbors"], [1, 2]],
  ["classic-vehicles", "a classic pickup truck with a Christmas tree in the bed", ["trucks", "winter", "holidays"], [1, 2]],
  ["classic-vehicles", "a sleigh with runners in the snow", ["sleighs", "winter"], [1, 2, 3]],
  ["classic-vehicles", "a lighthouse tender boat", ["boats", "coast"], [1, 2]],
  ["classic-vehicles", "a tandem bicycle for two", ["bicycles"], [1, 2]],
  ["classic-vehicles", "a mail truck with a rounded hood", ["mail", "trucks"], [2, 3]],
  ["botanical-garden", "a bouquet of peonies in a china pitcher", ["peonies", "vases"], [1, 2, 3]],
  ["botanical-garden", "a sprig of lilacs in a mason jar", ["lilacs", "spring"], [1, 2]],
  ["botanical-garden", "a climbing rose on a white trellis", ["roses", "trellis"], [1, 2]],
  ["botanical-garden", "morning glories along a picket fence", ["morning-glories", "fences"], [1, 2]],
  ["botanical-garden", "a single iris bloom with long leaves", ["iris", "spring"], [2, 3]],
  ["botanical-garden", "a bundle of lavender tied with a ribbon", ["lavender", "herbs"], [1, 2]],
  ["botanical-garden", "hollyhocks growing against a garden wall", ["hollyhocks", "summer"], [1, 2]],
  ["botanical-garden", "a pear tree branch with two ripe pears", ["pears", "fruit"], [2, 3]],
  ["botanical-garden", "tomato plants with ripe tomatoes in a garden bed", ["tomatoes", "vegetables"], [1, 2]],
  ["botanical-garden", "a basket of fresh peaches", ["peaches", "fruit"], [1, 2, 3]],
  ["botanical-garden", "a potted Boston fern on a stand", ["ferns", "houseplants"], [1, 2]],
  ["botanical-garden", "a large single camellia blossom", ["camellia", "flowers"], [2, 3]],
  ["botanical-garden", "a cluster of cherry blossoms on a branch", ["blossoms", "spring"], [1, 2]],
  ["botanical-garden", "a bowl of lemons with leaves", ["lemons", "fruit"], [2, 3]],
  ["botanical-garden", "a window box full of petunias", ["petunias", "window-boxes"], [1, 2]],
  ["botanical-garden", "a pumpkin, gourds and corn stalks for autumn", ["autumn", "harvest"], [1, 2]],
  ["botanical-garden", "holly leaves and berries", ["holly", "winter"], [1, 2, 3]],
  ["botanical-garden", "a poinsettia in a clay pot", ["poinsettia", "winter"], [2, 3]],
  ["botanical-garden", "a cornflower and wheat bouquet", ["wildflowers", "harvest"], [1, 2]],
  ["botanical-garden", "a strawberry patch with blossoms", ["strawberries", "spring"], [1, 2]],
  ["nostalgic-heritage", "an antique candlestick telephone", ["telephones", "1920s"], [2, 3]],
  ["nostalgic-heritage", "a jukebox with rounded top", ["music", "1950s"], [1, 2]],
  ["nostalgic-heritage", "a hand-crank ice cream maker on a porch", ["ice-cream", "summer"], [1, 2]],
  ["nostalgic-heritage", "a kerosene lantern", ["lanterns"], [2, 3]],
  ["nostalgic-heritage", "an old-fashioned brass cash register", ["stores", "shops"], [1, 2]],
  ["nostalgic-heritage", "a farmhouse hand water pump with a bucket", ["farm", "water"], [1, 2, 3]],
  ["nostalgic-heritage", "a quilt folded over a wooden quilt rack", ["quilts", "home"], [1, 2]],
  ["nostalgic-heritage", "a mantel clock with a rounded top", ["clocks"], [2, 3]],
  ["nostalgic-heritage", "a milk can on a farm porch", ["farm", "dairy"], [2, 3]],
  ["nostalgic-heritage", "a general store front with a striped awning", ["stores", "towns"], [1, 2]],
  ["nostalgic-heritage", "a one-room schoolhouse with a bell tower", ["schools", "landmarks"], [1, 2]],
  ["nostalgic-heritage", "a gazebo bandstand in a town park", ["parks", "music"], [1, 2]],
  ["nostalgic-heritage", "a soda fountain glass with a straw and a cherry", ["soda-fountain", "1950s"], [2, 3]],
  ["nostalgic-heritage", "a wind-up alarm clock with two bells", ["clocks", "mornings"], [2, 3]],
  ["nostalgic-heritage", "a hand-cranked coffee grinder", ["coffee", "kitchen"], [1, 2]],
  ["nostalgic-heritage", "a wooden rolling pin and flour sifter", ["baking", "kitchen"], [2, 3]],
  ["nostalgic-heritage", "a vintage suitcase with travel stickers shapes and no words", ["travel", "luggage"], [1, 2]],
  ["nostalgic-heritage", "a hat box with a ribbon and a Sunday hat", ["hats", "fashion"], [1, 2]],
  ["nostalgic-heritage", "a wooden radio console in a living room corner", ["radio", "home"], [1, 2]],
  ["nostalgic-heritage", "a church-free country chapel-style town hall with a clock", ["towns", "landmarks"], [1, 2]],
  ["wildlife-nature", "a blue jay perched on a bird feeder", ["birds", "blue-jays"], [1, 2, 3]],
  ["wildlife-nature", "a pair of mourning doves on a wire", ["birds", "doves"], [1, 2]],
  ["wildlife-nature", "a white-tailed deer standing in a meadow, side view", ["deer", "meadows"], [1, 2]],
  ["wildlife-nature", "a horse's head in profile with a flowing mane", ["horses"], [1, 2, 3]],
  ["wildlife-nature", "a Holstein cow standing in a pasture", ["cows", "farm"], [1, 2]],
  ["wildlife-nature", "a painted turtle resting on a log", ["turtles", "ponds"], [2, 3]],
  ["wildlife-nature", "a trout leaping from a stream", ["fish", "streams"], [1, 2]],
  ["wildlife-nature", "a great blue heron wading in the reeds", ["birds", "herons"], [1, 2]],
  ["wildlife-nature", "a goldfinch on a thistle", ["birds", "finches"], [1, 2]],
  ["wildlife-nature", "a honeybee on a clover blossom, realistic proportions", ["bees", "flowers"], [1, 2]],
  ["wildlife-nature", "a squirrel holding an acorn, natural pose", ["squirrels", "autumn"], [1, 2]],
  ["wildlife-nature", "a loon on a calm lake at dawn", ["birds", "lakes"], [1, 2]],
  ["wildlife-nature", "a hen sitting on her nest box", ["hens", "farm"], [1, 2, 3]],
  ["wildlife-nature", "a scallop shell and starfish on sand", ["shells", "beach"], [2, 3]],
  ["wildlife-nature", "a pinecone and evergreen branch", ["pine", "winter"], [2, 3]],
  ["wildlife-nature", "a dragonfly resting on a cattail", ["dragonflies", "ponds"], [2, 3]],
  ["wildlife-nature", "a pair of cardinals in a snowy pine", ["birds", "winter"], [1, 2]],
  ["wildlife-nature", "a sleeping fox curled in the grass", ["foxes"], [1, 2]],
  ["wildlife-nature", "a sailboat harbor with gulls, simple shapes", ["harbors", "gulls"], [1]],
  ["wildlife-nature", "a waterfall between two pine trees", ["waterfalls", "forests"], [1, 2]],
  ["bold-easy-patterns", "a Double Wedding Ring quilt block", ["quilts"], [1, 2]],
  ["bold-easy-patterns", "a Bear's Paw quilt block", ["quilts"], [1, 2]],
  ["bold-easy-patterns", "a Lone Star quilt center", ["quilts", "stars"], [1, 2, 3]],
  ["bold-easy-patterns", "an Art Nouveau floral tile", ["tiles", "art-nouveau"], [1, 2]],
  ["bold-easy-patterns", "a simple Celtic knot circle with wide bands", ["knots"], [1, 2]],
  ["bold-easy-patterns", "a rose window of stained glass", ["stained-glass"], [1, 2, 3]],
  ["bold-easy-patterns", "a paisley medallion with large shapes", ["paisley"], [1, 2]],
  ["bold-easy-patterns", "a checkerboard of large squares with flowers in every other square", ["checkerboard"], [2, 3]],
  ["bold-easy-patterns", "a folk-art tulip border pattern", ["folk-art", "tulips"], [1, 2]],
  ["bold-easy-patterns", "a Pennsylvania Dutch hex sign star", ["folk-art", "stars"], [2, 3]],
  ["bold-easy-patterns", "a ring of large leaves around a circle", ["leaves", "wreaths"], [2, 3]],
  ["bold-easy-patterns", "a sunflower mandala with large petals", ["mandalas", "sunflowers"], [2, 3]],
  ["bold-easy-patterns", "a Victorian tile with a four-petal flower", ["tiles"], [2, 3]],
  ["bold-easy-patterns", "a basket-weave pattern of wide strips", ["weaving"], [1, 2]],
  ["bold-easy-patterns", "a snowflake with six wide arms", ["snowflakes", "winter"], [2, 3]],
  ["bold-easy-patterns", "a carousel-style medallion with scallops", ["medallions"], [1, 2]],
  ["bold-easy-patterns", "a lattice of hexagons with a flower in the middle", ["hexagons"], [1, 2]],
  ["bold-easy-patterns", "an Amish diamond-in-a-square quilt", ["quilts", "amish"], [2, 3]],
  ["bold-easy-patterns", "a heart-in-hand folk-art motif", ["folk-art"], [2, 3]],
  ["bold-easy-patterns", "a large compass star inside a circle", ["compass", "stars"], [2, 3]],
  ["home-everyday", "a fresh loaf of bread on a cutting board", ["baking", "bread"], [2, 3]],
  ["home-everyday", "a pie cooling on a windowsill", ["baking", "pies"], [1, 2, 3]],
  ["home-everyday", "a knitting project with needles and a ball of yarn", ["knitting"], [1, 2]],
  ["home-everyday", "a shoeshine kit with brush and polish tin", ["shoes", "grooming"], [1, 2]],
  ["home-everyday", "a picnic table set with a checked cloth", ["picnics"], [1, 2]],
  ["home-everyday", "folded towels in a wicker laundry basket", ["laundry"], [2, 3]],
  ["home-everyday", "canning jars, a funnel and fruit on the counter", ["canning", "kitchen"], [1, 2]],
  ["home-everyday", "a garden hat, gloves and trowel on a bench", ["gardening"], [1, 2]],
  ["home-everyday", "a birdhouse on a workbench with a paintbrush", ["woodworking", "birdhouses"], [1, 2]],
  ["home-everyday", "a toolbox with a hammer, saw and level", ["tools", "woodworking"], [1, 2]],
  ["home-everyday", "a mixing bowl with a wooden spoon and eggs", ["baking"], [2, 3]],
  ["home-everyday", "a coffee pot and two mugs on a table", ["coffee", "friends"], [2, 3]],
  ["home-everyday", "a jigsaw puzzle partly finished on a table", ["puzzles", "games"], [1, 2]],
  ["home-everyday", "a checkerboard with checkers", ["checkers", "games"], [1, 2]],
  ["home-everyday", "a hymnal-free songbook and a piano bench", ["music", "piano"], [1, 2]],
  ["home-everyday", "a watering can and a row of seedlings", ["gardening"], [2, 3]],
  ["home-everyday", "a lunch pail and thermos", ["work", "lunch"], [2, 3]],
  ["home-everyday", "a rocking chair with a folded blanket", ["resting", "home"], [2, 3]],
  ["home-everyday", "a clothespin bag hanging on a line", ["laundry"], [2, 3]],
  ["home-everyday", "a fishing tackle box open with lures", ["fishing"], [1, 2]]
];

/* The subject to ask a generator for, for one of the library's own designs. */
function subjectFor(d){
  if (!d) return "";
  if (d.aiSubject) return d.aiSubject;
  var t = String(d.title).replace(/^(The|A|An)\s+/, "").toLowerCase();
  return (d.era ? d.era + " " : "") + t + (d.cat === "bold-easy-patterns" && !/pattern|quilt/.test(t) ? " pattern" : "");
}
function slug(s){
  var t = String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (t.length > 48){ t = t.slice(0, 49); t = t.slice(0, t.lastIndexOf("-") > 20 ? t.lastIndexOf("-") : 48); }   // whole words only
  return t;
}
/* A generation job: one subject, one tier, every generator's prompt. */
function job(o){
  var p = buildAll(o.subject, o.tier, o.category);
  return {
    job_id: "ai-" + o.category + "-" + slug(String(o.title || o.subject).replace(/^(the|a|an)\s+/i, "")) + "-t" + p.tier,
    title: o.title || (o.subject.charAt(0).toUpperCase() + o.subject.slice(1)),
    subject: p.subject, category: o.category, tier: p.tier, tags: (o.tags || []).slice(),
    source: o.source || "idea", design_id: o.design_id || null,
    positive: p.positive, negative: p.negative, prompts: p.prompts,
    expect: { aspect_ratio:"3:4", minimum_dpi:300, color_mode:"1-bit black and white", line_weight:["", "thick", "ultra-bold", "extra-bold-sensory"][p.tier], review:"required before use" },
    dignity: dignityCheck(o.subject + " " + (o.title || "") + " " + (o.tags || []).join(" "))
  };
}

root.CognicopiaColoringPrompts = {
  POSITIVE:POSITIVE, NEGATIVE:NEGATIVE, TIER_WORDS:TIER_WORDS, GENERATORS:GENERATORS, IDEAS:IDEAS,
  build:build, buildAll:buildAll, format:format, dignityCheck:dignityCheck, subjectFor:subjectFor, job:job, slug:slug,
  JUVENILE:JUVENILE, QUIZ:QUIZ, ELDERSPEAK:ELDERSPEAK
};
})(typeof globalThis !== "undefined" ? globalThis : this);
