/**
 * Themes a month's calendar can be built around. An activity names the themes it fits
 * (`themes` in its payload); one with none fits any month and fills the gaps.
 */
export const THEMES = [
  { id: "spring", label: "Spring", blurb: "Blossoms, planting, rain and fresh air" },
  { id: "summer", label: "Summer", blurb: "Picnics, porches, ice cream and long light" },
  { id: "autumn", label: "Autumn", blurb: "Leaves, harvest, apples and cozy afternoons" },
  { id: "winter", label: "Winter", blurb: "Warm drinks, snow, soup and the fireside" },
  { id: "nostalgia-1940s", label: "1940s nostalgia", blurb: "Big bands, radio shows and Sunday dinners" },
  { id: "nostalgia-1950s", label: "1950s nostalgia", blurb: "Soda fountains, early television and rock and roll" },
  { id: "nostalgia-1960s", label: "1960s nostalgia", blurb: "Motown, folk songs, the Twist and family road trips" },
  { id: "nostalgia-1970s", label: "1970s nostalgia", blurb: "Disco, shag carpet, Saturday cartoons and CB radio" },
  { id: "aviation", label: "Aviation", blurb: "Airplanes, airports, the sky and travel" },
  { id: "garden", label: "Gardens & nature", blurb: "Flowers, herbs, birds and the outdoors" },
  { id: "road-trips", label: "Road trips & classic cars", blurb: "Highways, station wagons and the family vacation" },
  { id: "home-kitchen", label: "Home & kitchen", blurb: "Baking, recipes, housekeeping and familiar objects" },
  { id: "music", label: "Music & dance", blurb: "Sing-alongs, instruments and favorite songs" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_IDS = THEMES.map((theme) => theme.id) as [ThemeId, ...ThemeId[]];

export const isThemeId = (value: unknown): value is ThemeId => (THEME_IDS as readonly unknown[]).includes(value);
export const themeLabel = (id: string): string => THEMES.find((theme) => theme.id === id)?.label ?? id;
