/* Cognicopia Coloring packs: themed bundles of designs that print together
   at one tier (a resident's own, or the pack's recommendation). A design
   can sit in several packs. Add a pack by listing design ids; the checks
   (scripts/check-coloring.mjs) confirm every id exists. */
(function(C){
"use strict";
function pack(id, title, theme, about, designs, tier){ C.definePack({ id:id, title:title, theme:theme, about:about, designs:designs, tier:tier || 0 }); }

/* Classic vehicles */
pack("sunday-drive", "Sunday Drive", "classic-vehicles", "Cars made for a slow drive: the sedan, the convertible, the woody wagon and a scooter.",
  ["sunday-sedan", "convertible", "woody-wagon", "motor-scooter"]);
pack("working-wheels", "Working Wheels", "classic-vehicles", "Trucks and machines that did the day's work: the pickup, the bakery truck, the fire engine and the tractor.",
  ["farm-pickup", "bread-truck", "fire-engine", "farm-tractor"]);
pack("rails-and-roads", "Rails and Roads", "classic-vehicles", "Ways to get across town or across the country: the steam train, the streetcar and a bicycle.",
  ["steam-locomotive", "streetcar", "bread-truck", "vintage-bicycle"]);
pack("on-the-water", "On the Water", "classic-vehicles", "Boats and the places they sail from.",
  ["lake-sailboat", "tugboat", "lighthouse", "swan-lake"]);
pack("up-in-the-sky", "Up in the Sky", "classic-vehicles", "Things that fly or turn in the wind.",
  ["biplane", "hot-air-balloon", "farm-windmill", "monarch-butterfly"]);

/* Botanical and garden */
pack("spring-garden", "The Spring Garden", "botanical-garden", "The first flowers and visitors of spring.",
  ["tulips-vase", "daffodils", "magnolia-branch", "robin-fence", "bluebird-house"]);
pack("rose-garden", "The Rose Garden", "botanical-garden", "Roses, the gate they climb and the can that waters them.",
  ["garden-rose", "garden-gate", "watering-can", "porch-geranium"]);
pack("summer-blooms", "Summer Blooms", "botanical-garden", "Big, bright summer flowers.",
  ["sunflower", "poppies", "daisy-jar", "dahlia", "hydrangea"]);
pack("flowers-for-the-table", "Flowers for the Table", "botanical-garden", "Cut flowers and a table set for guests.",
  ["tulips-vase", "calla-lilies", "daisy-jar", "table-setting"]);
pack("autumn-leaves", "Autumn Leaves", "botanical-garden", "Leaves, acorns, apples and pumpkins of the fall.",
  ["autumn-maple", "oak-acorns", "pumpkin-patch", "apple-branch"]);
pack("orchard-harvest", "The Orchard Harvest", "botanical-garden", "Fruit from the tree, the patch and the jar.",
  ["apple-branch", "fruit-bowl", "strawberries", "canning-jars", "harvest-basket"]);
pack("kitchen-garden", "The Kitchen Garden", "botanical-garden", "Herbs and vegetables grown for the table.",
  ["windowsill-herbs", "harvest-basket", "potting-bench", "garden-wheelbarrow"]);
pack("garden-tools", "In the Garden Shed", "botanical-garden", "The tools of a good garden.",
  ["watering-can", "garden-wheelbarrow", "potting-bench", "garden-gate"]);
pack("water-garden", "The Water Garden", "botanical-garden", "Lilies, koi and the life of a quiet pond.",
  ["water-lily", "koi-pond", "dragonfly-reeds", "swan-lake"]);

/* Nostalgic heritage */
pack("grandmothers-kitchen", "Grandmother's Kitchen", "nostalgic-heritage", "Teapots, percolators, mixers and jars from a well-used kitchen.",
  ["teapot-and-cup", "coffee-percolator", "stand-mixer", "chrome-toaster", "wood-cookstove", "canning-jars"]);
pack("the-parlor", "The Parlor", "nostalgic-heritage", "The radio, the phonograph and a chair by the lamp.",
  ["cathedral-radio", "phonograph", "rocking-chair", "oil-lamp", "grandfather-clock"]);
pack("timepieces", "Timepieces", "nostalgic-heritage", "Clocks and a watch, with plain faces and bold hands.",
  ["grandfather-clock", "schoolhouse-clock", "pocket-watch"]);
pack("sewing-room", "The Sewing Room", "nostalgic-heritage", "Machines, baskets and the quilts they made.",
  ["sewing-machine", "sewing-basket", "knitting-basket", "quilt-nine-patch"]);
pack("keeping-in-touch", "Keeping in Touch", "nostalgic-heritage", "Telephones, typewriters, letters and the mailbox at the end of the lane.",
  ["rotary-telephone", "typewriter", "rural-mailbox", "letter-writing", "box-camera"]);
pack("down-on-the-farm", "Down on the Farm", "nostalgic-heritage", "The barn, the windmill, the churn and the rooster.",
  ["red-barn", "farm-windmill", "butter-churn", "milk-bottles", "proud-rooster", "farm-tractor"]);
pack("front-porch", "The Front Porch", "nostalgic-heritage", "A swing, a rocker, a potted geranium and good company.",
  ["porch-swing", "rocking-chair", "porch-geranium", "faithful-dog", "sleeping-cat"]);
pack("landmarks", "Landmarks", "nostalgic-heritage", "Lighthouses, covered bridges, barns and mountain lakes.",
  ["lighthouse", "covered-bridge", "red-barn", "farm-windmill", "mountain-lake"]);
pack("good-morning", "Good Morning", "nostalgic-heritage", "Milk on the step, the paper, coffee and toast.",
  ["milk-bottles", "bread-truck", "sunday-paper", "coffee-percolator", "chrome-toaster"]);

/* Wildlife and nature */
pack("backyard-birds", "Backyard Birds", "wildlife-nature", "Cardinals, robins, chickadees, bluebirds and a hummingbird.",
  ["cardinal-branch", "robin-fence", "chickadee-pine", "bluebird-house", "hummingbird"]);
pack("butterfly-garden", "The Butterfly Garden", "wildlife-nature", "Flowers and the wings that visit them.",
  ["monarch-butterfly", "hummingbird", "sunflower", "dahlia", "dragonfly-reeds"]);
pack("pond-life", "Pond Life", "wildlife-nature", "Ducks, swans, koi and dragonflies.",
  ["mallard-duck", "swan-lake", "koi-pond", "dragonfly-reeds", "water-lily"]);
pack("seashore", "The Seashore", "wildlife-nature", "Shells, a sea turtle and the lighthouse on the point.",
  ["seashells", "nautilus-shell", "sea-turtle", "lighthouse", "tugboat"]);
pack("faithful-companions", "Faithful Companions", "wildlife-nature", "A dog, a cat and a rabbit in the garden.",
  ["faithful-dog", "sleeping-cat", "garden-rabbit"]);
pack("woodland-walk", "A Woodland Walk", "wildlife-nature", "Owls, pine cones, oak leaves and a mountain lake.",
  ["barn-owl", "pine-cones", "oak-acorns", "mountain-lake", "chickadee-pine"]);
pack("farmyard", "The Farmyard", "wildlife-nature", "The rooster, the barn and the animals around it.",
  ["proud-rooster", "red-barn", "faithful-dog", "garden-rabbit", "butter-churn"]);

/* Bold and easy patterns */
pack("quilting-bee-stars", "Quilting Bee: Stars", "bold-easy-patterns", "Star quilt blocks: Ohio Star, Sawtooth Star, Friendship Star and Churn Dash.",
  ["quilt-ohio-star", "quilt-sawtooth-star", "quilt-friendship-star", "quilt-churn-dash"]);
pack("quilting-bee-classics", "Quilting Bee: Classics", "bold-easy-patterns", "Everyday blocks: Nine Patch, Pinwheel, Log Cabin, Rail Fence and Flying Geese.",
  ["quilt-nine-patch", "quilt-pinwheel", "quilt-log-cabin", "quilt-rail-fence", "quilt-flying-geese"]);
pack("heirloom-quilts", "Heirloom Quilts", "bold-easy-patterns", "The quilts that get handed down.",
  ["quilt-grandmothers-garden", "quilt-dresden-plate", "quilt-log-cabin", "quilt-ohio-star"]);
pack("calm-circles", "Calm Circles", "bold-easy-patterns", "Rosettes, medallions and a compass: round, even and calm.",
  ["garden-rosette", "lotus-medallion", "compass-rose", "sunburst-medallion", "kaleidoscope"]);
pack("glass-and-tile", "Glass and Tile", "bold-easy-patterns", "Stained glass, scallops, honeycomb, trellis and fans.",
  ["stained-glass-window", "fish-scale-tiles", "honeycomb", "quatrefoil-lattice", "art-deco-fans"]);
pack("easy-bold-starter", "Easy Bold Starter", "bold-easy-patterns", "Big, clear patterns with only a few areas each, for a first session or a tired day.",
  ["sunburst-medallion", "quilt-nine-patch", "honeycomb", "garden-rosette", "compass-rose"], 3);

/* Zentangle and mandalas */
pack("zentangle-patterns", "Zentangle Patterns", "zentangle-mandalas", "Zentangle-style tangles: woven ribbons, crescent moons, spirals, pebbles, waves, looping petals and a sampler tile.",
  ["zen-woven-ribbons", "zen-crescent-moon", "zen-spiral-garden", "zen-river-pebbles", "zen-rolling-waves", "zen-looping-petals", "zen-tangle-sampler"]);
pack("mandala-collection", "The Mandala Collection", "zentangle-mandalas", "Symmetrical mandalas: an heirloom rosette, a star, a lace doily, hearts and a sunflower.",
  ["mandala-heirloom", "mandala-star", "mandala-doily", "mandala-hearts", "mandala-sunflower"]);
pack("gentle-tangles", "Gentle Tangles", "zentangle-mandalas", "The calmest tangles and mandalas, in a few big pieces for a tired day.",
  ["zen-rolling-waves", "zen-spiral-garden", "zen-river-pebbles", "zen-looping-petals", "mandala-sunflower"], 3);

/* Vintage Americana */
pack("main-street", "Main Street", "vintage-americana", "The jukebox, the soda fountain, the filling station and the ballgame.",
  ["jukebox", "ice-cream-soda", "gas-pump", "ballgame", "liberty-bell"]);
pack("county-fair", "The County Fair", "vintage-americana", "The Ferris wheel, a blue ribbon, apple pie and a barn quilt on the way home.",
  ["ferris-wheel", "blue-ribbon", "apple-pie", "barn-quilt", "porch-bunting"]);

/* Holidays through the year */
pack("holidays-first-half", "Holidays: Winter to Summer", "seasons-holidays", "Valentine's Day, St. Patrick's Day, Easter, the first day of spring and the Fourth of July.",
  ["valentine-heart", "shamrock-pot", "easter-basket", "spring-wreath", "porch-bunting"]);
pack("holidays-second-half", "Holidays: Fall and Winter", "seasons-holidays", "Halloween, Thanksgiving, Christmas and the first snow.",
  ["jack-o-lantern", "cornucopia", "holiday-wreath", "ornaments", "snowman"]);

/* Home and everyday tasks */
pack("tea-time", "Tea Time", "home-everyday", "Cups, pots, a laid table and something baked.",
  ["tea-for-two", "teapot-and-cup", "table-setting", "baking-day"]);
pack("baking-day", "Baking Day", "home-everyday", "Pies, mixers, the cookstove and the fruit that goes in.",
  ["baking-day", "stand-mixer", "wood-cookstove", "apple-branch", "canning-jars"]);
pack("needle-arts", "Needle Arts", "home-everyday", "Knitting, sewing and the quilts they make.",
  ["knitting-basket", "sewing-basket", "sewing-machine", "quilt-dresden-plate"]);
pack("letter-day", "A Letter Day", "home-everyday", "Writing, typing, calling and the mailbox.",
  ["letter-writing", "rural-mailbox", "typewriter", "rotary-telephone"]);
pack("picnic-in-the-park", "A Picnic in the Park", "home-everyday", "A basket, berries, a sailboat and a bicycle ride.",
  ["picnic-basket", "strawberries", "lake-sailboat", "vintage-bicycle"]);
pack("gone-fishing", "Gone Fishing", "home-everyday", "A quiet day on the water.",
  ["gone-fishing", "lake-sailboat", "mountain-lake", "tugboat"]);
pack("wash-day", "Wash Day and Rest", "home-everyday", "Laundry on the line, the iron, the sewing basket and the porch swing after.",
  ["clothesline", "ironing-day", "sewing-basket", "porch-swing"]);
pack("game-night", "Game Night", "home-everyday", "Cards, dominoes, music and tea with friends.",
  ["cards-and-dominoes", "cathedral-radio", "phonograph", "tea-for-two"]);
pack("keeping-house", "Keeping House", "home-everyday", "The work of a home, done well.",
  ["table-setting", "baking-day", "clothesline", "ironing-day", "knitting-basket"]);

/* The four seasons */
pack("season-spring", "Spring", "seasons", "Tulips, daffodils, blossoms, robins and a rabbit in the garden.",
  ["tulips-vase", "daffodils", "magnolia-branch", "robin-fence", "bluebird-house", "garden-rabbit", "spring-wreath"]);
pack("season-summer", "Summer", "seasons", "Sunflowers, poppies, butterflies, picnics and sailing.",
  ["sunflower", "poppies", "monarch-butterfly", "picnic-basket", "lake-sailboat", "convertible", "lemonade"]);
pack("season-autumn", "Autumn", "seasons", "Maple leaves, pumpkins, apples, acorns and the harvest.",
  ["autumn-maple", "pumpkin-patch", "apple-branch", "oak-acorns", "harvest-basket", "canning-jars", "cornucopia"]);
pack("season-winter", "Winter", "seasons", "Cardinals, chickadees, snowflakes, pine cones and a warm stove.",
  ["cardinal-branch", "chickadee-pine", "snowflake-medallion", "pine-cones", "wood-cookstove", "quilt-log-cabin", "snowman"]);

/* Decades */
pack("decade-1930s-1940s", "The 1930s and 1940s", "decades", "Steam trains, cathedral radios, biplanes, streetcars and typewriters.",
  ["steam-locomotive", "cathedral-radio", "biplane", "streetcar", "farm-tractor", "typewriter", "woody-wagon"]);
pack("decade-1950s", "The 1950s", "decades", "Tail fins, rotary telephones, chrome toasters and the milkman.",
  ["sunday-sedan", "rotary-telephone", "chrome-toaster", "stand-mixer", "milk-bottles", "motor-scooter", "jukebox"]);

/* Therapeutic focus */
pack("calming-patterns", "Calming Patterns", "focus", "Structured, repeating patterns for a calm, settled session.",
  ["garden-rosette", "lotus-medallion", "fish-scale-tiles", "honeycomb", "quilt-grandmothers-garden", "mandala-heirloom", "zen-rolling-waves"]);
pack("conversation-starters", "Conversation Starters", "focus", "Familiar objects that invite a story: the telephone, the car, the table, the letter, the dog and the barn.",
  ["rotary-telephone", "sunday-sedan", "table-setting", "letter-writing", "faithful-dog", "red-barn"]);
pack("big-and-bold", "Big and Bold", "focus", "One big shape per page in the heaviest lines, for residents who need the simplest, clearest pages.",
  ["sunflower", "teapot-and-cup", "monarch-butterfly", "sunburst-medallion", "lake-sailboat", "garden-rose"], 3);
pack("fine-motor-practice", "Fine-Motor Practice", "focus", "Pages with more, smaller areas, for residents who enjoy detailed work.",
  ["quilt-ohio-star", "daisy-jar", "art-deco-fans", "steam-locomotive", "typewriter", "hydrangea"], 1);
pack("guided-focus-mix", "Guided Focus Mix", "focus", "A balanced set of subjects with a few guiding lines, one from each theme.",
  ["tulips-vase", "farm-pickup", "cathedral-radio", "barn-owl", "quilt-pinwheel", "knitting-basket"], 2);
})(globalThis.CognicopiaColoring);
