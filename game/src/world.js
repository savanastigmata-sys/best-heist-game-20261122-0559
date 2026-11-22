// The heist world: the thief, the alarm, the loot, the tools and the floors.
// One fixed step advances everything; it returns a bitmask of what happened.
import { ALARM, CAMERA, DIFFICULTY, FLOORS, GUARD, LOOT, ROOM, THIEF } from './config.js';
import { buildVaultFloor, rebuildVaultFloor } from './levels.js';
import { guardSeesThief, updateGuardPatrol } from './guards.js';
import { cameraSeesThief, sweepCameraCone } from './cameras.js';
import { createLootCache, stealLoot } from './loot.js';
import { createToolbelt, thiefHiddenBySmoke, updateToolbelt, useCameraJammer, useSmokeBomb } from './tools.js';

export const EVENT_LOOT = 1;
export const EVENT_DIAMOND = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_FLOOR = 16;
export const EVENT_WIN = 32;
export const EVENT_TOOL = 64;

/** True when a circle at (x,y) with radius r overlaps a cover rectangle. */
function hitsCover(x, y, r, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.width));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.height));
    if (Math.hypot(x - cx, y - cy) < r) return true;
  }
  return false;
}

/** The whole heist: state, rules and one fixed step. */
export function createHeistWorld(random, difficulty = DIFFICULTY.NORMAL) {
  const planCache = {};
  let prevMaxSuspicion = 0;

  const state = {
    floor: 1,
    difficulty,
    score: 0,
    alarm: 0,
    time: 0,
    diamondTaken: false,
    caught: false,
    won: false,
    caughtCause: '',
    lootCount: 0,
    toolsUsed: 0,
    feesPaid: 0,
    thief: { x: 640, y: 662, radius: THIEF.radius, sneaking: false, moving: false, facing: -Math.PI / 2 },
    entry: { x: 640, y: 662 },
    exit: { x: 1178, y: 140, width: 96, height: 30 },
    exitCentre: { x: 1226, y: 155 },
    loot: null,
    diamond: null,
    guards: [],
    cameras: [],
    coverRects: [],
    cases: [],
    pillars: [],
    routes: null,
    toolbelt: createToolbelt(),
    particles: [],
    floaters: [],
  };

  function loadFloor(floor) {
    let plan;
    if (planCache[floor]) {
      plan = rebuildVaultFloor(floor, planCache[floor], state.difficulty);
    } else {
      plan = buildVaultFloor(floor, random, state.difficulty);
      planCache[floor] = plan.floorData;
    }
    state.floor = floor;
    state.entry = plan.entry;
    state.exit = plan.exit;
    state.exitCentre = { x: plan.exit.x + plan.exit.width / 2, y: plan.exit.y + plan.exit.height / 2 };
    state.loot = createLootCache(plan);
    state.diamond = state.loot.diamond;
    state.guards = plan.guards;
    state.cameras = plan.cameras;
    state.coverRects = plan.coverRects;
    state.cases = plan.cases;
    state.pillars = plan.pillars;
    state.routes = plan.routes;
    state.diamondTaken = false;
    state.thief.x = plan.entry.x;
    state.thief.y = plan.entry.y;
    state.thief.facing = -Math.PI / 2;
    state.toolbelt.smokeSeconds = 0;
    state.particles = [];
    state.floaters = [];
    prevMaxSuspicion = 0;
  }

  function reset() {
    state.score = 0;
    state.alarm = 0;
    state.time = 0;
    state.lootCount = 0;
    state.toolsUsed = 0;
    state.feesPaid = 0;
    state.caught = false;
    state.won = false;
    state.caughtCause = '';
    state.toolbelt = createToolbelt();
    loadFloor(1);
  }

  function payFee(amount) {
    state.feesPaid += amount;
    state.score = Math.max(0, state.score - amount);
    state.floaters.push({
      x: state.thief.x,
      y: state.thief.y - 28,
      text: `-$${amount.toLocaleString('en-US')} FENCE FEE`,
      life: 1.4,
    });
  }

  function burst(x, y) {
    for (let i = 0; i < 14; i += 1) {
      const angle = i * 2.399963;
      const speed = 40 + (i % 5) * 12;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.7,
      });
    }
  }

  function useSmoke() {
    const ok = useSmokeBomb(state.toolbelt, state.thief, payFee);
    if (ok) state.toolsUsed += 1;
    return ok;
  }

  function useJammer() {
    const ok = useCameraJammer(state.toolbelt, state.cameras, payFee);
    if (ok) state.toolsUsed += 1;
    return ok;
  }

  function step(dt, move, sneaking, harmless) {
    if (state.caught || state.won) return 0;
    state.time += dt;
    const thief = state.thief;
    const smokeHidden = thiefHiddenBySmoke(state.toolbelt, thief);
    for (let i = 0; i < state.cameras.length; i += 1) sweepCameraCone(state.cameras[i], dt);
    for (let i = 0; i < state.guards.length; i += 1) {
      updateGuardPatrol(state.guards[i], dt, thief, state.coverRects, sneaking, smokeHidden);
    }
    if (harmless) {
      updateToolbelt(state.toolbelt, dt);
      return 0;
    }

    const mx = typeof move === 'number' ? move : move.x;
    const my = typeof move === 'number' ? 0 : move.y;
    const len = Math.hypot(mx, my);
    const nx = len > 1 ? mx / len : mx;
    const ny = len > 1 ? my / len : my;
    const speed = sneaking ? THIEF.sneakSpeed : THIEF.speed;
    const radius = sneaking ? THIEF.sneakRadius : THIEF.radius;
    thief.radius = radius;
    thief.sneaking = sneaking;
    thief.moving = len > 0.01;
    if (thief.moving) thief.facing = Math.atan2(ny, nx);
    const dx = nx * speed * dt;
    const dy = ny * speed * dt;
    const minX = ROOM.x + radius;
    const maxX = ROOM.x + ROOM.width - radius;
    const minY = ROOM.y + radius;
    const maxY = ROOM.y + ROOM.height - radius;
    const tryX = Math.max(minX, Math.min(maxX, thief.x + dx));
    if (!hitsCover(tryX, thief.y, radius, state.coverRects)) thief.x = tryX;
    const tryY = Math.max(minY, Math.min(maxY, thief.y + dy));
    if (!hitsCover(thief.x, tryY, radius, state.coverRects)) thief.y = tryY;

    let events = 0;
    let guardSeen = false;
    let anyChasing = false;
    let maxSuspicion = 0;
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      if (guard.chasing) anyChasing = true;
      if (guard.suspicion > maxSuspicion) maxSuspicion = guard.suspicion;
      if (guardSeesThief(guard, thief, state.coverRects, sneaking, smokeHidden)) guardSeen = true;
    }
    if (maxSuspicion >= GUARD.spotAtSuspicion && prevMaxSuspicion < GUARD.spotAtSuspicion) {
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.spottedBump);
      events |= EVENT_SPOTTED;
    }
    prevMaxSuspicion = maxSuspicion;
    let cameraSeen = false;
    for (let i = 0; i < state.cameras.length; i += 1) {
      if (cameraSeesThief(state.cameras[i], thief, state.coverRects, smokeHidden)) cameraSeen = true;
    }
    if (anyChasing) state.alarm += ALARM.chaseRise * state.difficulty.alarm * dt;
    if (cameraSeen) state.alarm += CAMERA.alarmRise * state.difficulty.alarm * dt;
    if (!guardSeen && !cameraSeen && !anyChasing) state.alarm -= ALARM.decay * dt;
    state.alarm = Math.max(0, Math.min(ALARM.max, state.alarm));

    const stolen = stealLoot(state.loot, thief);
    if (stolen.gained > 0) {
      state.score += stolen.gained;
      state.lootCount += stolen.labels.length;
      for (let i = 0; i < stolen.labels.length; i += 1) state.floaters.push(stolen.labels[i]);
      events |= EVENT_LOOT;
      burst(thief.x, thief.y);
    }
    if (stolen.tookDiamond) {
      state.diamondTaken = true;
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.vaultOpenedBump);
      for (let i = 0; i < state.guards.length; i += 1) state.guards[i].alerted = true;
      events |= EVENT_DIAMOND;
    }

    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.radius + thief.radius) {
        state.caught = true;
        state.caughtCause = 'A guard closed in and grabbed you.';
        return events | EVENT_CAUGHT;
      }
    }
    if (state.alarm >= ALARM.max) {
      state.caught = true;
      state.caughtCause = 'The alarm hit 100% — lockdown.';
      return events | EVENT_CAUGHT;
    }

    if (state.diamondTaken
      && thief.x >= state.exit.x && thief.x <= state.exit.x + state.exit.width
      && thief.y >= state.exit.y && thief.y <= state.exit.y + state.exit.height) {
      if (state.floor >= FLOORS) {
        state.won = true;
        return events | EVENT_WIN;
      }
      state.score += LOOT.floorBonus;
      const nextFloor = state.floor + 1;
      loadFloor(nextFloor);
      return events | EVENT_FLOOR;
    }

    updateToolbelt(state.toolbelt, dt);
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.life -= dt;
      floater.y -= 20 * dt;
      if (floater.life <= 0) state.floaters.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 60 * dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
    return events;
  }

  loadFloor(1);

  /** Switch difficulty (the title screen's arrow keys) and re-deal the floor under the new pressure. */
  function setDifficulty(next) {
    state.difficulty = next;
    loadFloor(state.floor);
  }

  return { state, reset, loadFloor, step, useSmoke, useJammer, payFee, setDifficulty };
}
