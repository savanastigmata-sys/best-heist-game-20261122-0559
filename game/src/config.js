// GILDED HOUR — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it
// to the window, so no rule below depends on the screen size.

export const GAME_TITLE = 'GILDED HOUR';
export const GAME_SUBTITLE = 'The Meridian Vault Heist';

export const FIELD = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;
export const ROOM = { x: 24, y: 88, width: 1232, height: 608 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many vault floors the heist runs through. */
export const FLOORS = 3;

/** The thief: fast on foot, slower and harder to spot while sneaking. */
export const THIEF = {
  radius: 16,
  sneakRadius: 14,
  speed: 215,
  sneakSpeed: 118,
  grabRadius: 30,
};

/** Guards patrol, grow suspicious in their cones, and chase the last place they saw the thief. */
export const GUARD = {
  radius: 17,
  patrolSpeed: 72,
  patrolPerFloor: 12,
  chaseSpeed: 168,
  coneRange: 262,
  halfAngle: 0.58,
  suspicionRise: 95,
  suspicionRiseSneak: 46,
  suspicionDecay: 26,
  loseChaseSeconds: 3,
  chaseAtSuspicion: 100,
  spotAtSuspicion: 25,
};

/** Wall cameras sweep their cones; a live cone pushes the alarm up. */
export const CAMERA = {
  range: 305,
  halfAngle: 0.38,
  sweepPeriod: 5,
  sweepPerFloor: 0.6,
  minPeriod: 2.4,
  alarmRise: 24,
};

/** The alarm meter: it climbs when the thief is seen and falls while hidden. */
export const ALARM = {
  decay: 5,
  vaultOpenedBump: 15,
  spottedBump: 10,
  chaseRise: 30,
  max: 100,
};

/** Tools, each at a cost: smoke blinds every guard, the jammer kills every camera. */
export const TOOLS = {
  smokeCharges: 2,
  smokeSeconds: 5,
  smokeRadius: 100,
  jammerCharges: 2,
  jammerSeconds: 8,
  feeDollars: 2000,
};

/** What each piece of loot is worth, and the clean-getaway bonus per floor. */
export const LOOT = {
  diamond: 50000,
  gold: 5000,
  painting: 8000,
  necklace: 3000,
  floorBonus: 5000,
};

/** The same bonus, by its own name, for the floor-clear panel. */
export const FLOOR_BONUS = 5000;

export const PALETTE = {
  backdrop: '#0b0d12',
  wall: '#23202e',
  wallTrim: '#c9a227',
  floorDark: '#171310',
  floorLight: '#221a15',
  carpet: '#5e1220',
  shadowLane: '#101623',
  coverGlass: 'rgba(150,205,235,0.28)',
  coverBase: '#2c2438',
  pillar: '#3a3348',
  text: '#f4ead2',
  muted: '#b8ab8a',
  gold: '#f2c94c',
  diamond: '#bfefff',
  thief: '#1fae7a',
  thiefSneak: '#0d5c40',
  guard: '#3b4a6b',
  guardAlert: '#e5534b',
  coneCalm: 'rgba(242,201,76,0.20)',
  coneSuspicious: 'rgba(240,140,40,0.32)',
  coneChase: 'rgba(229,83,75,0.38)',
  cameraCone: 'rgba(229,83,75,0.16)',
  alarmLow: '#58c96b',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  exit: '#2fbf71',
  panel: 'rgba(16,14,22,0.92)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-hour.best';
