/* CogniCore designs: Classic Vehicles. Side-on views, facing right, with
   big wheels and plain panels; chrome, trim and seams only at Tiers 1-2.
   Each sits in a scene (lineart.js, kit.scene) so the tall page is filled
   with big areas to color, not empty paper.
   See assets/cognicore/lineart.js for g (the tier's shapes) and h (geometry). */
(function(C){
"use strict";
var h = C.helpers, kit = C.kit;

/* A wheel: tire, rim and hubcap; spoked wheels (bicycles, trains) pass spokes. */
function wheel(g, cx, cy, r, o){
  o = o || {};
  g.S(h.circle(cx, cy, r));
  g.S(h.circle(cx, cy, r * (o.rim || .58)), o.rimLv || 2);
  if (!g.is(2)) g.K(h.circle(cx, cy, r * .14));
  var hub = o.hubR || .22;
  if (o.hub !== false) g.DS(h.circle(cx, cy, r * hub), 3);
  if (o.spokes) for (var i = 0; i < o.spokes; i++){ var a = (o.spokeRot || 0) + i * 360 / o.spokes; g.D(h.line(h.onCircle(cx, cy, r * (hub + .02), a), h.onCircle(cx, cy, r * (o.rim || .58) - 2, a)), o.spokeLv || 2); }
}

/* A vehicle in its scene: the drawing's bottom-centre anchor [ax, ay] lands at
   [x, y] (usually on the road), scaled to span `width` units. */
function inScene(meta, scene, place, draw){
  meta.fit = "page";
  C.define(meta, function(g){
    kit.scene(g, scene);
    var s = place.width / (place.span[1] - place.span[0]);
    g.group({ x:place.x || 300, y:place.y, s:s, ox:(place.span[0] + place.span[1]) / 2, oy:place.anchorY }, draw);
    if (scene.rail) g.S(h.rect(24, place.y, 552, 30));
  });
}

function sedan(g){
  g.S(h.path([48, 452]).L([40, 402]).Q([44, 368], [70, 352]).L([96, 364]).Q([150, 378], [196, 384])
    .L([236, 322]).Q([244, 312], [262, 312]).L([388, 312]).Q([404, 312], [414, 324]).L([452, 382])
    .Q([540, 386], [562, 400]).Q([572, 422], [566, 452]).L([514, 452]).C([512, 386], [398, 386], [396, 452])
    .L([196, 452]).C([194, 386], [80, 386], [78, 452]).Z());
  g.S(h.path([214, 382]).L([246, 330]).Q([252, 324], [262, 324]).L([306, 324]).L([306, 382]).Z());
  g.S(h.path([322, 382]).L([322, 324]).L([384, 324]).Q([394, 324], [400, 334]).L([432, 382]).Z());
  g.S(h.rrect(548, 436, 34, 22, 9), 3);
  g.S(h.rrect(24, 436, 34, 22, 9), 3);
  g.S(h.circle(552, 410, 12), 3);
  g.S(h.path([46, 400]).L([62, 368]).L([74, 372]).L([60, 404]).Z(), 3);
  g.D(h.smooth([[92, 404], [220, 402], [340, 410], [520, 414]], true));
  g.D(h.line([314, 386], [314, 446]), 3);
  g.D(h.line([206, 388], [206, 440]), 3);
  g.D(h.line([290, 398], [304, 398]), 3);
  wheel(g, 137, 456, 46);
  wheel(g, 455, 456, 46);
}
inScene({ id:"sunday-sedan", title:"The Sunday Sedan", cat:"classic-vehicles", era:"1950s",
  tags:["cars", "chrome", "tail-fins", "road-trips"], sensitive:["driving"],
  talk:"Where would a Sunday drive take you today?" },
  { road:[610, 700], trees:[[120, 70], [178, 54]] }, { span:[24, 582], anchorY:502, y:690, width:540 }, sedan);

function pickup(g){
  g.S(h.path([30, 446]).L([30, 350]).L([262, 350]).L([262, 446]).L([232, 446]).C([230, 390], [128, 390], [126, 446]).L([74, 446]).Z());
  g.D(h.line([30, 372], [262, 372]));
  g.D(h.line([90, 350], [90, 372]), 3); g.D(h.line([150, 350], [150, 372]), 3); g.D(h.line([210, 350], [210, 372]), 3);
  g.S(h.path([262, 446]).L([262, 300]).Q([262, 262], [298, 262]).L([362, 262]).Q([384, 262], [394, 282]).L([420, 346])
    .Q([514, 346], [548, 364]).Q([572, 378], [572, 420]).L([572, 446]).L([522, 446]).C([520, 388], [412, 388], [410, 446]).Z());
  g.S(h.path([284, 336]).L([284, 296]).Q([284, 282], [300, 282]).L([356, 282]).Q([368, 282], [374, 294]).L([392, 336]).Z());
  g.S(h.rrect(556, 430, 30, 22, 8), 3);
  g.S(h.circle(546, 378, 14), 3);
  g.D(h.line([420, 346], [420, 420]), 2);
  g.D(h.line([306, 356], [322, 356]), 3);
  wheel(g, 179, 448, 44);
  wheel(g, 466, 448, 44);
}
inScene({ id:"farm-pickup", title:"The Farm Pickup", cat:"classic-vehicles", era:"1950s",
  tags:["trucks", "farm", "work"], sensitive:["driving"],
  talk:"What would you haul in the back of this truck?" },
  { road:[610, 700], trees:[[480, 64]] }, { span:[30, 586], anchorY:492, y:690, width:530 }, pickup);

function tractor(g){
  g.S(h.rrect(236, 250, 20, 90, 6), 2);
  g.S(h.rrect(228, 240, 36, 16, 6), 2);
  g.S(h.path([180, 344]).L([180, 316]).Q([180, 300], [196, 300]).L([470, 300]).Q([496, 300], [500, 324]).L([506, 390]).L([180, 390]).Z());
  g.D(h.line([220, 318], [220, 382]));
  g.D(h.line([470, 318], [476, 382]), 3); g.D(h.line([452, 318], [456, 382]), 3); g.D(h.line([434, 318], [436, 382]), 3);
  g.S(h.path([60, 310]).Q([60, 250], [120, 246]).L([170, 244]).L([176, 290]).L([122, 294]).Q([104, 296], [104, 316]).Z());
  g.S(h.circle(150, 390, 118));
  g.S(h.circle(150, 390, 70));
  g.DS(h.circle(150, 390, 22), 2);
  for (var i = 0; i < 12; i++){ var a = i * 30 + 15; g.D(h.poly([h.onCircle(150, 390, 104, a - 6), h.onCircle(150, 390, 118, a - 10), h.onCircle(150, 390, 118, a + 10), h.onCircle(150, 390, 104, a + 6)]), 3); }
  g.S(h.circle(470, 438, 58));
  g.S(h.circle(470, 438, 30));
  g.DS(h.circle(470, 438, 10), 2);
  g.S(h.path([118, 300]).Q([150, 230], [226, 250]).L([222, 296]).Z());
}
inScene({ id:"farm-tractor", title:"The Farm Tractor", cat:"classic-vehicles", era:"1940s",
  tags:["farm", "tractors", "harvest"], talk:"What grows best in a good field?" },
  { horizon:430, trees:[[520, 60], [470, 44]] }, { span:[32, 528], anchorY:508, y:700, width:500 }, tractor);

function locomotive(g){
  g.S(h.path([118, 250]).L([106, 170]).L([168, 170]).L([156, 250]).Z());
  g.S(h.rrect(96, 150, 82, 26, 8));
  g.S(h.path([236, 250]).Q([236, 212], [262, 212]).Q([288, 212], [288, 250]).Z(), 2);
  g.S(h.path([96, 250]).L([404, 250]).L([404, 364]).L([96, 364]).Q([60, 306], [96, 250]).Z());
  g.D(h.line([150, 250], [150, 364])); g.D(h.line([330, 250], [330, 364]), 3);
  g.S(h.circle(88, 306, 22), 3);
  g.S(h.path([392, 150]).L([540, 150]).L([540, 364]).L([392, 364]).Z());
  g.S(h.rrect(378, 130, 176, 26, 8));
  g.S(h.rrect(420, 180, 92, 78, 8));
  g.D(h.line([466, 180], [466, 258]), 3);
  g.S(h.path([60, 364]).L([552, 364]).L([552, 392]).L([60, 392]).Z());
  g.S(h.path([60, 392]).L([22, 462]).L([96, 462]).L([96, 392]).Z());
  g.D(h.line([46, 440], [96, 440]), 3); g.D(h.line([38, 414], [96, 414]), 3);
  g.at([184, 290, 396], [184, 290, 396], [210, 370]).forEach(function(x){ wheel(g, x, 430, 50, { spokes:4, spokeRot:45, spokeLv:3, hubR:.3 }); });
  g.S(h.circle(112, 450, 24), 2);
}
inScene({ id:"steam-locomotive", title:"The Steam Locomotive", cat:"classic-vehicles", era:"1930s",
  tags:["trains", "railroad", "travel"], talk:"Where would you ride this train today?" },
  { horizon:370, trees:[[90, 50]], rail:1 }, { span:[22, 554], anchorY:480, y:660, width:520 }, locomotive);

C.define({ id:"lake-sailboat", title:"Sailing on the Lake", cat:"classic-vehicles", fit:"page",
  tags:["boats", "lake", "summer", "wind"], sensitive:["water"], season:"summer",
  talk:"What is the nicest weather for a day on the water?" }, function(g){
  kit.scene(g, { horizon:520, hills:false, water:540, sunX:150 });
  g.group({ x:320, y:600, s:1.1, ox:300, oy:560 }, function(g){
    g.S(h.path([300, 90]).L([300, 468]).L([112, 468]).Q([190, 300], [300, 90]).Z());
    g.S(h.path([320, 126]).L([470, 468]).L([320, 468]).Z());
    g.D(h.line([300, 190], [196, 330]), 3); g.D(h.line([300, 320], [150, 420]), 3);
    g.D(h.line([320, 250], [390, 350]), 3);
    g.L(h.line([300, 468], [300, 80]));
    g.S(h.path([70, 488]).L([536, 488]).Q([516, 548], [460, 560]).L([150, 560]).Q([96, 548], [70, 488]).Z());
    g.D(h.smooth([[92, 512], [300, 520], [520, 512]], true));
    g.S(h.path([292, 80]).L([330, 92]).L([292, 104]).Z(), 2);
  });
});

function woody(g){
  g.S(h.path([30, 450]).L([30, 322]).Q([30, 300], [54, 300]).L([400, 300]).Q([420, 300], [432, 316]).L([462, 370]).Q([540, 376], [566, 392]).Q([576, 414], [572, 450])
    .L([520, 450]).C([518, 388], [410, 388], [408, 450]).L([190, 450]).C([188, 388], [80, 388], [78, 450]).Z());
  [[50, 316, 96], [160, 316, 96], [270, 316, 96]].forEach(function(w){ g.S(h.rrect(w[0], w[1], w[2], 48, 6)); });
  g.S(h.path([380, 364]).L([380, 316]).L([404, 316]).Q([416, 316], [424, 330]).L([444, 364]).Z());
  g.D(h.rect(44, 378, 336, 56), 3);
  [156, 268].forEach(function(x){ g.D(h.line([x, 378], [x, 434]), 3); });
  if (g.lvl >= 3){ g.D(h.line([44, 406], [380, 406])); }
  g.S(h.rrect(552, 432, 34, 22, 9), 3); g.S(h.rrect(18, 432, 34, 22, 9), 3);
  g.S(h.circle(552, 404, 12), 3);
  if (g.lvl >= 2) g.D(h.path([40, 300]).L([40, 286]).L([380, 286]).L([380, 300]).open(), 3);
  wheel(g, 134, 452, 46); wheel(g, 464, 452, 46);
}
inScene({ id:"woody-wagon", title:"The Woody Station Wagon", cat:"classic-vehicles", era:"1940s",
  tags:["cars", "station-wagons", "road-trips", "family"], sensitive:["driving"], talk:"Where would a family road trip take you?" },
  { road:[610, 700], trees:[[480, 60], [530, 46]] }, { span:[18, 586], anchorY:498, y:690, width:540 }, woody);

function convertible(g){
  g.S(h.path([40, 450]).L([36, 400]).Q([40, 372], [80, 368]).L([200, 364]).L([240, 380]).L([330, 380]).L([372, 350]).L([388, 352]).L([360, 386])
    .Q([520, 388], [556, 404]).Q([574, 420], [568, 450]).L([520, 450]).C([518, 390], [410, 390], [408, 450]).L([190, 450]).C([188, 390], [80, 390], [78, 450]).Z());
  g.S(h.path([200, 364]).Q([204, 316], [246, 316]).L([256, 380]).Z(), 2);
  g.S(h.path([262, 380]).Q([266, 330], [304, 330]).L([314, 380]).Z(), 3);
  g.L(h.line([350, 382], [384, 314]));
  g.D(h.smooth([[60, 404], [300, 410], [540, 414]], true));
  g.S(h.rrect(550, 436, 34, 22, 9), 3); g.S(h.rrect(20, 436, 34, 22, 9), 3);
  g.S(h.circle(554, 410, 12), 3);
  wheel(g, 134, 454, 46); wheel(g, 464, 454, 46);
}
inScene({ id:"convertible", title:"The Convertible", cat:"classic-vehicles", era:"1950s",
  tags:["cars", "convertibles", "summer", "chrome"], sensitive:["driving"], season:"summer", talk:"What would you enjoy most about a drive with the top down?" },
  { road:[610, 700], trees:[[100, 60]] }, { span:[20, 584], anchorY:500, y:690, width:540 }, convertible);

function breadTruck(g){
  g.S(h.path([30, 440]).L([30, 250]).Q([30, 220], [60, 220]).L([400, 220]).Q([470, 220], [500, 280]).L([540, 360]).Q([570, 372], [572, 410]).L([572, 440])
    .L([520, 440]).C([518, 380], [410, 380], [408, 440]).L([180, 440]).C([178, 380], [70, 380], [68, 440]).Z());
  g.S(h.path([410, 330]).L([410, 250]).L([440, 250]).Q([462, 250], [474, 272]).L([504, 330]).Z());
  g.S(h.rrect(60, 250, 320, 130, 12));
  if (g.lvl >= 2) g.D(h.rrect(80, 270, 280, 90, 10), 2);
  if (g.lvl >= 3) g.D(h.path([120, 330]).Q([150, 290], [200, 300]).Q([240, 280], [280, 300]).Q([310, 290], [320, 330]).open());
  g.D(h.line([400, 220], [400, 430]), 2);
  g.S(h.rrect(552, 426, 34, 22, 9), 3); g.S(h.rrect(16, 426, 34, 22, 9), 3);
  g.S(h.circle(556, 390, 12), 3);
  wheel(g, 124, 444, 44); wheel(g, 464, 444, 44);
}
inScene({ id:"bread-truck", title:"The Bakery Delivery Truck", cat:"classic-vehicles", era:"1950s",
  tags:["trucks", "deliveries", "bakery", "neighborhoods"], sensitive:["driving"], talk:"What would you like delivered fresh to the door?" },
  { road:[610, 700] }, { span:[16, 586], anchorY:488, y:690, width:540 }, breadTruck);

C.define({ id:"streetcar", title:"The Streetcar", cat:"classic-vehicles", era:"1940s", fit:"page",
  tags:["streetcars", "trolleys", "city", "travel"], talk:"Where in town would you ride the streetcar to?" }, function(g){
  kit.scene(g, { horizon:440, hills:false, trees:g.lvl >= 3 ? [[500, 60]] : null });
  g.L(h.line([24, 120], [576, 110]));
  g.L(h.line([300, 116], [340, 300]));
  g.S(h.rrect(60, 290, 480, 36, 14));
  g.S(h.path([50, 600]).L([50, 330]).L([550, 330]).L([550, 600]).Z());
  var win = g.at(6, 5, 4), ww = 440 / win;
  for (var i = 0; i < win; i++) g.S(h.rrect(80 + i * ww, 360, ww - 20, 90, 10));
  g.D(h.line([50, 480], [550, 480])); g.D(h.line([50, 560], [550, 560]), 3);
  if (g.lvl >= 2){ g.S(h.rect(470, 470, 60, 130)); }
  [140, 460].forEach(function(x){ wheel(g, x, 640, 40, { rim:.5 }); });
  g.S(h.rect(24, 670, 552, 30));
});

C.define({ id:"vintage-bicycle", title:"The Bicycle with a Basket", cat:"classic-vehicles", era:"1950s", fit:"page",
  tags:["bicycles", "country-lanes", "flowers", "exercise"], talk:"Where would you ride a bicycle on a sunny afternoon?" }, function(g){
  kit.scene(g, { horizon:460, trees:[[520, 64]] });
  g.group({ x:300, y:560, s:1 }, function(g){
    wheel(g, -150, 80, 110, { rim:.9, rimLv:2, spokes:g.at(12, 8, 0), spokeLv:2 });
    wheel(g, 150, 80, 110, { rim:.9, rimLv:2, spokes:g.at(12, 8, 0), spokeLv:2 });
    g.L(h.poly([[-150, 80], [-40, -60], [110, -60], [150, 80]], true));
    g.L(h.line([-40, -60], [10, 80])); g.L(h.line([10, 80], [-150, 80]));
    g.L(h.line([110, -60], [90, -120]));
    var grip = h.path([60, -130]).Q([90, -140], [120, -124]).L([116, -112]).Q([90, -124], [64, -118]).Z();
    var saddle = h.path([-80, -84]).Q([-40, -100], [0, -84]).L([-6, -70]).Q([-40, -80], [-74, -70]).Z();
    if (g.is(2)){ g.S(grip); g.S(saddle); } else { g.K(grip); g.K(saddle); }
    g.L(h.line([-40, -60], [-44, -76]));
    if (g.lvl >= 2){ g.S(h.path([120, -110]).L([220, -110]).L([210, -40]).L([130, -40]).Z()); [150, 180].forEach(function(x){ g.D(h.line([x, -110], [x - 4, -40])); }); }   // the basket from Tier 2 up
    if (g.lvl >= 3) [[140, -140, 30], [190, -150, 34]].forEach(function(f){ g.S(h.scallop(f[0], f[1], f[2], 6, .3)); g.K(h.circle(f[0], f[1], f[2] * .3)); });
    g.K(h.circle(10, 80, 18));
  });
});

C.define({ id:"motor-scooter", title:"The Motor Scooter", cat:"classic-vehicles", era:"1950s", fit:"page",
  tags:["scooters", "travel", "city", "summer"], sensitive:["driving"], talk:"Where would you ride on a warm evening?" }, function(g){
  kit.scene(g, { horizon:460, road:[640, 710], trees:[[90, 56]] });
  g.group({ x:300, y:560, s:1.05 }, function(g){
    wheel(g, -150, 80, 58); wheel(g, 160, 80, 58);
    g.S(h.path([-240, 50]).C([-250, -30], [-200, -70], [-120, -74]).L([-40, -74]).C([-20, -60], [-16, -20], [-20, 40]).Q([-120, 70], [-240, 50]).Z());
    g.S(h.rrect(-200, -104, 150, 34, 14));
    g.S(h.rect(-24, 20, 120, g.at(24, 24, 40)));                  // a deeper floorboard at Tier 3
    g.S(h.path([80, 44]).C([90, -60], [110, -120], [128, -170]).L([160, -170]).C([150, -100], [140, -20], [150, 44]).Z());
    var fender = h.path([90, 80]).C([90, 0], [230, 0], [230, 80]).L([214, 80]).C([214, 20], [106, 20], [106, 80]).Z();
    if (g.is(2)) g.S(fender); else g.K(fender);
    g.L(h.line([144, -170], [144, -196]));
    g.L(h.line([100, -196], [200, -196]));
    g.S(h.circle(150, -232, 32));
    if (g.lvl >= 2) g.D(h.path([-220, 10]).Q([-140, -30], [-50, -40]).open());
  });
});
C.define({ id:"tugboat", title:"The Harbor Tugboat", cat:"classic-vehicles", fit:"page",
  tags:["boats", "harbors", "work", "sea"], sensitive:["water"], talk:"What kind of work would you enjoy watching at a harbor?" }, function(g){
  kit.scene(g, { horizon:500, hills:false, water:520, sunX:130, sunY:150 });
  g.group({ x:300, y:560, s:1 }, function(g){
    g.S(h.rrect(30, -330, 70, 150, 10));
    g.S(h.rect(24, -280, 82, 30), 2);
    g.S(h.path([-150, -150]).L([-150, -270]).L([90, -270]).L([90, -150]).Z());
    g.at([-120, -60, 0], [-120, -60, 0], [-120, -30]).forEach(function(x){ g.S(h.rrect(x, -250, g.at(44, 44, 70), 60, 8)); });
    g.S(h.path([-260, -150]).L([250, -150]).Q([290, -150], [290, -110]).C([260, 20], [100, 40], [0, 40]).L([-190, 40]).C([-240, 30], [-270, -60], [-260, -150]).Z());
    g.D(h.path([-250, -110]).L([270, -110]).open());
    [-150, -50, 50, 150].forEach(function(x){ g.S(h.circle(x, -60, 24), 2); });
  });
});

C.define({ id:"biplane", title:"The Biplane", cat:"classic-vehicles", era:"1930s", fit:"page",
  tags:["airplanes", "flying", "sky", "adventure"], talk:"Where would you fly if you could go anywhere?" }, function(g){
  kit.frame(g);
  g.S(h.smooth([[110, 250], [124, 218], [160, 212], [180, 190], [220, 190], [242, 210], [266, 210], [280, 234], [266, 254]]), 2);
  g.S(h.smooth([[380, 640], [394, 612], [430, 606], [450, 586], [490, 586], [512, 606], [536, 606], [550, 630], [536, 650]]), 3);
  if (g.lvl >= 2) g.S(h.path([24, 700]).C([200, 640], [400, 690], [576, 650]).L([576, 776]).L([24, 776]).Z());
  g.group({ x:300, y:440, s:1, rot:-8 }, function(g){
    [[-60, 120], [60, 120]].forEach(function(w){ g.L(h.line([w[0], 40], [w[0], w[1] - 24])); if (g.is(2)) g.S(h.circle(w[0], w[1], 26)); else g.K(h.circle(w[0], w[1], 26)); });
    if (g.is(2)) g.S(h.rrect(-230, 26, 460, 40, 18));
    if (g.is(2)) g.S(h.path([-240, -10]).L([-300, -90]).L([-270, -90]).L([-200, -30]).Z());
    else g.S(h.path([-246, -4]).L([-316, -116]).L([-262, -116]).L([-186, -30]).Z());         // a bigger fin at Tier 3
    g.S(h.path([-250, 0]).C([-250, -40], [-200, -60], [-120, -60]).L([180, -50]).Q([230, -44], [240, 0]).Q([230, 44], [180, 50]).L([-120, 60]).C([-200, 60], [-250, 40], [-250, 0]).Z());
    if (g.lvl >= 2) g.D(h.line([-150, 0], [120, 4]));
    if (g.is(2)) g.S(h.path([-40, -58]).Q([-20, -108], [30, -102]).L([30, -56]).Z());
    else { g.K(h.path([-40, -58]).Q([-24, -90], [26, -88]).L([26, -56]).Z()); g.S(h.rrect(-230, 26, 460, 40, 18)); }   // Tier 3: lower windscreen, the lower wing in front
    g.L(h.line([-150, -96], [-150, -50])); g.L(h.line([150, -96], [150, -46]));
    if (g.lvl >= 2){ g.D(h.line([-150, -96], [-80, -52])); g.D(h.line([150, -96], [80, -48])); }
    g.S(h.rrect(-230, -136, 460, 40, 18));
    g.S(h.ellipse(250, 0, 16, 70));
  });
});
C.define({ id:"hot-air-balloon", title:"The Hot Air Balloon", cat:"classic-vehicles", fit:"page",
  tags:["balloons", "sky", "festivals", "adventure"], talk:"What would you like to see from high above?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 2) g.S(h.smooth([[60, 600], [72, 574], [104, 568], [122, 550], [156, 550], [174, 568], [198, 568], [210, 590], [198, 608]]), 2);
  if (g.lvl >= 2) g.S(h.path([24, 680]).C([150, 610], [300, 630], [420, 660]).C([480, 630], [540, 630], [576, 650]).L([576, 776]).L([24, 776]).Z());
  var cx = 300;
  g.S(h.path([cx, 60]).C([470, 60], [520, 230], [470, 360]).C([440, 440], [380, 480], [350, 520]).L([250, 520]).C([220, 480], [160, 440], [130, 360]).C([80, 230], [130, 60], [cx, 60]).Z());
  var gores = g.at(7, 5, 3);
  for (var i = 1; i < gores; i++){ var f = i / gores, x = 130 + 340 * f; var bulge = (x - cx) * .4; g.L(h.path([cx + (x - cx) * .15, 62]).Q([x + bulge, 250], [250 + 100 * f, 518]).open()); }
  if (g.lvl >= 2) g.L(h.path([140, 380]).Q([cx, 430], [460, 380]).open());
  g.S(h.rect(248, 516, 104, 22));
  [[252, 538], [348, 538]].forEach(function(r){ g.L(h.line(r, [r[0] + (r[0] < cx ? 14 : -14), 600])); });
  g.S(h.path([250, 600]).L([350, 600]).L([340, 680]).L([260, 680]).Z());
  if (g.lvl >= 2){ g.D(h.line([252, 630], [348, 630])); }
});

function fireEngine(g){
  g.S(h.path([30, 450]).L([30, 330]).L([380, 330]).L([380, 280]).Q([380, 250], [410, 250]).L([470, 250]).Q([496, 250], [510, 280]).L([540, 350])
    .Q([572, 362], [574, 400]).L([574, 450]).L([522, 450]).C([520, 390], [412, 390], [410, 450]).L([190, 450]).C([188, 390], [80, 390], [78, 450]).Z());
  g.S(h.path([420, 330]).L([420, 270]).L([464, 270]).Q([478, 270], [486, 286]).L([506, 330]).Z());
  g.S(h.rect(40, 290, 340, 20)); g.S(h.rect(40, 250, 340, 20), 2);
  var rungs = g.at(9, 6, 4);
  for (var i = 0; i <= rungs; i++){ var x = 50 + i * 320 / rungs; g.L(h.line([x, 270], [x, 290]), 3); }
  g.S(h.circle(240, 390, 36)); g.S(h.circle(240, 390, 14), 3);
  g.S(h.circle(410, 220, 20), 3); g.L(h.line([410, 240], [410, 250]), 3);
  g.D(h.line([40, 360], [380, 360]));
  g.S(h.rrect(552, 432, 34, 22, 9), 3); g.S(h.rrect(16, 432, 34, 22, 9), 3);
  g.S(h.circle(556, 392, 12), 3);
  wheel(g, 134, 452, 46); wheel(g, 466, 452, 46);
}
inScene({ id:"fire-engine", title:"The Fire Engine", cat:"classic-vehicles", era:"1940s",
  tags:["fire-engines", "trucks", "community", "helpers"], sensitive:["driving", "storms"], talk:"Who are the helpers you admire in a community?" },
  { road:[610, 700], trees:[[90, 60]] }, { span:[16, 586], anchorY:498, y:690, width:540 }, fireEngine);
})(globalThis.CogniCore);
