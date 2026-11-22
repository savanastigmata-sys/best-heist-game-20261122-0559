// The screenshot scenes behind ?shot=start|play|smoke|win. Each one plays
// the real rules forward from a fresh world, steered by a simple autopilot
// that samples eight directions, scores them by progress toward its goal
// minus the danger of the cones, and sneaks while it is unseen — so the
// frame is what a short game really looks like, and the same seed always
// gives the same frame.
import { ROOM, STEP } from './config.js';
import { EVENT_FLOOR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { guardSeesThief } from './guards.js';
import { cameraSeesThief } from './cameras.js';
import { shadowLanePath } from './routes.js';

/** The four staged scenes, in screenshot order: title, cover, smoke, win. */
export const SHOT_NAMES = ['start', 'play', 'smoke', 'win'];

const START_SECONDS = 5;
const PLAY_SECONDS = 18;
const LEG_LIMIT_SECONDS = 200;
const SAMPLE_DISTANCE = 60;
const DIRECTIONS = [];
for (let i = 0; i < 8; i += 1) {
  const angle = (i * Math.PI) / 4;
  DIRECTIONS.push({ x: Math.cos(angle), y: Math.sin(angle) });
}

/** How dangerous a point is: in a cone, near a guard, or chased down. */
function dangerAt(state, x, y) {
  let danger = 0;
  const probe = { x, y };
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (guardSeesThief(guard, probe, state.coverRects, false, false)) danger += 2;
    const d = Math.hypot(x - guard.x, y - guard.y);
    if (d < 120) danger += (120 - d) / 60;
    if (guard.chasing && d < 170) danger += 3 + (170 - d) / 50;
  }
  for (let i = 0; i < state.cameras.length; i += 1) {
    const camera = state.cameras[i];
    if (cameraSeesThief(camera, probe, state.coverRects, false)) danger += 2;
    const d = Math.hypot(x - camera.x, y - camera.y);
    if (d < 120) danger += (120 - d) / 60;
  }
  if (x < ROOM.x + 16 || x > ROOM.x + ROOM.width - 16 || y < ROOM.y + 16 || y > ROOM.y + ROOM.height - 16) {
    danger += 10;
  }
  for (let i = 0; i < state.coverRects.length; i += 1) {
    const rect = state.coverRects[i];
    if (x > rect.x - 16 && x < rect.x + rect.width + 16 && y > rect.y - 16 && y < rect.y + rect.height + 16) {
      danger += 10;
    }
  }
  return danger;
}

/**
 * The best of eight sampled directions: progress toward the goal, minus
 * thirty points per unit of danger, plus one.
 */
