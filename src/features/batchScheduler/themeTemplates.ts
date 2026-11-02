/**
 * @file themeTemplates.ts
 * @description Curated dementia-friendly thematic templates for bulk facility scheduling.
 * Each theme provides robust, dignified vocabulary, conversational invitations,
 * and tangible sensory cues matching Cognicopia's clinical standards.
 */

import { ThemeTemplate } from './types.js';

export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: 'spring_gardening',
    title: 'Spring Gardening & Farm Life',
    subtitle: 'Heirloom seeds, morning dew, rich soil, and porch flowers',
    season: 'spring',
    icon: '🌱',
    description: 'Awakens memories of planting early vegetables, tending flower beds, turning sweet soil, and listening to songbirds after winter.',
    recommendedEra: '1950s',
    tactileItemPairing: 'Heirloom seed packet, smooth garden stone, or sprig of rosemary',
    vocabulary: [
      'GARDEN', 'TROWEL', 'SEEDLING', 'PETUNIA', 'ORCHARD',
      'CARROT', 'RHUBARB', 'LILAC', 'SUNSHINE', 'TRACTOR',
      'SPADING', 'TOMATO', 'WATERING', 'MORNING', 'BLOSSOM'
    ],
    reminiscencePrompts: [
      {
        invitation: 'Tell me about the first thing you planted when spring arrived.',
        followUp: 'Did you prefer sweet peas, bright red tomatoes, or crisp snap beans?',
        sensoryCue: 'Hold and feel the texture of an heirloom seed envelope.'
      },
      {
        invitation: 'What was your favorite flower to see blooming beside the front walkway?',
        followUp: 'Did your porch or yard have fragrant purple lilacs or climbing roses?',
        sensoryCue: 'Trace the petals of a flower outline with your finger.'
      },
      {
        invitation: 'How did the kitchen smell when fresh rhubarb or strawberries were brought indoors?',
        followUp: 'Did anyone bake a warm cobbler with cream?',
        sensoryCue: 'Breathe in deeply and picture fresh spring rain on the grass.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'Which flower is known as a favorite herald of early spring?',
        options: ['Yellow Daffodil', 'Sunflower'],
        answer: 'Yellow Daffodil'
      },
      {
        prompt: 'What tool is commonly used to gently loosen soil around tender young roots?',
        options: ['Hand Trowel', 'Sledgehammer'],
        answer: 'Hand Trowel'
      },
      {
        prompt: 'Finish the classic rhyme: "April showers bring May..."',
        options: ['Flowers', 'Snowdrifts'],
        answer: 'Flowers'
      }
    ],
    matchingPairs: [
      { left: 'Seed Packet', right: 'Trowel & Furrow', symbol: '🌱' },
      { left: 'Sweet Corn', right: 'Butter & Salt', symbol: '🌽' },
      { left: 'Purple Lilac', right: 'Kitchen Table Vase', symbol: '🌸' },
      { left: 'Farm Tractor', right: 'Morning Chores', symbol: '🚜' }
    ]
  },
  {
    id: 'mid_century_nostalgia',
    title: 'Mid-Century Nostalgia & Big Band',
    subtitle: 'Chrome diners, jukebox singles, swing dance halls, and radio serials',
    season: 'all-season',
    icon: '🎷',
    description: 'Evokes the optimism of the 1940s and 1950s: Saturday night dances, soda fountains, classic convertible sedans, and big band melodies.',
    recommendedEra: '1950s',
    tactileItemPairing: 'Vintage 45 RPM adapter, polished chrome spoon, or smooth diner coaster',
    vocabulary: [
      'JUKEBOX', 'RECORDS', 'TROMBONE', 'CHROME', 'SODA',
      'GLENN', 'MILLER', 'SWING', 'DANCING', 'MELODY',
      'RADIO', 'STATION', 'BROADCAST', 'CADILLAC', 'BALLROOM'
    ],
    reminiscencePrompts: [
      {
        invitation: 'Do you remember the excitement of stepping onto the ballroom dance floor on Saturday night?',
        followUp: 'Did the orchestra play "In the Mood" or "Moonlight Serenade"?',
        sensoryCue: 'Tap your shoe or hand in rhythm to a classic swing beat.'
      },
      {
        invitation: 'What was your favorite order at the corner drugstore soda fountain?',
        followUp: 'Did you enjoy an ice cream malt, a cherry cola, or a root beer float?',
        sensoryCue: 'Hold a polished silver spoon and imagine cold vanilla ice cream.'
      },
      {
        invitation: 'Who gathered around the console radio in the living room in the evening?',
        followUp: 'Which comedy show, serial, or music broadcast did you never want to miss?',
        sensoryCue: 'Picture the warm amber glow of a vacuum-tube dial.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'Which famous bandleader led the orchestra that played "Moonlight Serenade"?',
        options: ['Glenn Miller', 'Elvis Presley'],
        answer: 'Glenn Miller'
      },
      {
        prompt: 'What did teenagers drop a nickel or dime into to choose a song in a diner?',
        options: ['Jukebox', 'Typewriter'],
        answer: 'Jukebox'
      },
      {
        prompt: 'What cold treat was made with root beer and scoops of vanilla ice cream?',
        options: ['Root Beer Float', 'Hot Cocoa'],
        answer: 'Root Beer Float'
      }
    ],
    matchingPairs: [
      { left: 'Brass Trombone', right: 'Swing Band', symbol: '🎺' },
      { left: 'Soda Fountain', right: 'Cherry Phosphate', symbol: '🥤' },
      { left: 'Console Radio', right: 'Evening Serials', symbol: '📻' },
      { left: 'Dance Floor', right: 'Ballroom Waltz', symbol: '💃' }
    ]
  },
  {
    id: 'railroad_craftsman',
    title: 'Railroad, Timber & Craftsman Era',
    subtitle: 'Steam engines, hand planes, roundhouses, and honest workshop pride',
    season: 'all-season',
    icon: '🚂',
    description: 'Celebrates the historical dignity of American trade workers: machinists, carpenters, railroad engineers, and craftsmen who built with their hands.',
    recommendedEra: '1940s',
    tactileItemPairing: 'Smooth piece of sanded cedar, brass screw, or pocket spirit level',
    vocabulary: [
      'LOCOMOTIVE', 'ROUNDHOUSE', 'TIMBER', 'CARPENTER', 'ENGINEER',
      'BOILER', 'RAILROAD', 'ANVIL', 'TOOLBOX', 'SAWMILL',
      'LEVEL', 'CHISEL', 'WHISTLE', 'WORKSHOP', 'HAMMER'
    ],
    reminiscencePrompts: [
      {
        invitation: 'Tell me about the sound of a distant steam train whistle echoing across the hills.',
        followUp: 'Did the evening passenger train roll through town right around sunset?',
        sensoryCue: 'Listen closely in your mind to the rhythmic chug-chug of the engine.'
      },
      {
        invitation: 'What was your favorite tool in the workshop that felt perfectly balanced in your hands?',
        followUp: 'Was it a trusty wooden hand plane, a steel framing square, or an oilstone?',
        sensoryCue: 'Run your fingertips over a piece of smooth, sanded cedar wood.'
      },
      {
        invitation: 'What was something you built or repaired that you were truly proud of?',
        followUp: 'Did it last for decades of honest, sturdy use?',
        sensoryCue: 'Make the motion of turning a wrench or sighting down a straight board.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'What powered the mighty steam locomotives of the mid-twentieth century?',
        options: ['Steam & Coal', 'Solar Panels'],
        answer: 'Steam & Coal'
      },
      {
        prompt: 'What carpenter tool has a bubble in a small vial to check if a board is straight?',
        options: ['Spirit Level', 'Paintbrush'],
        answer: 'Spirit Level'
      },
      {
        prompt: 'Finish the craftsman motto: "Measure twice, cut..."',
        options: ['Once', 'Never'],
        answer: 'Once'
      }
    ],
    matchingPairs: [
      { left: 'Steam Whistle', right: 'Train Depot', symbol: '🚂' },
      { left: 'Hand Plane', right: 'Wood Shavings', symbol: '🪵' },
      { left: 'Steel Anvil', right: 'Blacksmith Forge', symbol: '🔨' },
      { left: 'Engineer Cap', right: 'Locomotive Cab', symbol: '🧢' }
    ]
  },
  {
    id: 'hometown_kitchen',
    title: 'Hometown Kitchen & Family Recipes',
    subtitle: 'Cast iron skillets, Sunday roasts, freshly baked bread, and pantry jams',
    season: 'all-season',
    icon: '🥧',
    description: 'Centers on the warmth of the family kitchen: gathering around the table, rolling out pie dough, simmering savory soups, and canning fruit.',
    recommendedEra: '1950s',
    tactileItemPairing: 'Wooden rolling pin miniature, cloth napkin, or cinnamon stick',
    vocabulary: [
      'RECIPE', 'SKILLET', 'CINNAMON', 'BISCUITS', 'PANTRY',
      'SUNDAY', 'ROAST', 'KITCHEN', 'ROLLING', 'APRON',
      'MASON', 'BUTTER', 'COBBLER', 'SIMMER', 'GATHER'
    ],
    reminiscencePrompts: [
      {
        invitation: 'What was the first thing you could smell when you walked into the house on Sunday morning?',
        followUp: 'Was it roasting chicken, hot buttermilk biscuits, or brewing coffee?',
        sensoryCue: 'Imagine the warmth of the kitchen stove on a crisp morning.'
      },
      {
        invitation: 'Did your family have a secret recipe that everyone asked for at potlucks?',
        followUp: 'Was it Grandma’s apple pie, potato salad, or homemade peach jam?',
        sensoryCue: 'Hold and smell a real cinnamon stick or piece of vanilla bean.'
      },
      {
        invitation: 'Who stood beside you at the kitchen counter while you rolled out dough or stirred the pot?',
        followUp: 'Did they wear a favorite floral apron with deep pockets?',
        sensoryCue: 'Trace circles on the table as if gently kneading bread dough.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'What heavy black cookware is famous for making the crispiest fried chicken?',
        options: ['Cast Iron Skillet', 'Tin Can'],
        answer: 'Cast Iron Skillet'
      },
      {
        prompt: 'What sweet spice is traditionally sprinkled generously on warm apple pie?',
        options: ['Cinnamon', 'Black Pepper'],
        answer: 'Cinnamon'
      },
      {
        prompt: 'What glass jars with zinc lids were used in every summer pantry for preserving peaches?',
        options: ['Mason Jars', 'Plastic Bags'],
        answer: 'Mason Jars'
      }
    ],
    matchingPairs: [
      { left: 'Rolling Pin', right: 'Pie Crust', symbol: '🥧' },
      { left: 'Cast Iron Skillet', right: 'Sunday Dinner', symbol: '🍳' },
      { left: 'Mason Jar', right: 'Strawberry Jam', symbol: '🍓' },
      { left: 'Kitchen Apron', right: 'Baking Flour', symbol: '🥖' }
    ]
  },
  {
    id: 'patriotic_outdoors',
    title: 'Patriotic Milestones & Great Outdoors',
    subtitle: 'National parks, pine forests, starry skies, parades, and campfires',
    season: 'summer',
    icon: '🌲',
    description: 'Evokes memories of family road trips to national parks, 4th of July parades, trout streams, campfire songs, and star-filled night skies.',
    recommendedEra: '1950s',
    tactileItemPairing: 'Polished river stone, miniature felt pennant, or small pine cone',
    vocabulary: [
      'FOREST', 'CAMPFIRE', 'PARADE', 'PATRIOTIC', 'STARS',
      'MOUNTAIN', 'STREAM', 'YELLOWSTONE', 'PINEWOOD', 'COMPASS',
      'CANOE', 'SUNSET', 'BUGLE', 'BLUEBIRD', 'NATIONAL'
    ],
    reminiscencePrompts: [
      {
        invitation: 'Tell me about watching the town parade march down Main Street on a summer morning.',
        followUp: 'Did the high school marching band wear bright uniforms with brass trumpets?',
        sensoryCue: 'Tap your hand to the beat of a marching drum.'
      },
      {
        invitation: 'Do you remember sitting around an evening campfire as the stars came out?',
        followUp: 'Did anyone play a harmonica or roast marshmallows on sticks?',
        sensoryCue: 'Hold a smooth river rock warmed by the sun.'
      },
      {
        invitation: 'What was your favorite scenic trip through the mountains or by the lake?',
        followUp: 'Did you pack sandwiches in a metal cooler in the trunk of the car?',
        sensoryCue: 'Take a deep breath and picture the scent of fresh evergreen pine.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'Which famous national park is renowned for the geyser Old Faithful?',
        options: ['Yellowstone', 'Times Square'],
        answer: 'Yellowstone'
      },
      {
        prompt: 'What instrument is traditionally played at sunset in camp or military service for Taps?',
        options: ['Bugle', 'Bagpipes'],
        answer: 'Bugle'
      },
      {
        prompt: 'What bird with a bright red breast was celebrated as a sign of outdoor season?',
        options: ['American Robin', 'Penguin'],
        answer: 'American Robin'
      }
    ],
    matchingPairs: [
      { left: 'Old Faithful', right: 'Yellowstone Park', symbol: '🌋' },
      { left: 'Campfire', right: 'Pine Woods', symbol: '🔥' },
      { left: 'Parade March', right: 'Brass Band', symbol: '🎺' },
      { left: 'Canoe Paddle', right: 'Quiet Lake', symbol: '🛶' }
    ]
  },
  {
    id: 'autumn_hearth',
    title: 'Autumn Harvest & Hearthside Reminiscence',
    subtitle: 'Cider pressing, warm patchwork quilts, woodstoves, and county fairs',
    season: 'autumn',
    icon: '🍂',
    description: 'Celebrates crisp autumn days: apple orchards, colorful maple leaves, blue-ribbon county fair exhibits, and sitting by a crackling fire.',
    recommendedEra: '1950s',
    tactileItemPairing: 'Preserved autumn maple leaf, woven wool yarn, or dried apple slice',
    vocabulary: [
      'HARVEST', 'ORCHARD', 'CIDER', 'PUMPKIN', 'QUILTING',
      'AUTUMN', 'WOODSTOVE', 'MAPLE', 'HEARTH', 'FROST',
      'COUNTY', 'RIBBON', 'CHESTNUT', 'BASKET', 'FIREPLACE'
    ],
    reminiscencePrompts: [
      {
        invitation: 'What was it like walking through an apple orchard on a crisp October morning?',
        followUp: 'Did you press fresh sweet cider or pick bushel baskets of Macintoshes?',
        sensoryCue: 'Picture the sweet, tangy aroma of pressed apple cider.'
      },
      {
        invitation: 'Did your family attend the annual county fair with its carnival rides and livestock barns?',
        followUp: 'Did anyone enter a prized quilt, giant pumpkin, or blackberry jam for a blue ribbon?',
        sensoryCue: 'Trace the textured stitching of a patchwork quilt.'
      },
      {
        invitation: 'How did it feel to warm your hands by the woodstove after raking leaves outdoors?',
        followUp: 'Did the leaves crunch beneath your boots as you walked?',
        sensoryCue: 'Hold your hands open toward warmth and remember cozy wool socks.'
      }
    ],
    triviaQuestions: [
      {
        prompt: 'What warm drink is pressed from freshly harvested autumn apples?',
        options: ['Apple Cider', 'Iced Tea'],
        answer: 'Apple Cider'
      },
      {
        prompt: 'What color ribbon is traditionally awarded for First Place at the County Fair?',
        options: ['Blue Ribbon', 'Green Ribbon'],
        answer: 'Blue Ribbon'
      },
      {
        prompt: 'What warm, heavy blanket is made by sewing together colorful fabric squares?',
        options: ['Patchwork Quilt', 'Window Curtain'],
        answer: 'Patchwork Quilt'
      }
    ],
    matchingPairs: [
      { left: 'Apple Orchard', right: 'Sweet Cider', symbol: '🍎' },
      { left: 'Patchwork Quilt', right: 'Hearthside Stove', symbol: '🧵' },
      { left: 'County Fair', right: 'Blue Ribbon', symbol: '🏅' },
      { left: 'Maple Leaf', right: 'Autumn Frost', symbol: '🍁' }
    ]
  }
];

export function getThemeById(id: string): ThemeTemplate {
  return THEME_TEMPLATES.find(t => t.id === id) || THEME_TEMPLATES[0];
}
