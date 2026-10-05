/* Cognicopia Coloring designs: Nostalgic Heritage. Heirloom kitchenware, clocks,
   radios and telephones, the sewing room, and farm landmarks. Clock faces
   carry tick marks, never numerals: the picture stays free of text. */
(function(C){
"use strict";
var h = C.helpers, kit = C.kit;

/* a clock face: ticks by tier (12, 4 or none) and two solid hands at h:m */
function clockFace(g, cx, cy, r, hr, mn){
  g.S(h.circle(cx, cy, r));
  if (g.lvl >= 2) for (var i = 0; i < 12; i++){
    var big = i % 3 === 0;
    if (!big && g.lvl < 3) continue;
    g.D(h.line(h.onCircle(cx, cy, r * (big ? .72 : .8), i * 30 - 90), h.onCircle(cx, cy, r * .9, i * 30 - 90)));
  }
  var ha = ((hr % 12) + mn / 60) * 30 - 90, ma = mn * 6 - 90;
  g.K(h.poly([h.onCircle(cx, cy, r * .1, ha + 90), h.onCircle(cx, cy, r * .5, ha), h.onCircle(cx, cy, r * .1, ha - 90), h.onCircle(cx, cy, r * .14, ha + 180)]));
  g.K(h.poly([h.onCircle(cx, cy, r * .08, ma + 90), h.onCircle(cx, cy, r * .74, ma), h.onCircle(cx, cy, r * .08, ma - 90), h.onCircle(cx, cy, r * .12, ma + 180)]));
  g.K(h.circle(cx, cy, r * .07));
}
function ground(g, y, x0, x1){ g.L(h.line([x0 || 40, y], [x1 || 560, y]), 3); }

C.define({ id:"teapot-and-cup", title:"Teatime", cat:"nostalgic-heritage",
  tags:["tea", "kitchen", "china", "hospitality"], talk:"How do you like your tea or coffee, and who would you share it with?" }, function(g){
  g.S(h.path([420, 520]).C([470, 500], [500, 440], [530, 380]).L([556, 392]).C([530, 470], [500, 560], [436, 590]).Z());           // spout
  g.S(h.path([176, 470]).C([80, 450], [70, 610], [180, 600]).L([184, 574]).C([116, 574], [118, 494], [180, 500]).Z());               // handle
  g.S(h.mirror([[300, 400], [380, 408], [440, 460], [454, 540], [430, 610], [370, 650], [300, 654]], 300));                          // body
  g.S(h.path([220, 410]).Q([226, 346], [300, 340]).Q([374, 346], [380, 410]).Z());                                                   // lid
  g.S(h.ellipse(300, 410, 90, 16));
  if (g.is(2)) g.S(h.circle(300, 326, 22)); else g.K(h.circle(300, 326, 22));
  g.D(h.path([152, 520]).Q([300, 560], [448, 520]).open()); g.D(h.path([160, 590]).Q([300, 626], [440, 590]).open(), 3);
  if (g.lvl >= 2){
    g.S(h.ellipse(470, 736, 110, 22));                                                                                               // saucer
    g.S(h.path([398, 640]).L([542, 640]).Q([536, 724], [470, 728]).Q([404, 724], [398, 640]).Z());
    g.S(h.path([540, 656]).C([600, 650], [600, 710], [530, 706]).L([532, 690]).C([578, 690], [578, 668], [538, 672]).Z());
    g.D(h.path([404, 664]).Q([470, 680], [536, 664]).open(), 3);
  }
  ground(g, 760, 30, 570);
});

C.define({ id:"rotary-telephone", title:"The Rotary Telephone", cat:"nostalgic-heritage", era:"1950s",
  tags:["telephones", "keeping-in-touch", "home"], talk:"Who would you most like to ring up for a chat?" }, function(g){
  g.L(h.smooth([[140, 660], [60, 640], [56, 520], [120, 470]], true));
  g.S(h.rrect(116, 656, 368, 32, 12));
  g.S(h.path([144, 664]).L([184, 444]).Q([192, 412], [224, 412]).L([376, 412]).Q([408, 412], [416, 444]).L([456, 664]).Z());
  g.S(h.path([116, 396]).Q([116, 352], [168, 352]).L([432, 352]).Q([484, 352], [484, 396]).L([484, 412]).Q([484, 432], [456, 432]).L([424, 432]).Q([400, 432], [392, 408])
    .L([208, 408]).Q([200, 432], [176, 432]).L([144, 432]).Q([116, 432], [116, 412]).Z());
  if (g.lvl >= 2){ g.S(h.circle(160, 392, 18)); g.S(h.circle(440, 392, 18)); }
  g.S(h.circle(300, 552, 88));
  if (g.lvl >= 2) for (var i = 0; i < 10; i++){ var q = h.onCircle(300, 552, 60, -60 + i * 27); g.S(h.circle(q[0], q[1], g.at(14, 16, 16))); }
  g.S(h.circle(300, 552, g.at(30, 36, 44)));
  if (g.lvl >= 3) g.D(h.path(h.onCircle(300, 552, 76, -70)).Q(h.onCircle(300, 552, 100, -80), h.onCircle(300, 552, 82, -94)).open());
});

C.define({ id:"cathedral-radio", title:"The Family Radio", cat:"nostalgic-heritage", era:"1930s",
  tags:["radio", "music", "evenings", "home"], talk:"What would you like to hear on the radio this evening?" }, function(g){
  g.S(h.rrect(96, 610, 408, 34, 12));
  g.S(h.path([116, 610]).L([116, 400]).Q([116, 230], [300, 230]).Q([484, 230], [484, 400]).L([484, 610]).Z());
  if (g.lvl >= 2) g.D(h.path([140, 600]).L([140, 404]).Q([140, 256], [300, 256]).Q([460, 256], [460, 404]).L([460, 600]).open(), 3);
  g.S(h.path([180, 470]).L([180, 404]).Q([180, 300], [300, 300]).Q([420, 300], [420, 404]).L([420, 470]).Z());
  var bars = g.at([236, 268, 300, 332, 364], [250, 300, 350], [300]);
  bars.forEach(function(x){ var top = 404 - Math.sqrt(Math.max(0, 120 * 120 - (x - 300) * (x - 300))) * .86; g.L(h.line([x, top + 6], [x, 464])); });
  g.S(h.circle(300, 530, 40));
  g.S(h.circle(200, 540, 24)); g.S(h.circle(400, 540, 24));
  if (g.lvl >= 3){ g.D(h.line([300, 500], [300, 530])); g.S(h.circle(300, 530, 14)); }
});

C.define({ id:"sewing-machine", title:"The Sewing Machine", cat:"nostalgic-heritage", era:"1950s",
  tags:["sewing", "needlework", "handmade", "sewing-room"], talk:"What is something special that was sewn or mended by hand?" }, function(g){
  g.S(h.rect(88, 536, 28, 208)); g.S(h.rect(484, 536, 28, 208));
  if (g.lvl >= 2){ g.S(h.rect(116, 680, 368, 20)); g.S(h.rrect(220, 704, 160, 24, 8)); }
  g.S(h.rrect(56, 500, 488, 36, 8));
  if (g.lvl >= 2){ g.S(h.rrect(372, 536, 112, 52, 6)); g.S(h.circle(428, 562, 8)); }
  g.S(h.rrect(116, 464, 368, 36, 8));
  g.S(h.path([460, 464]).L([460, 300]).Q([460, 256], [416, 256]).L([180, 256]).Q([140, 256], [140, 296]).L([140, 404]).L([208, 404]).L([208, 332]).L([384, 332]).L([384, 464]).Z());
  g.S(h.circle(480, 344, 40)); g.DS(h.circle(480, 344, 16), 2);
  g.L(h.line([172, 404], [172, 448])); g.S(h.rrect(152, 444, 40, 16, 4));
  if (g.lvl >= 2){ g.S(h.rrect(292, 216, 36, 40, 6)); g.L(h.path([310, 216]).Q([240, 190], [180, 256]).open()); }
  g.D(h.line([150, 296], [450, 296]), 3);
});

C.define({ id:"grandfather-clock", title:"The Grandfather Clock", cat:"nostalgic-heritage",
  tags:["clocks", "heirlooms", "hallway"], talk:"Where would you put a tall clock like this?" }, function(g){
  g.S(h.path([176, 144]).L([176, 120]).Q([300, 30], [424, 120]).L([424, 144]).Z());
  if (g.lvl >= 2){ g.K(h.circle(176, 104, 14)); g.K(h.circle(424, 104, 14)); g.K(h.circle(300, 56, 14)); }
  g.S(h.rrect(188, 144, 224, 224, 12));
  clockFace(g, 300, 256, 90, 10, 10);
  g.S(h.rect(216, 368, 168, 300));
  g.S(h.path([248, 636]).L([248, 452]).Q([300, 388], [352, 452]).L([352, 636]).Z());
  g.L(h.line([300, 408], [300, 556])); g.S(h.circle(300, 580, 30));
  g.S(h.rrect(196, 668, 208, 80, 6)); g.S(h.rrect(180, 744, 240, 24, 8));
  if (g.lvl >= 3){ g.D(h.rrect(228, 684, 144, 48, 10)); g.D(h.line([200, 368], [216, 368])); }
});

C.define({ id:"schoolhouse-clock", title:"The Schoolhouse Clock", cat:"nostalgic-heritage",
  tags:["clocks", "school", "kitchen"], sensitive:["children"], talk:"What did a clock like this tick away the hours for?" }, function(g){
  g.S(h.path([208, 444]).L([392, 444]).L([372, 664]).L([228, 664]).Z());
  g.S(h.rrect(256, 488, 88, 132, 16));
  g.L(h.line([300, 488], [300, 572])); if (g.lvl >= 2) g.S(h.circle(300, 584, 20)); else g.K(h.circle(300, 584, 20));
  g.S(h.rrect(276, 664, 48, 24, 6), 2);
  g.S(h.ngon(300, 284, 190, 8, 22.5));
  if (g.lvl >= 3) g.D(h.ngon(300, 284, 164, 8, 22.5));
  clockFace(g, 300, 284, 140, 2, 50);
  g.S(h.circle(300, 80, 10));
});

C.define({ id:"pocket-watch", title:"The Pocket Watch", cat:"nostalgic-heritage",
  tags:["watches", "heirlooms", "clocks"], talk:"Who in your life was never late?" }, function(g){
  if (g.lvl >= 2){
    var P0 = [300, 170], Cc = [430, 40], P1 = [520, 190];
    var at = function(t){ return [(1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * Cc[0] + t * t * P1[0], (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * Cc[1] + t * t * P1[1]]; };
    var n = g.at(11, 0, 0);                                        // the chain's links from Tier 1 only
    for (var i = 1; i <= n; i++){ var p = at(i / (n + 1)), p2 = at(i / (n + 1) + .01), a = Math.atan2(p2[1] - p[1], p2[0] - p[0]) * 180 / Math.PI; g.S(h.ellipse(p[0], p[1], 20, 11, a + (i % 2 ? 0 : 90))); }
    if (g.lvl >= 3){ g.S(h.circle(520, 190, 12)); g.S(h.rrect(490, 200, 60, 18, 8)); }
    else g.L(h.path(P0).Q(Cc, P1).open());                           // Tier 2: the chain as one bold line
  }
  g.S(h.circle(300, 190, 30)); g.S(h.circle(300, 190, 14), 3);
  g.S(h.rrect(280, 214, 40, 36, 8));
  g.S(h.circle(300, 470, 220));
  g.D(h.circle(300, 470, 200), 3);
  clockFace(g, 300, 470, g.at(170, 176, 180), 9, 15);
  if (g.lvl >= 3) g.S(h.circle(300, 560, 34));
});

C.define({ id:"coffee-percolator", title:"The Coffee Percolator", cat:"nostalgic-heritage", era:"1950s",
  tags:["coffee", "kitchen", "mornings"], talk:"What is the best part of a slow morning?" }, function(g){
  g.S(h.path([228, 720]).L([372, 720]).L([392, 760]).L([208, 760]).Z());
  g.S(h.path([236, 250]).L([364, 250]).L([400, 720]).L([200, 720]).Z());
  g.S(h.path([390, 440]).C([470, 420], [480, 330], [520, 290]).L([540, 304]).C([500, 360], [490, 470], [396, 500]).Z());
  g.S(h.path([214, 300]).C([120, 320], [120, 600], [206, 640]).L([212, 606]).C([160, 580], [160, 360], [220, 336]).Z());
  g.S(h.rrect(216, 226, 168, 32, 10));
  g.S(h.path([256, 226]).Q([256, 170], [300, 170]).Q([344, 170], [344, 226]).Z());
  g.S(h.path([280, 170]).Q([280, 126], [300, 122]).Q([320, 126], [320, 170]).Z());
  g.D(h.line([220, 480], [380, 480])); g.D(h.line([212, 600], [388, 600]), 3);
  if (g.lvl >= 2){
    g.S(h.path([440, 640]).L([556, 640]).Q([552, 740], [498, 744]).Q([444, 740], [440, 640]).Z());
    g.S(h.path([554, 660]).C([600, 660], [600, 716], [546, 712]).L([548, 696]).C([580, 696], [580, 676], [552, 678]).Z());
    g.S(h.ellipse(498, 752, 86, 14));
  }
});

C.define({ id:"stand-mixer", title:"The Stand Mixer", cat:"nostalgic-heritage", era:"1950s",
  tags:["baking", "kitchen", "appliances"], talk:"What would you bake for a special occasion?" }, function(g){
  g.S(h.rrect(100, 700, 400, 48, 18));
  g.S(h.path([140, 700]).L([140, 330]).Q([140, 290], [180, 290]).L([230, 290]).L([230, 700]).Z());
  g.S(h.path([150, 250]).Q([150, 170], [240, 166]).L([420, 170]).Q([500, 176], [500, 250]).Q([500, 310], [440, 320]).L([220, 322]).Q([150, 318], [150, 250]).Z());
  g.D(h.path([420, 186]).Q([470, 200], [480, 250]).open(), 2);
  g.D(h.line([240, 190], [240, 314]), 3);
  g.S(h.circle(190, 250, 18), 2);
  g.L(h.line([380, 322], [380, 460]));
  g.S(h.path([380, 460]).C([340, 480], [340, 560], [380, 580]).C([420, 560], [420, 480], [380, 460]).Z(), 2);
  g.S(h.mirror([[380, 470], [480, 474], [494, 520], [470, 640], [430, 690], [380, 696]], 380));
  g.D(h.path([294, 520]).Q([380, 540], [466, 520]).open(), 3);
});

C.define({ id:"chrome-toaster", title:"The Chrome Toaster", cat:"nostalgic-heritage", era:"1950s",
  tags:["breakfast", "kitchen", "appliances"], talk:"What do you like on your toast?" }, function(g){
  var slice = function(x, lv){ g.S(h.path([x - 70, 380]).L([x - 70, 250]).Q([x - 84, 200], [x - 40, 190]).Q([x, 170], [x + 40, 190]).Q([x + 84, 200], [x + 70, 250]).L([x + 70, 380]).Z(), lv); g.D(h.path([x - 54, 370]).L([x - 54, 256]).Q([x - 64, 218], [x - 30, 208]).Q([x, 192], [x + 30, 208]).Q([x + 64, 218], [x + 54, 256]).L([x + 54, 370]).open(), 3); };
  slice(210, 1); slice(390, 2);
  g.S(h.path([90, 700]).L([90, 400]).Q([90, 330], [170, 330]).L([430, 330]).Q([510, 330], [510, 400]).L([510, 700]).Z());
  g.S(h.rrect(130, 318, 160, 30, 12)); g.S(h.rrect(310, 318, 160, 30, 12));
  if (g.is(2)) g.S(h.rrect(500, 470, 44, 30, 10)); else g.K(h.rrect(500, 466, 48, 38, 10));
  g.D(h.line([110, 520], [490, 520])); g.D(h.line([110, 560], [490, 560]), 3);
  [110, 420].forEach(function(x){ var d = h.rrect(x, 700, 70, 24, 8); if (g.is(2)) g.S(d); else g.K(d); });
  g.D(h.path([120, 420]).Q([140, 380], [180, 372]).open(), 3);
});

C.define({ id:"canning-jars", title:"Canning Jars", cat:"nostalgic-heritage", season:"fall",
  tags:["canning", "preserves", "harvest", "kitchen"], talk:"What would you put up in jars for the winter?" }, function(g){
  var jar = function(x, w, hgt, lv, fruit){
    var top = 760 - hgt;
    g.S(h.path([x - w / 2, top + 50]).Q([x - w / 2 - 10, top + 70], [x - w / 2, top + 100]).L([x - w / 2, 740]).Q([x - w / 2, 760], [x - w / 2 + 20, 760]).L([x + w / 2 - 20, 760]).Q([x + w / 2, 760], [x + w / 2, 740]).L([x + w / 2, top + 100]).Q([x + w / 2 + 10, top + 70], [x + w / 2, top + 50]).Z(), lv);
    g.S(h.rrect(x - w / 2 - 6, top, w + 12, 54, 8), lv);
    g.D(h.line([x - w / 2 - 4, top + 26], [x + w / 2 + 4, top + 26]), Math.max(lv, 2));
    if (fruit === "peach") [[-.2, .55], [.22, .72], [-.18, .88]].forEach(function(f){ g.S(h.ellipse(x + f[0] * w, top + f[1] * hgt, w * .22, w * .16, 20), lv); });
    if (fruit === "cherry") [[-.2, .5], [.2, .58], [0, .72], [-.24, .86], [.22, .88]].forEach(function(f){ g.S(h.circle(x + f[0] * w, top + f[1] * hgt, w * .12), Math.max(lv, 3)); });
    if (fruit === "bean") [-.25, -.08, .08, .25].forEach(function(f){ g.S(h.rrect(x + f * w - 9, top + 130, 18, hgt - 170, 9), Math.max(lv, 3)); });
    g.S(h.rrect(x - w * .3, top + hgt * .36, w * .6, w * .3, 10), lv);
  };
  if (g.lvl >= 3) jar(140, 150, 300, 3, "cherry");
  jar(g.at(300, 230, 300), g.at(170, 190, 250), g.at(420, 440, 520), 1, "peach");
  if (g.lvl >= 2) jar(g.at(460, 420, 0), 150, 330, 2, "bean");
  ground(g, 764, 40, 560);
});

C.define({ id:"milk-bottles", title:"The Milkman's Delivery", cat:"nostalgic-heritage", era:"1950s",
  tags:["milk", "deliveries", "doorstep", "kitchen"], talk:"What came to the door in the morning where you grew up?" }, function(g){
  var bottle = function(x, lv){
    g.S(h.mirror([[x, 250], [x + 30, 250], [x + 34, 300], [x + 70, 380], [x + 76, 660], [x + 60, 690], [x, 690]], x), lv);
    g.S(h.rrect(x - 36, 234, 72, 36, 10), lv);
    g.L(h.line([x - 73, 470], [x + 74, 470]), lv); g.L(h.line([x - 74, 560], [x + 75, 560]), lv);
    g.D(h.path([x - 50, 420]).Q([x - 56, 460], [x - 52, 480]).open(), 3);
  };
  bottle(300, 1);
  if (g.lvl >= 2){ bottle(140, 2); bottle(460, 2); }
  if (g.lvl >= 2){
    g.S(h.path([40, 560]).L([560, 560]).L([560, 740]).L([40, 740]).Z());
    [170, 300, 430].forEach(function(x){ g.D(h.line([x, 560], [x, 740])); });
    g.D(h.line([40, 650], [560, 650]), 3);
    g.S(h.rrect(28, 540, 544, 30, 10));
  } else ground(g, 700, 150, 450);
});

C.define({ id:"oil-lamp", title:"The Oil Lamp", cat:"nostalgic-heritage",
  tags:["lamps", "evenings", "farmhouse"], talk:"What makes a room feel cozy in the evening?" }, function(g){
  g.S(h.mirror([[300, 560], [420, 566], [460, 640], [430, 720], [380, 744], [300, 746]], 300));
  g.S(h.rrect(170, 740, 260, 28, 12));
  g.S(h.path([180, 620]).C([90, 610], [90, 700], [176, 700]).L([184, 680]).C([130, 676], [130, 636], [186, 640]).Z(), 2);
  g.S(h.rrect(230, 500, 140, 64, 14));
  g.S(h.mirror([[300, 140], [330, 140], [336, 250], [380, 360], [360, 470], [330, 500], [300, 500]], 300));
  g.S(h.path([290, 480]).Q([270, 430], [300, 380]).Q([330, 430], [310, 480]).Z());
  g.D(h.path([260, 360]).Q([254, 410], [264, 450]).open(), 3);
  g.D(h.path([196, 650]).Q([300, 680], [404, 650]).open(), 3);
});

C.define({ id:"typewriter", title:"The Typewriter", cat:"nostalgic-heritage", era:"1940s",
  tags:["typing", "office", "letters", "writing"], talk:"What would you like to put in a letter to someone?" }, function(g){
  g.S(h.path([230, 180]).L([370, 180]).L([380, 330]).L([220, 330]).Z());
  if (g.lvl >= 3) [215, 245, 275].forEach(function(y){ g.D(h.line([242, y], [358, y])); });
  g.S(h.rrect(96, 316, 408, 48, 20));
  [84, 516].forEach(function(x){ if (g.is(2)) g.S(h.circle(x, 340, 26)); else g.K(h.circle(x, 340, 26)); });
  g.S(h.path([116, 360]).L([484, 360]).L([540, 620]).L([60, 620]).Z());
  g.S(h.rrect(40, 610, 520, 60, 18));
  if (g.lvl >= 2){
    var rows = g.at([[440, 8], [490, 9], [540, 8]], [[450, 6], [520, 6]], []);
    rows.forEach(function(r, i){ for (var k = 0; k < r[1]; k++){ var x = 300 + (k - (r[1] - 1) / 2) * g.at(52, 64, 0); g.S(h.circle(x, r[0], g.at(16, 20, 0))); } });
    g.S(h.rrect(200, 580, 200, 22, 10));
  } else g.S(h.rrect(170, 500, 260, 60, 20));
  g.S(h.path([504, 330]).L([570, 300]).L([580, 316]).L([520, 350]).Z(), 2);
});

C.define({ id:"box-camera", title:"The Family Camera", cat:"nostalgic-heritage", era:"1950s",
  tags:["cameras", "photographs", "memories"], talk:"If you could take a picture of anything today, what would it be?" }, function(g){
  g.L(h.path([150, 300]).C([150, 120], [450, 120], [450, 300]).open(), 2);
  g.S(h.rrect(110, 290, 380, 300, 24));
  g.S(h.rrect(150, 250, 110, 50, 10));
  g.S(h.rrect(370, 256, 60, 44, 10));
  g.S(h.circle(300, 450, 110));
  g.S(h.circle(300, 450, 72));
  g.S(h.circle(300, 450, g.at(34, 38, 40)), 2);
  g.S(h.rrect(140, 320, 70, 44, 8), 2);
  g.D(h.line([110, 560], [490, 560]), 3);
  if (g.lvl >= 3) g.D(h.path([266, 416]).Q([276, 400], [296, 396]).open());
});

C.define({ id:"phonograph", title:"The Phonograph", cat:"nostalgic-heritage", era:"1920s",
  tags:["music", "records", "dancing"], talk:"What song makes you want to tap your feet?" }, function(g){
  g.S(h.path([260, 480]).C([300, 380], [360, 300], [470, 150]).L([560, 250]).C([440, 330], [370, 400], [300, 500]).Z());     // horn
  g.S(h.ellipse(515, 200, 72, 36, 42));
  if (g.lvl >= 2) g.D(h.ellipse(515, 200, 44, 20, 42), 3);
  if (g.lvl >= 2) [[.35, 1], [.6, 1]].forEach(function(t){ var a = h.lerp([260, 480], [470, 150], t[0]), b = h.lerp([300, 500], [560, 250], t[0]); g.D(h.path(a).Q(h.lerp(a, b, .5).map(function(v, i){ return v + (i ? 12 : -8); }), b).open(), 3); });
  g.S(h.ellipse(250, 520, 170, 38));
  g.D(h.ellipse(250, 520, 110, 24), 2); g.S(h.ellipse(250, 520, 24, 6), 3);
  g.S(h.path([80, 530]).L([420, 530]).L([420, 720]).L([80, 720]).Z());
  g.S(h.path([420, 530]).L([500, 490]).L([500, 670]).L([420, 720]).Z());
  g.D(h.rrect(130, 580, 240, 100, 12), 2);
  g.S(h.path([500, 560]).L([560, 540]).L([568, 556]).L([500, 584]).Z(), 2);
  g.S(h.circle(572, 548, 16), 2);
});

C.define({ id:"rural-mailbox", title:"The Country Mailbox", cat:"nostalgic-heritage",
  tags:["mail", "letters", "country-roads"], talk:"What is the nicest thing that could arrive in the mail?" }, function(g){
  if (g.lvl >= 2){ [[150, 700], [460, 710]].forEach(function(f){ g.L(h.line([f[0], 770], [f[0] + 10, f[1] - 60])); g.S(h.scallop(f[0] + 10, f[1] - 90, 40, 6, .3)); g.S(h.circle(f[0] + 10, f[1] - 90, 14)); }); }
  g.S(h.rect(276, 440, 48, 330));
  g.S(h.rect(200, 420, 200, 26));
  g.S(h.path([90, 420]).L([90, 260]).Q([90, 150], [260, 150]).L([500, 150]).L([500, 420]).Z());
  g.S(h.path([500, 420]).L([500, 150]).Q([560, 150], [560, 260]).L([560, 420]).Z());
  g.D(h.path([108, 260]).Q([112, 176], [240, 172]).open(), 3);
  g.S(h.rect(40, 210, 20, 150)); g.S(h.poly([[60, 210], [150, 210], [150, 270], [60, 270]]));
  g.S(h.circle(530, 290, 12), 2);
  if (g.lvl >= 3){ g.S(h.path([500, 190]).L([590, 176]).L([594, 236]).L([504, 250]).Z()); }
  ground(g, 770, 60, 540);
});

C.define({ id:"lighthouse", title:"The Lighthouse", cat:"nostalgic-heritage", fit:"page",
  tags:["lighthouses", "coast", "landmarks"], sensitive:["water"], talk:"What is the most beautiful place you have seen by the sea or a lake?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 3) g.S(h.smooth([[80, 180], [96, 150], [132, 146], [150, 126], [190, 126], [210, 148], [236, 150], [244, 176], [230, 194]]));
  g.S(h.path([24, 560]).L([576, 560]).L([576, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.D(h.wave(40, 240, 640, 8, 3)); g.D(h.wave(330, 560, 700, 8, 3)); }
  g.S(h.path([24, 560]).C([120, 520], [260, 500], [400, 540]).C([470, 560], [520, 600], [540, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.S(h.path([390, 540]).L([390, 460]).L([540, 460]).L([540, 580]).Z(), 2); g.S(h.poly([[376, 464], [465, 400], [554, 464]]), 2); g.S(h.rect(440, 500, 40, 60), 3); }
  g.S(h.path([230, 560]).L([262, 230]).L([338, 230]).L([370, 560]).Z());
  var bands = g.at([[290, 350], [410, 470]], [[330, 420]], [[330, 420]]);
  bands.forEach(function(b){ var w0 = 38 + (b[0] - 230) * .097, w1 = 38 + (b[1] - 230) * .097; g.L(h.line([300 - w0, b[0]], [300 + w0, b[0]])); g.L(h.line([300 - w1, b[1]], [300 + w1, b[1]])); });
  g.S(h.rrect(236, 210, 128, 24, 6));
  g.S(h.rect(262, 140, 76, 70));
  if (g.lvl >= 2) g.L(h.line([300, 140], [300, 210]), 2);
  if (g.is(2)){ g.S(h.poly([[250, 142], [300, 96], [350, 142]])); g.S(h.circle(300, 90, 10)); }
  else { g.K(h.poly([[250, 142], [300, 96], [350, 142]])); g.K(h.circle(300, 90, 10)); }
  if (g.lvl >= 2) g.S(h.rrect(284, 480, 32, 80, 14));
});

C.define({ id:"red-barn", title:"The Red Barn", cat:"nostalgic-heritage", fit:"page",
  tags:["barns", "farms", "country"], sensitive:["home"], talk:"What animals or crops would a barn like this hold?" }, function(g){
  kit.scene(g, { horizon:560, trees:g.lvl >= 3 ? [[70, 70]] : null, sunX:130, sunY:140 });
  if (g.lvl >= 2){ g.S(h.path([440, 600]).L([440, 250]).Q([490, 200], [540, 250]).L([540, 600]).Z()); g.S(h.path([440, 256]).Q([490, 190], [540, 256]).Q([490, 226], [440, 256]).Z(), 3); [330, 410, 490].forEach(function(y){ g.D(h.line([440, y], [540, y])); }); }
  g.S(h.path([90, 640]).L([90, 380]).L([140, 290]).L([260, 240]).L([380, 290]).L([430, 380]).L([430, 640]).Z());
  g.D(h.poly([[90, 380], [140, 290], [260, 240], [380, 290], [430, 380]], true));
  g.S(h.rect(196, 480, 128, 160));
  g.L(h.line([260, 480], [260, 640]));
  g.L(h.line([196, 480], [260, 640])); g.L(h.line([324, 480], [260, 640]));
  g.S(h.rect(222, 320, 76, 72));
  if (g.lvl >= 2) g.D(h.line([222, 320], [298, 392]));
  if (g.lvl >= 3){ g.S(h.rect(116, 440, 50, 50)); g.S(h.rect(354, 440, 50, 50)); }
  if (g.lvl >= 3){
    [40, 100, 460, 520].forEach(function(x){ g.S(h.rect(x, 640, 16, 90)); });
    [670, 704].forEach(function(y){ g.L(h.line([24, y], [132, y])); g.L(h.line([444, y], [576, y])); });
  }
});

C.define({ id:"farm-windmill", title:"The Farm Windmill", cat:"nostalgic-heritage", fit:"page",
  tags:["windmills", "farms", "wind", "country"], talk:"What sounds would you hear on a windy day in the country?" }, function(g){
  kit.scene(g, { horizon:600, sunX:470, sunY:140, cloud:true });
  g.L(h.line([236, 720], [290, 300])); g.L(h.line([364, 720], [310, 300]));
  if (g.lvl >= 2) [380, 460, 540, 620].forEach(function(y, i){ var f = (y - 300) / 420; g.D(h.line([290 - f * 54, y], [310 + f * 54, y])); });
  if (g.lvl >= 3) [[380, 460], [460, 540], [540, 620], [620, 700]].forEach(function(p){ var f0 = (p[0] - 300) / 420, f1 = (p[1] - 300) / 420; g.D(h.line([290 - f0 * 54, p[0]], [310 + f1 * 54, p[1]])); });
  var n = g.at(16, 12, 6), ai = g.at(4, 4, 7), ao = g.at(8, 8, 14);      // fewer, broader vanes at Tier 3
  for (var i = 0; i < n; i++){ var a = i * 360 / n + g.at(0, 0, 30); g.S(h.poly([h.onCircle(300, 250, 34, a - ai), h.onCircle(300, 250, 150, a - ao), h.onCircle(300, 250, 150, a + ao), h.onCircle(300, 250, 34, a + ai)])); }   // Tier 3: no vane along the tail
  g.S(h.circle(300, 250, 34));
  g.S(h.path([330, 240]).L([470, 230]).L([520, 180]).L([530, 320]).L([470, 270]).L([330, 262]).Z());
  if (g.lvl >= 2){ g.S(h.rect(410, 640, 140, 90)); g.S(h.ellipse(480, 640, 70, 14)); }
});

C.define({ id:"covered-bridge", title:"The Covered Bridge", cat:"nostalgic-heritage", fit:"page",
  tags:["bridges", "country-roads", "rivers", "landmarks"], sensitive:["water"], talk:"Where does this road over the bridge lead?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 2) g.S(h.circle(470, 130, 48));
  if (g.lvl >= 3) g.S(h.path([24, 420]).C([140, 340], [260, 360], [330, 400]).C([420, 350], [520, 350], [576, 400]).L([576, 776]).L([24, 776]).Z());
  g.S(h.path([24, 470]).C([160, 450], [440, 460], [576, 450]).L([576, 776]).L([24, 776]).Z());
  g.S(h.path([24, 600]).C([200, 580], [400, 620], [576, 600]).L([576, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.D(h.wave(60, 260, 660, 7, 3)); g.D(h.wave(320, 540, 710, 7, 3)); }
  g.S(h.path([60, 600]).L([80, 560]).L([520, 560]).L([540, 600]).Z());
  g.S(h.rect(100, 360, 400, 200));
  g.S(h.poly([[70, 370], [140, 280], [460, 280], [530, 370]]));
  g.S(h.path([180, 560]).L([180, 440]).Q([180, 400], [220, 400]).L([380, 400]).Q([420, 400], [420, 440]).L([420, 560]).Z());
  if (g.lvl >= 2) [140, 460].forEach(function(x){ g.S(h.rect(x - 16, 420, 32, 40)); });
  if (g.lvl >= 3) [120, 150, 450, 480].forEach(function(x){ g.D(h.line([x, 370], [x, 410])); });
});

C.define({ id:"rocking-chair", title:"The Rocking Chair", cat:"nostalgic-heritage",
  tags:["porches", "furniture", "resting"], talk:"Where is the most comfortable chair you have ever sat in?" }, function(g){
  g.S(h.path([184, 524]).L([140, 224]).L([168, 220]).L([212, 524]).Z());
  g.S(h.path([416, 524]).L([420, 224]).L([448, 226]).L([444, 524]).Z(), 2);
  g.S(h.rrect(120, 192, 80, 32, 12));
  if (g.lvl >= 2){ [0, 1, 2].forEach(function(k){ g.S(h.path([176 + k * 6, 260 + k * 80]).L([424 + k * 1, 260 + k * 80]).L([424, 282 + k * 80]).L([180 + k * 6, 282 + k * 80]).Z()); }); }
  if (g.lvl >= 1 && g.lvl < 2) g.S(h.path([168, 240]).L([430, 240]).L([430, 500]).L([200, 500]).Z());
  g.S(h.rect(188, 552, 24, 160)); g.S(h.rect(408, 552, 24, 168));
  g.S(h.path([172, 524]).L([444, 524]).L([452, 556]).L([164, 556]).Z());
  if (g.lvl >= 2) g.S(h.rrect(196, 496, 224, 32, 14));
  var arm = h.path([412, 428]).L([460, 440]).Q([480, 446], [476, 464]).L([470, 470]).L([410, 456]).Z(), post = h.rect(430, 452, 20, 90);
  if (g.is(2)){ g.S(arm); g.S(post); } else { g.K(arm); g.K(post); }
  g.S(h.path([72, 700]).Q([300, 772], [528, 692]).L([532, 712]).Q([300, 796], [68, 720]).Z());
});

C.define({ id:"wood-cookstove", title:"The Wood Cookstove", cat:"nostalgic-heritage", era:"1920s",
  tags:["kitchen", "cooking", "farmhouse", "warmth"], talk:"What was cooking on the stove on a cold day?" }, function(g){
  g.S(h.rect(400, 60, 44, 260));
  if (g.lvl >= 2) g.D(h.line([400, 180], [444, 180]));
  g.S(h.path([60, 320]).L([540, 320]).L([540, 360]).L([60, 360]).Z());
  g.S(h.rect(80, 360, 440, 300));
  g.S(h.rrect(110, 400, 180, 150, 10)); g.S(h.rrect(320, 400, 170, 150, 10));
  g.K(h.rrect(190, 460, 20, 30, 6)); g.K(h.rrect(395, 460, 20, 30, 6));
  if (g.lvl >= 2){ g.S(h.rect(110, 580, 380, 50)); g.D(h.line([300, 580], [300, 630])); }
  [92, 478].forEach(function(x){ if (g.is(2)) g.S(h.rect(x, 660, 30, 60)); else g.K(h.rect(x, 660, 30, 60)); });
  g.S(h.ellipse(200, 320, 70, 10), 2);
  g.S(h.mirror([[200, 190], [250, 200], [280, 250], [270, 300], [250, 314], [200, 316]], 200));
  g.S(h.path([270, 260]).C([320, 250], [330, 220], [350, 200]).L([360, 212]).C([340, 240], [330, 280], [274, 290]).Z());
  g.S(h.path([146, 214]).Q([200, 60], [254, 214]).L([242, 214]).Q([200, 84], [158, 214]).Z(), 2);
  if (g.lvl >= 3) g.S(h.ellipse(200, 196, 40, 8));
  g.K(h.circle(200, 184, 9));
});

C.define({ id:"butter-churn", title:"The Butter Churn", cat:"nostalgic-heritage", era:"1920s",
  tags:["farm", "kitchen", "dairy", "handwork"], talk:"What tastes best with fresh butter?" }, function(g){
  g.S(h.rrect(290, 60, 20, 240, 8));
  g.K(h.circle(300, 60, 18));
  g.S(h.mirror([[300, 300], [370, 302], [410, 480], [420, 700], [400, 760], [300, 764]], 300));
  g.S(h.ellipse(300, 300, 70, 16));
  g.L(h.path([222, 400]).Q([300, 420], [378, 400]).open());
  g.L(h.path([202, 620]).Q([300, 646], [398, 620]).open());
  if (g.lvl >= 2) [250, 300, 350].forEach(function(x){ g.D(h.line([x + (x - 300) * .1, 316], [x + (x - 300) * .3, 756])); });
  if (g.lvl >= 2){ g.S(h.path([470, 700]).L([470, 620]).Q([470, 590], [500, 590]).L([540, 590]).Q([570, 590], [570, 620]).L([570, 700]).Z()); g.S(h.ellipse(520, 700, 60, 12)); }
});

C.define({ id:"porch-swing", title:"The Porch Swing", cat:"nostalgic-heritage",
  tags:["porches", "summer-evenings", "resting"], sensitive:["home"], talk:"Who would you like to sit beside on a porch swing?" }, function(g){
  g.S(h.rect(40, 60, 520, 36));
  g.L(h.line([100, 96], [86, 362])); g.L(h.line([500, 96], [514, 362]));
  g.S(h.rect(150, 300, 300, 150));
  var slats = g.at(6, 4, 3);
  for (var i = 1; i < slats; i++){ var x = 150 + i * 300 / slats; g.L(h.line([x, 318], [x, 450])); }
  g.S(h.path([136, 300]).Q([300, 248], [464, 300]).L([464, 332]).Q([300, 280], [136, 332]).Z());
  if (g.lvl >= 2) g.S(h.rrect(186, 380, 128, 80, 28));
  g.S(h.rrect(60, 446, 480, 42, 10));
  g.S(h.rect(84, 488, 432, 38));
  var aw = g.at(28, 34, 44);
  [[44, 128], [472, 556]].forEach(function(a){
    if (g.lvl >= 2) g.S(h.rect((a[0] + a[1]) / 2 - 16, 360 + aw - 2, 32, 90 - aw));
    g.S(h.rrect(a[0], 360, a[1] - a[0], aw, aw / 2.6));
  });
  if (g.lvl >= 3) g.D(h.line([96, 507], [504, 507]));
  g.L(h.line([30, 640], [570, 640]));
  if (g.lvl >= 2) [690, 740].forEach(function(y){ g.D(h.line([30, y], [570, y]), 2); });
});
})(globalThis.CognicopiaColoring);