export function autopilot(state, goal) {
  const thief = state.thief;
  const currentDist = Math.hypot(goal.x - thief.x, goal.y - thief.y);
  if (currentDist < 20) return { x: 0, y: 0 };
  let best = DIRECTIONS[0];
  let bestScore = -Infinity;
  for (let i = 0; i < DIRECTIONS.length; i += 1) {
    const dir = DIRECTIONS[i];
    const px = thief.x + dir.x * SAMPLE_DISTANCE;
    const py = thief.y + dir.y * SAMPLE_DISTANCE;
    const progress = currentDist - Math.hypot(goal.x - px, goal.y - py);
    const score = progress - dangerAt(state, px, py) * 30 + 1;
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

/** Straight at a point, full speed — for the caught scene. */
function straightAt(state, goal) {
  const dx = goal.x - state.thief.x;
  const dy = goal.y - state.thief.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function maxSuspicion(state) {
  let max = 0;
  for (let i = 0; i < state.guards.length; i += 1) {
    if (state.guards[i].suspicion > max) max = state.guards[i].suspicion;
  }
  return max;
}

function anyChasing(state) {
  for (let i = 0; i < state.guards.length; i += 1) {
    if (state.guards[i].chasing) return true;
  }
  return false;
}

function useTools(world) {
  const state = world.state;
  if (state.alarm > 18 || anyChasing(state) || maxSuspicion(state) >= 50) {
    if (state.toolbelt.smokeSeconds <= 0) world.useSmoke();
  } else if (state.alarm > 15) {
    const jammed = state.cameras.length > 0 && state.cameras[0].jammedSeconds > 0;
    if (!jammed) world.useJammer();
  }
}

/** Steer one leg of the win run toward `goal`, tools on, until it arrives. */
function runLeg(world, goal, useToolsFlag) {
  const state = world.state;
  const limit = LEG_LIMIT_SECONDS / STEP;
  for (let i = 0; i < limit; i += 1) {
    if (state.caught || state.won) return;
    if (Math.hypot(goal.x - state.thief.x, goal.y - state.thief.y) < 24) return;
    if (useToolsFlag) useTools(world);
    const sneak = maxSuspicion(state) < 25 && state.alarm < 50;
    const events = world.step(STEP, autopilot(state, goal), sneak, false);
    if (events & (EVENT_FLOOR | EVENT_WIN)) return;
  }
}

/**
 * Set `world` to the named scene (start, play, smoke or win; any other
 * name is start) and return the screen to draw over it and the best score.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'smoke' && name !== 'win') {
    // The title stands over floor 2's room: one more guard, one more
    // camera behind the panel than floor 1 shows.
    world.loadFloor(2);
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    const goal = { x: 640, y: 440 };
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (Math.hypot(goal.x - state.thief.x, goal.y - state.thief.y) < 24) break;
      const sneak = maxSuspicion(state) < 25 && state.alarm < 50;
      world.step(STEP, autopilot(state, goal), sneak, false);
    }
    const guard = state.guards[2];
    for (let side = 0; side < 2; side += 1) {
      const perp = { x: -Math.sin(guard.angle), y: Math.cos(guard.angle) };
      const sign = side === 0 ? 1 : -1;
      const target = {
        x: guard.x + Math.cos(guard.angle) * 180 + perp.x * 50 * sign,
        y: guard.y + Math.sin(guard.angle) * 180 + perp.y * 50 * sign,
      };
      for (let i = 0; i < 150; i += 1) {
        if (maxSuspicion(state) >= 50 || state.caught) break;
        if (Math.hypot(target.x - state.thief.x, target.y - state.thief.y) < 24) break;
        world.step(STEP, straightAt(state, target), false, false);
      }
      if (maxSuspicion(state) >= 50 || state.caught) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'smoke') {
    // Floor 2: steal the diamond first (the guards get 25% faster), then
    // run for the exit without sneaking until a guard chases or the alarm
    // runs hot, throw smoke, and slip away down the shadow lane while the
    // cloud holds — the frame shows the tool, the chase and the alarm.
    world.loadFloor(2);
    const diamond = { x: state.diamond.x, y: state.diamond.y };
    for (let i = 0; i < 12000; i += 1) {
      if (state.caught || state.diamondTaken) break;
      const sneak = maxSuspicion(state) < 25 && state.alarm < 50;
      world.step(STEP, autopilot(state, diamond), sneak, false);
    }
    const exit = { x: state.exitCentre.x, y: state.exitCentre.y };
    for (let i = 0; i < 12000; i += 1) {
      if (state.caught || state.won) break;
      if (anyChasing(state) || state.alarm > 30) break;
      world.step(STEP, autopilot(state, exit), false, false);
    }
    if (!state.caught) world.useSmoke();
    for (let i = 0; i < 45; i += 1) {
      if (state.caught) break;
      world.step(STEP, autopilot(state, exit), false, false);
    }
    return { screen: state.caught ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  for (let floor = 1; floor <= 3; floor += 1) {
    runLeg(world, { x: state.diamond.x, y: state.diamond.y }, true);
    if (state.caught || state.won) break;
    const startFloor = state.floor;
    const escape = shadowLanePath(state.exit).slice(1);
    for (let i = 0; i < escape.length; i += 1) {
      runLeg(world, escape[i], true);
      if (state.caught || state.won || state.floor !== startFloor) break;
    }
    if (state.caught || state.won) break;
  }
  return { screen: state.won ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
}
