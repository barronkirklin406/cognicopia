# Bold and Easy redraw: the 50 subjects

Every subject on the owner's overhaul list is already a design in the library, and each already has Bold and Easy wording (thick pure-black outlines, large fillable areas, no shading, 3:4) in `src/data/coloring_owner_prompts.json`. The routing to the 3:4 page needs no change: a master made for a design id replaces that design's art through `scripts/ingest_coloring_assets.mjs`, which traces it to closed-outline vector art and sets the line weight for each stage.

`src/data/bold_easy_overhaul_jobs.jsonl` holds the 50 jobs (the same text `node scripts/coloring_prompts.mjs --masters` writes for them). Nothing is drawn in code; every picture comes from a picture engine and waits in the review folder for the owner's approval before it joins the library.

What was tried: Canva's image maker (during building only) returned a 200 px square thumbnail of a barn for the Barn Quilt request, not a 3:4 print master, so it cannot be the source. The local art agent is the route: it needs `npm run art:setup` once on the owner's computer (it downloads a picture model), then `npm run art:doctor` to confirm.

The 50 design ids: barn-quilt, liberty-bell, porch-bunting, ballgame, sunday-sedan, woody-wagon, rotary-telephone, gone-fishing, sunday-paper, ice-cream-soda, apple-pie, windowsill-herbs, harvest-basket, pumpkin-patch, clothesline, ironing-day, tea-for-two, teapot-and-cup, butter-churn, porch-swing, cornucopia, lemonade, knitting-basket, sewing-basket, cards-and-dominoes, tulips-vase, sunflower, garden-rose, poppies, daffodils, calla-lilies, daisy-jar, water-lily, magnolia-branch, hydrangea, porch-geranium, dahlia, watering-can, garden-gate, garden-wheelbarrow, autumn-maple, oak-acorns, spring-wreath, holiday-wreath, snowman, ornaments, shamrock-pot, jack-o-lantern, kaleidoscope, sea-turtle.

Make one: `npm run art:make -- --only barn-quilt`. In PowerShell, make them all in turn with `foreach ($i in (Get-Content src/data/bold_easy_overhaul_jobs.jsonl | ForEach-Object { ($_ | ConvertFrom-Json).design_id })) { npm run art:make -- --only $i }`.
