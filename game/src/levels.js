// The vault floors: one room per floor, three routes through it, guards on
// patrol loops and cameras on the walls. Side loot is jittered a little with
// the seeded RNG, so the same seed replays the same room.
import { ROUTES } from './routes.js';
import { createGuardPatrol } from './guards.js';
import { createSecurityCamera } from './cameras.js';

/**
 * Build one vault floor. The first thing it does is jitter the side loot
 * (portrait, gold, necklace, in that order) so the seeded run is fixed.
 */
export function buildVaultFloor(floor, random) {
  const portraitX = 1124 + (random() * 24 - 12);
  const goldX = 168 + (random() * 24 - 12);
  const necklaceX = 340 + (random() * 24 - 12);
  const data = {
    diamond: { x: 640, y: 232 },
    sideLoot: [
      { kind: 'painting', x: portraitX, y: 372, value: 8000, label: 'PORTRAIT' },
      { kind: 'gold', x: goldX, y: 372, value: 5000, label: 'GOLD BARS' },
      { kind: 'necklace', x: necklaceX, y: 150, value: 3000, label: 'NECKLACE' },
    ],
    guardConfigs: guardConfigsFor(floor),
    cameraConfigs: cameraConfigsFor(floor),
  };
  return rebuildVaultFloor(floor, data);
}

/** A cover rectangle: display cases and pillars both block sight and feet. */
function cover(x, y, width, height) {
  return { x, y, width, height };
}

function guardConfigsFor(floor) {
  const configs = [
    { waypoints: [[236, 168], [236, 560], [436, 560], [436, 168]], pauseSeconds: 1.6 },
    { waypoints: [[1044, 168], [1044, 560], [844, 560], [844, 168]], pauseSeconds: 1.6 },
    {
      waypoints: floor === 3 ? [[430, 340], [850, 340]] : [[470, 340], [810, 340]],
      pauseSeconds: 2.2,
    },
  ];
  if (floor >= 2) {
    configs.push({ waypoints: [[880, 600], [880, 470]], pauseSeconds: 1.4 });
  }
  return configs;
}

function cameraConfigsFor(floor) {
  const configs = [
    { x: 66, y: 118, baseAngle: 0.32 * Math.PI, sweep: 0.62 },
    { x: 1214, y: 640, baseAngle: -0.68 * Math.PI, sweep: 0.62 },
  ];
  if (floor >= 2) {
    configs.push({ x: 66, y: 640, baseAngle: -0.3 * Math.PI, sweep: 0.55 });
  }
  if (floor >= 3) {
    configs.push({ x: 1214, y: 400, baseAngle: Math.PI, sweep: 0.5 });
  }
  return configs;
}

/**
 * Rebuild a floor from cached data — same room, fresh guards and cameras,
 * no RNG spent. The world uses it so a restart replays the same floor.
 */
export function rebuildVaultFloor(floor, data) {
  const cases = [
    cover(268, 210, 132, 74),
    cover(880, 210, 132, 74),
    cover(268, 452, 132, 74),
    cover(880, 452, 132, 74),
    cover(596, 150, 88, 40),
  ];
  const pillars = [
    { x: 468, y: 516, radius: 22 },
    { x: 768, y: 516, radius: 22 },
  ];
  const pillarRects = pillars.map((p) => cover(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2));
  return {
    floor,
    entry: { x: 640, y: 662 },
    exit: { x: 1178, y: 140, width: 96, height: 30 },
    diamond: { x: data.diamond.x, y: data.diamond.y },
    sideLoot: data.sideLoot.map((item) => ({ ...item })),
    cases,
    pillars,
    coverRects: [...cases, ...pillarRects],
    guards: data.guardConfigs.map((config) => createGuardPatrol(config, floor)),
    cameras: data.cameraConfigs.map((config) => createSecurityCamera(config, floor)),
    routes: ROUTES,
    floorData: data,
  };
}
