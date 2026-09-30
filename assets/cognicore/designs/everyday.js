/* CogniCore designs: Home & Everyday Tasks. Familiar jobs and small
   pleasures drawn as the things themselves (a laid table, a knitting
   basket, a letter), so a page can open a conversation about a role the
   person held: host, baker, gardener, letter writer. */
(function(C){
"use strict";
var h = C.helpers;
function ground(g, y, x0, x1){ g.L(h.line([x0 || 40, y], [x1 || 560, y]), 3); }
function cup(g, x, y, s, lv){
  g.group({ x:x, y:y, s:s }, function(g){
    g.S(h.ellipse(0, 70, 110, 20), lv);
    g.S(h.path([70, 10]).C([130, 6], [130, 70], [60, 64]).L([62, 46]).C([100, 48], [100, 26], [66, 28]).Z(), lv);
    g.S(h.path([-80, 0]).L([80, 0]).Q([74, 66], [0, 68]).Q([-74, 66], [-80, 0]).Z(), lv);
    g.S(h.ellipse(0, 0, 80, 14), lv);
    g.D(h.path([-70, 24]).Q([0, 40], [70, 24]).open(), Math.max(lv || 1, 3));
  });
}

C.define({ id:"clothesline", title:"Laundry Day", cat:"home-everyday",
  tags:["laundry", "washing", "sunshine", "chores"], talk:"What is your favorite smell of clean laundry drying?" }, function(g){
  g.S(h.rect(30, 140, 26, 640)); g.S(h.rect(544, 140, 26, 640));
  if (g.is(3)){ g.S(h.rect(10, 140, 66, 22)); g.S(h.rect(524, 140, 66, 22)); } else { g.K(h.rect(10, 140, 66, 22)); g.K(h.rect(524, 140, 66, 22)); }
  g.L(h.smooth([[56, 170], [300, 230], [544, 170]], true));
  var pin = function(x, y){ var d = h.rrect(x - 7, y - 20, 14, 40, 5); if (g.is(3)) g.S(d); else g.K(d); };
  var sag = function(x){ return 170 + 60 * (1 - Math.pow((x - 300) / 244, 2)); };
  // shirt
  var shirt = function(x){ var y = sag(x);
    g.S(h.path([x - 70, y]).L([x + 70, y]).L([x + 120, y + 60]).L([x + 96, y + 100]).L([x + 70, y + 80]).L([x + 70, y + 260]).L([x - 70, y + 260]).L([x - 70, y + 80]).L([x - 96, y + 100]).L([x - 120, y + 60]).Z());
    var cw = g.at(30, 44, 46), cd = g.at(36, 56, 60);
    if (g.is(2)) g.S(h.poly([[x - cw, y], [x, y + cd], [x + cw, y]])); else g.K(h.poly([[x - cw, y], [x, y + cd], [x + cw, y]]));
    g.L(h.line([x, y + cd], [x, y + 260]), 2);
    [70, 130, 190].forEach(function(dy){ g.DS(h.circle(x + 12, y + dy, 7), 3); });
    pin(x - 60, y); pin(x + 60, y);
  };
  var towel = function(x, w){ var y = sag(x); g.S(h.rect(x - w / 2, y, w, 220)); g.D(h.line([x - w / 2, y + 180], [x + w / 2, y + 180])); g.D(h.line([x - w / 2, y + 196], [x + w / 2, y + 196]), 3); pin(x - w / 2 + 12, y); pin(x + w / 2 - 12, y); };
  var dress = function(x){ var y = sag(x); g.S(h.path([x - 40, y]).L([x + 40, y]).L([x + 50, y + 110]).L([x + 110, y + 330]).L([x - 110, y + 330]).L([x - 50, y + 110]).Z()); g.L(h.path([x - 50, y + 110]).Q([x, y + 124], [x + 50, y + 110]).open(), 2); pin(x - 30, y); pin(x + 30, y); };
  if (g.lvl >= 2){ shirt(g.at(140, 160, 0)); towel(g.at(300, 0, 0), 130); dress(g.at(450, 430, 0)); }
  else { shirt(190); dress(420); }
  if (g.lvl >= 2){ g.S(h.path([180, 660]).L([420, 660]).L([400, 770]).L([200, 770]).Z()); g.S(h.rrect(170, 646, 260, 26, 10)); g.D(h.line([196, 710], [404, 710])); }
  ground(g, 780, 20, 580);
});

C.define({ id:"table-setting", title:"Setting the Table", cat:"home-everyday",
  tags:["meals", "hosting", "dining", "family-dinners"], talk:"Who would you invite to a special dinner?" }, function(g){
  if (g.lvl >= 2) g.S(h.rect(30, 110, 540, 600));
  if (g.lvl >= 3){ for (var x = 90; x < 570; x += 60) g.D(h.line([x, 110], [x, 710])); for (var y = 170; y < 710; y += 60) g.D(h.line([30, y], [570, y])); }
  g.S(h.circle(300, 420, 190));
  g.S(h.circle(300, 420, 130));
  if (g.lvl >= 2) g.D(h.circle(300, 420, 164), 3);
  // fork
  if (g.is(2)) g.S(h.path([70, 700]).L([70, 470]).Q([50, 440], [52, 330]).L([64, 330]).L([66, 420]).L([74, 420]).L([74, 330]).L([86, 330]).L([88, 420]).L([96, 420]).L([96, 330]).L([108, 330]).Q([110, 440], [90, 470]).L([90, 700]).Z());
  else g.K(h.path([50, 700]).L([50, 470]).Q([20, 440], [22, 330]).L([34, 330]).L([36, 420]).L([54, 420]).L([54, 330]).L([66, 330]).L([66, 420]).L([84, 420]).L([86, 330]).L([98, 330]).Q([100, 440], [70, 470]).L([70, 700]).Z());   // Tier 3: solid fork and knife, the plate to color
  // knife and spoon
  var knife = h.path([500, 700]).L([500, 480]).Q([500, 360], [530, 330]).Q([534, 420], [524, 480]).L([524, 700]).Z();
  if (g.is(2)) g.S(knife); else g.K(knife);
  if (g.lvl >= 2){ g.S(h.rrect(544, 470, 18, 230, 9)); g.S(h.ellipse(553, 420, 26, 50)); }
  if (g.lvl >= 2){ g.S(h.path([112, 520]).L([180, 520]).L([196, 700]).L([96, 700]).Z()); g.D(h.line([146, 520], [146, 700]), 3); }
  if (g.lvl >= 2) cup(g, 470, 190, g.at(.7, .8, .9), 2);
});

C.define({ id:"tea-for-two", title:"Tea for Two", cat:"home-everyday",
  tags:["tea", "friends", "visiting", "hospitality"], talk:"Who would you like to share a cup of tea with?" }, function(g){
  if (g.lvl >= 2){ g.S(h.rrect(30, 300, 540, 380, 60)); g.D(h.rrect(60, 330, 480, 320, 44), 3); }
  if (g.lvl >= 2){ cup(g, 180, 420, 1, 1); cup(g, 420, 520, 1, 1); g.S(h.path([230, 470]).L([330, 440]).L([334, 452]).L([236, 484]).Z()); g.S(h.ellipse(350, 440, 24, 14, -18)); }
  else cup(g, 280, 380, 2, 1);
  if (g.lvl >= 3){ g.S(h.ellipse(170, 590, 96, 22)); g.S(h.path([100, 580]).L([130, 530]).L([240, 530]).L([240, 580]).Z()); g.D(h.line([112, 560], [240, 560])); }
});

C.define({ id:"baking-day", title:"Baking Day", cat:"home-everyday",
  tags:["baking", "pies", "kitchen", "family-recipes"], talk:"What is a recipe you would love to smell baking right now?" }, function(g){
  g.S(h.rect(24, 560, 552, 40));
  if (g.lvl >= 2) g.S(h.rect(40, 600, 520, 170));
  if (g.lvl >= 3){ g.D(h.line([300, 600], [300, 770])); g.S(h.rrect(230, 670, 40, 18, 8)); g.S(h.rrect(330, 670, 40, 18, 8)); }
  g.S(h.ellipse(300, 470, 230, 90));
  g.S(h.ellipse(300, 452, 200, 72));
  var lines = g.at(5, 3, 2);
  for (var i = 1; i <= lines; i++){ var f = i / (lines + 1), x = 100 + 400 * f, dy = 72 * Math.sqrt(1 - Math.pow((x - 300) / 200, 2)); g.L(h.line([x, 452 - dy], [x, 452 + dy])); var y = 380 + 144 * f, dx = 200 * Math.sqrt(1 - Math.pow((y - 452) / 72, 2)); g.L(h.line([300 - dx, y], [300 + dx, y])); }
  g.S(h.path([110, 330]).L([450, 250]).L([458, 276]).L([118, 356]).Z());
  g.S(h.rrect(40, 324, 76, 40, 16)); g.S(h.rrect(448, 236, 76, 40, 16));
  if (g.lvl >= 2){ g.S(h.circle(480, 170, 60)); g.S(h.star(480, 170, 40, 18, 5), 3); g.S(h.path([60, 250]).Q([60, 170], [140, 170]).L([200, 170]).Q([260, 170], [260, 250]).Z(), 3); }
});

C.define({ id:"knitting-basket", title:"The Knitting Basket", cat:"home-everyday",
  tags:["knitting", "yarn", "handwork", "crafts"], talk:"What would you knit or make for someone you care about?" }, function(g){
  var ball = function(x, y, r, lv){ g.S(h.circle(x, y, r), lv); [-.5, 0, .5].forEach(function(f){ g.L(h.path([x - r * .9, y + f * r]).Q([x, y + f * r - r * .5], [x + r * .9, y + f * r]).open(), Math.max(lv || 1, 1)); }); };
  g.S(h.path([420, 110]).L([200, 520]).L([214, 526]).L([436, 116]).Z());
  g.S(h.circle(428, 106, 14));
  g.S(h.path([480, 150]).L([320, 540]).L([334, 546]).L([496, 156]).Z(), 2);
  if (g.lvl >= 2) g.S(h.circle(488, 146, 14), 2);
  ball(200, 420, g.at(90, 100, 120), 1);
  if (g.lvl >= 2) ball(360, 440, 80, 2);
  g.S(h.path([60, 460]).L([540, 460]).L([500, 740]).L([100, 740]).Z());
  g.S(h.rrect(44, 440, 512, 40, 14));
  if (g.lvl >= 2) [540, 610, 680].forEach(function(y){ g.D(h.line([60 + (y - 460) * .14, y], [540 - (y - 460) * .14, y])); });
  if (g.lvl >= 3) [150, 230, 310, 390, 470].forEach(function(x){ g.D(h.line([x, 480], [x + (300 - x) * .12, 738])); });
  if (g.lvl >= 2) g.L(h.smooth([[200, 510], [260, 560], [230, 620], [320, 640]], true));
});

C.define({ id:"sewing-basket", title:"The Sewing Basket", cat:"home-everyday",
  tags:["sewing", "mending", "spools", "handwork"], talk:"What is something you would love to mend or make?" }, function(g){
  // spool of thread
  g.group({ x:g.at(160, 180, 220), y:g.at(330, 330, 380), s:g.at(1, 1.15, 1.5) }, function(g){
    g.S(h.rect(-60, -110, 120, 220));
    for (var i = 0; i < 8; i++) g.D(h.line([-60, -90 + i * 26], [60, -80 + i * 26]));
    g.S(h.ellipse(0, -120, 90, 22)); g.S(h.ellipse(0, 120, 90, 22));
  });
  // pincushion
  g.group({ x:g.at(420, 420, 0), y:g.at(360, 380, 0), s:g.at(1, 1.1, 1) }, function(g){
    if (g.lvl < 2) return;
    g.S(h.smooth([[-110, 20], [-100, -60], [0, -90], [100, -60], [110, 20], [0, 60]]));
    [-60, -20, 20, 60].forEach(function(x){ g.L(h.path([x, -80]).Q([x * 1.3, -10], [x, 50]).open()); });
    g.S(h.star(0, -90, 34, 14, 5));
    [[-40, -110, -60, -150], [30, -100, 50, -150]].forEach(function(p){ g.L(h.line([p[0], p[1]], [p[2], p[3]])); g.S(h.circle(p[2], p[3], 12)); });
  });
  // scissors
  g.group({ x:300, y:g.at(620, 640, 640), s:g.at(1, 1.1, 1.3), rot:-12 }, function(g){
    g.S(h.path([0, -10]).L([220, -34]).L([222, -22]).L([10, 10]).Z());
    g.S(h.path([0, 10]).L([220, 34]).L([222, 22]).L([10, -10]).Z());
    g.S(h.ellipse(-70, -34, 56, 34)); g.S(h.ellipse(-70, 34, 56, 34));
    g.S(h.ellipse(-70, -34, 32, 16), 2); g.S(h.ellipse(-70, 34, 32, 16), 2);
    g.S(h.circle(6, 0, 10));
  });
  if (g.lvl >= 3){ g.S(h.path([470, 560]).L([530, 560]).L([524, 640]).Q([500, 660], [476, 640]).Z()); g.S(h.ellipse(500, 560, 30, 8)); }
});

C.define({ id:"potting-bench", title:"The Potting Bench", cat:"home-everyday",
  tags:["gardening", "potting", "seedlings", "tools"], talk:"What would you plant in these pots?" }, function(g){
  g.S(h.rect(60, 420, 480, 36));
  g.S(h.rect(80, 456, 26, 300)); g.S(h.rect(494, 456, 26, 300));
  if (g.lvl >= 2){ g.S(h.rect(80, 640, 440, 26)); g.S(h.rect(60, 140, 480, 22)); g.S(h.rect(80, 162, 20, 258)); g.S(h.rect(500, 162, 20, 258)); }
  var pot = function(x, w, hh){ g.S(h.poly([[x - w * .42, 420 - hh + w * .2], [x + w * .42, 420 - hh + w * .2], [x + w * .32, 420], [x - w * .32, 420]])); g.S(h.rrect(x - w / 2, 420 - hh, w, w * .22, 6)); };
  var sprout = function(x, top){ var k = g.at(1, 1.15, 1.5); g.L(h.line([x, top + 10], [x, top - 60 * k])); g.S(h.leaf([x, top - 40 * k], [x - 50 * k, top - 80 * k], 30 * k, -.2)); g.S(h.leaf([x, top - 50 * k], [x + 50 * k, top - 90 * k], 30 * k, .2)); };
  pot(g.at(190, 200, 220), 130, 120); sprout(g.at(190, 200, 220), 300);
  pot(g.at(400, 400, 390), g.at(110, 130, 150), g.at(100, 120, 140)); sprout(g.at(400, 400, 390), g.at(320, 300, 280));
  if (g.lvl >= 2){ g.S(h.path([300, 640]).L([240, 520]).L([260, 510]).L([318, 630]).Z()); g.S(h.path([240, 520]).Q([200, 470], [230, 440]).Q([280, 470], [260, 510]).Z()); }
  if (g.lvl >= 3){ g.S(h.rrect(300, 580, 170, 60, 20)); g.D(h.line([330, 580], [330, 640])); g.D(h.line([380, 580], [380, 640])); }
  ground(g, 760, 40, 560);
});

C.define({ id:"letter-writing", title:"Writing a Letter", cat:"home-everyday",
  tags:["letters", "writing", "keeping-in-touch", "mail"], talk:"Who would you most like to write a letter to?" }, function(g){
  g.S(h.path([60, 120]).L([420, 90]).L([460, 560]).L([100, 590]).Z());
  var lines = g.at(8, 6, 0);
  for (var i = 1; i <= lines; i++){ var f = i / (lines + 1); var a = h.lerp([80, 140], [100, 570], f), b = h.lerp([420, 110], [440, 540], f); g.D(h.line(a, b)); }
  g.S(h.rect(160, 420, 380, 240));
  g.L(h.poly([[160, 420], [350, 560], [540, 420]], true));
  if (g.lvl >= 2){ g.S(h.rect(450, 440, 70, 80)); g.D(h.rect(462, 452, 46, 56)); }
  g.group({ x:430, y:300, rot:30 }, function(g){
    var pw = g.at(16, 18, 22), tip = h.poly([[-pw, 20], [pw, 20], [0, 80]]);
    g.S(h.rrect(-pw, -200, 2 * pw, 220, 14));
    if (g.is(3)){ g.S(tip); g.D(h.line([0, 30], [0, 66])); } else g.K(tip);
    if (g.lvl >= 2) g.S(h.rrect(-pw - 4, -220, 2 * pw + 8, 40, 12));
  });
});

C.define({ id:"picnic-basket", title:"The Summer Picnic", cat:"home-everyday", season:"summer",
  tags:["picnics", "summer", "parks", "family-outings"], talk:"Where is a lovely spot for a picnic, and what would you pack?" }, function(g){
  g.S(h.path([20, 600]).L([580, 600]).L([580, 780]).L([20, 780]).Z());
  if (g.lvl >= 2){ for (var x = 90; x < 580; x += 70) g.L(h.line([x, 600], [x, 780])); [660, 720].forEach(function(y){ g.L(h.line([20, y], [580, y])); }); }
  g.L(h.path([160, 380]).C([160, 200], [440, 200], [440, 380]).open());
  g.S(h.path([100, 420]).L([500, 420]).L([470, 640]).L([130, 640]).Z());
  g.S(h.rrect(80, 380, 440, 56, 16));
  if (g.lvl >= 2) [490, 560].forEach(function(y){ g.D(h.line([110, y], [490, y])); });
  if (g.lvl >= 3) [180, 240, 300, 360, 420].forEach(function(x){ g.D(h.line([x, 440], [x + (300 - x) * .08, 636])); });
  g.S(h.rrect(270, 400, 60, 60, 12));
  if (g.lvl >= 2){ g.S(h.path([480, 560]).L([560, 560]).L([556, 690]).Q([520, 704], [484, 690]).Z()); g.S(h.ellipse(520, 560, 40, 10)); }
});

C.define({ id:"gone-fishing", title:"Gone Fishing", cat:"home-everyday",
  tags:["fishing", "lakes", "outdoors", "patience"], sensitive:["water"], talk:"What is the best part of a quiet day outdoors?" }, function(g){
  /* Tier 1: a rod with a colorable reel leaning behind the creel. Tiers 2
     and 3: the rod is a bold line in front, with a solid reel, so it never
     leaves thin slivers beside the basket. */
  if (g.is(3)){ g.S(h.path([60, 760]).L([520, 90]).L([534, 100]).L([80, 772]).Z()); g.S(h.circle(170, 610, 44)); g.S(h.circle(170, 610, 18)); }
  g.L(h.smooth([[526, 94], [560, 200], [560, 400], [540, 460]], true));
  g.S(h.smooth([[520, 470], [556, 450], [580, 480], [556, 520], [520, 500]]));
  g.group({ x:330, y:g.at(560, 560, 540), s:g.at(1, 1.1, 1.2) }, function(g){
    g.S(h.path([-150, -110]).L([150, -110]).L([130, 110]).Q([0, 140], [-130, 110]).Z());
    g.S(h.rrect(-164, -140, 328, 44, 14));
    g.L(h.path([-120, -140]).C([-120, -260], [120, -260], [120, -140]).open());
    if (g.lvl >= 2) [-40, 30, 90].forEach(function(y){ g.D(h.line([-146, y - 60], [146, y - 60])); });
    if (g.lvl >= 3) [-90, -30, 30, 90].forEach(function(x){ g.D(h.line([x, -96], [x * .9, 118])); });
  });
  if (!g.is(3)){ g.L(h.line([146, 656], [527, 95])); g.K(h.circle(176, 610, 30)); }        // the butt ends in the open, clear of the fish
  g.group({ x:170, y:720, s:g.at(.9, .9, 1.05), rot:-6 }, function(g){ g.S(h.smooth([[120, 0], [60, -40], [-40, -30], [-100, 0], [-40, 30], [60, 40]])); g.S(h.poly([[-100, 0], [-150, -40], [-140, 0], [-150, 40]])); g.K(h.circle(80, -8, 6)); g.D(h.path([40, -30]).Q([24, 0], [40, 30]).open()); });
});

C.define({ id:"sunday-paper", title:"The Sunday Paper", cat:"home-everyday",
  tags:["newspapers", "coffee", "mornings", "reading"], talk:"What part of the paper would you read first?" }, function(g){
  g.S(h.path([60, 200]).L([440, 170]).L([480, 620]).L([100, 650]).Z());
  g.S(h.path([80, 230]).L([420, 204]).L([430, 300]).L([90, 326]).Z());
  var cols = g.at(3, 2, 0);
  for (var c = 0; c < cols; c++) for (var r = 0; r < g.at(8, 5, 0); r++){ var x0 = 100 + c * 116, y = 360 + r * 30 - c * 9; g.D(h.line([x0, y], [x0 + 96, y - 8])); }
  if (g.lvl >= 1 && g.lvl < 2) g.S(h.rect(110, 360, 300, 200));
  g.S(h.path([96, 360]).L([250, 348]).L([258, 440]).L([104, 452]).Z(), 2);
  g.group({ x:460, y:560, s:g.at(1, 1.1, 1.3) }, function(g){
    g.S(h.path([-70, -60]).L([70, -60]).L([60, 70]).Q([0, 84], [-60, 70]).Z());
    g.S(h.path([66, -30]).C([120, -30], [120, 40], [62, 40]).L([62, 20]).C([96, 20], [96, -10], [66, -10]).Z());
    g.S(h.ellipse(0, -60, 70, 14));
  });
  if (g.lvl >= 2){ g.S(h.circle(170, 720, 44)); g.S(h.circle(290, 720, 44)); g.L(h.path([214, 716]).Q([230, 700], [246, 716]).open()); }
});

C.define({ id:"ironing-day", title:"Ironing Day", cat:"home-everyday",
  tags:["ironing", "laundry", "chores", "home"], talk:"What is a chore you actually enjoy?" }, function(g){
  g.S(h.path([40, 420]).L([470, 420]).Q([570, 420], [570, 470]).Q([570, 520], [470, 520]).L([40, 520]).Z());
  g.L(h.line([160, 520], [440, 770])); g.L(h.line([440, 520], [160, 770]));
  if (g.lvl >= 2) g.S(h.path([90, 420]).L([130, 360]).L([290, 360]).L([330, 420]).Z());
  if (g.lvl >= 3) g.D(h.line([130, 390], [290, 390]));
  g.group({ x:g.at(420, 420, 330), y:g.at(356, 356, 340), s:g.at(1, 1.1, 1.4) }, function(g){
    g.S(h.path([-120, 60]).L([130, 60]).C([120, 30], [80, 10], [30, 4]).L([-100, 4]).Q([-120, 10], [-120, 60]).Z());
    g.S(h.path([-80, 4]).C([-80, -70], [40, -74], [60, 4]).L([34, 4]).C([24, -40], [-50, -40], [-54, 4]).Z());
    if (g.lvl >= 2) g.D(h.line([-104, 36], [104, 36]));
  });
  if (g.lvl >= 2){ g.L(h.smooth([[300, 400], [240, 440], [230, 560], [300, 700], [350, 770]], true), 2); }
});

C.define({ id:"cards-and-dominoes", title:"Cards and Dominoes", cat:"home-everyday",
  tags:["card-games", "dominoes", "games", "friends"], talk:"What game would you like to play with friends?" }, function(g){
  var card = function(x, y, rot, suit, lv){ g.group({ x:x, y:y, rot:rot }, function(g){
    g.S(h.rrect(-80, -120, 160, 240, 16), lv);
    if (suit === "heart") g.S(h.path([0, 40]).C([-70, -10], [-50, -80], [0, -40]).C([50, -80], [70, -10], [0, 40]).Z(), lv);
    else if (suit === "diamond") g.S(h.poly([[0, -60], [44, 0], [0, 60], [-44, 0]]), lv);
    else if (suit === "spade") g.S(h.path([0, -60]).C([60, -10], [60, 40], [10, 30]).L([24, 70]).L([-24, 70]).L([-10, 30]).C([-60, 40], [-60, -10], [0, -60]).Z(), lv);
    else { g.S(h.circle(0, -30, 26), lv); g.S(h.circle(-30, 14, 26), lv); g.S(h.circle(30, 14, 26), lv); g.S(h.poly([[-10, 20], [10, 20], [20, 70], [-20, 70]]), lv); }
  }); };
  card(170, 300, -20, "spade", 2); card(300, 270, 0, "heart", 1); card(430, 300, 20, "diamond", 1);
  if (g.lvl >= 3) card(230, 290, -10, "club", 3);
  var domino = function(x, y, a, b, rot){ g.group({ x:x, y:y, rot:rot }, function(g){
    g.S(h.rrect(-60, -120, 120, 240, 16)); g.L(h.line([-50, 0], [50, 0]));
    var pip = { 1:[[0, 0]], 2:[[-26, -26], [26, 26]], 3:[[-26, -26], [0, 0], [26, 26]], 4:[[-26, -26], [26, -26], [-26, 26], [26, 26]], 5:[[-26, -26], [26, -26], [0, 0], [-26, 26], [26, 26]] };
    (pip[a] || []).forEach(function(p){ g.K(h.circle(p[0], p[1] - 60, 11)); }); (pip[b] || []).forEach(function(p){ g.K(h.circle(p[0], p[1] + 60, 11)); });
  }); };
  domino(200, 600, 3, 5, 80);
  if (g.lvl >= 2) domino(420, 620, 2, 4, 100);
});
})(globalThis.CogniCore);
