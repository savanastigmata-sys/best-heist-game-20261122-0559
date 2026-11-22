// The three named routes through the vault room. The routes are data, not
// comments: the autopilot, the floor plan and the floor labels all read them.

// The bold way in: straight up the velvet carpet, fast and fully exposed.
const VELVET_CARPET = {
  name: 'VELVET CARPET',
  tag: 'BOLD ROUTE',
  path: [
    { x: 640, y: 600 },
    { x: 640, y: 440 },
    { x: 640, y: 300 },
    { x: 640, y: 232 },
  ],
};

// The covered way: slip between the display cases on the left, out of sight.
const DISPLAY_CASES = {
  name: 'DISPLAY CASES',
  tag: 'COVER ROUTE',
  path: [
    { x: 330, y: 600 },
    { x: 330, y: 470 },
    { x: 330, y: 340 },
    { x: 330, y: 210 },
    { x: 470, y: 210 },
    { x: 640, y: 232 },
  ],
};

// The quiet way: the dark lane down the right wall, out of the cones.
const SHADOW_LANE = {
  name: 'SHADOW LANE',
  tag: 'QUIET ROUTE',
  path: [
    { x: 1150, y: 600 },
    { x: 1150, y: 520 },
    { x: 1150, y: 260 },
  ],
};

export const ROUTES = {
  velvetCarpet: VELVET_CARPET,
  displayCases: DISPLAY_CASES,
  shadowLane: SHADOW_LANE,
};

/** The three route names, in the order they are shown on the floor. */
export function routeNames() {
  return [VELVET_CARPET.name, DISPLAY_CASES.name, SHADOW_LANE.name];
}

/**
 * The shadow lane's escape: its waypoints, then the centre of the exit
 * door the thief must reach after the diamond is taken.
 */
export function shadowLanePath(exit) {
  const centre = { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 };
  return [...SHADOW_LANE.path, centre];
}
