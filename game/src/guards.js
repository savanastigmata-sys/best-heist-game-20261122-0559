// Guards: patrol loops, vision cones, suspicion, and the fair chase — a
// guard chases the last place it saw the thief, never the thief itself.
import { DIFFICULTY, GUARD } from './config.js';

/** True when the segment from (x1,y1) to (x2,y2) crosses any cover rectangle. */
export function lineOfSightBlocked(x1, y1, x2, y2, rects) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    let tMin = 0;
    let tMax = 1;
    let ok = true;
    const axes = [
      { d: dx, low: r.x - x1, high: r.x + r.width - x1 },
      { d: dy, low: r.y - y1, high: r.y + r.height - y1 },
    ];
    for (let a = 0; a < 2 && ok; a += 1) {
      const axis = axes[a];
      if (axis.d === 0) {
        if (axis.low > 0 || axis.high < 0) ok = false;
      } else {
        let t1 = axis.low / axis.d;
        let t2 = axis.high / axis.d;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tMin) tMin = t1;
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) ok = false;
      }
    }
    if (ok && tMax > 0 && tMin < 1) return true;
  }
  return false;
}

/** The angle between two directions, wrapped to [-PI, PI]. */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * A guard on a patrol loop. It starts at the first waypoint facing down,
 * walks to the next waypoint, pauses there and looks around, then moves on.
 * The difficulty scales its patrol and chase speed and how fast it grows
 * suspicious; NORMAL leaves every number exactly as shipped.
 */
export function createGuardPatrol(config, floor, difficulty = DIFFICULTY.NORMAL) {
  const waypoints = config.waypoints.map((p) => ({ x: p[0], y: p[1] }));
  return {
    x: waypoints[0].x,
    y: waypoints[0].y,
    angle: Math.PI / 2,
    waypoints,
    waypointIndex: waypoints.length > 1 ? 1 : 0,
    pauseSeconds: config.pauseSeconds,
    pauseTimer: 0,
    patrolSpeed: (GUARD.patrolSpeed + GUARD.patrolPerFloor * (floor - 1)) * difficulty.guardSpeed,
    chaseSpeed: GUARD.chaseSpeed * difficulty.guardSpeed,
    suspicionRise: GUARD.suspicionRise * difficulty.suspicion,
    suspicionRiseSneak: GUARD.suspicionRiseSneak * difficulty.suspicion,
    speedMultiplier: 1,
    suspicion: 0,
    chasing: false,
    alerted: false,
    lastSeenX: waypoints[0].x,
    lastSeenY: waypoints[0].y,
    unseenSeconds: 0,
    lookBase: Math.PI / 2,
  };
}

/**
 * True when the guard can see the thief: in range, inside the cone, with a
 * clear line of sight — and never through smoke. `sneaking` is the thief's
 * posture (it changes how fast suspicion rises, not whether the guard sees).
 */
export function guardSeesThief(guard, thief, coverRects, sneaking, smokeHidden) {
  if (smokeHidden) return false;
  const dx = thief.x - guard.x;
  const dy = thief.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.coneRange) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), guard.angle)) > GUARD.halfAngle) return false;
  if (lineOfSightBlocked(guard.x, guard.y, thief.x, thief.y, coverRects)) return false;
  return true;
}

/** The guard's vision cone, for the renderer. */
export function computeVisionCone(guard) {
  return {
    x: guard.x,
    y: guard.y,
    angle: guard.angle,
    range: GUARD.coneRange,
    halfAngle: GUARD.halfAngle,
  };
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 1;
}

/**
 * Advance one guard: suspicion rises in the cone and decays outside it, at
 * 100 it chases the last place it saw the thief, and after 3 s unseen it
 * gives up and returns to its patrol.
 */
export function updateGuardPatrol(guard, dt, thief, coverRects, sneaking, smokeHidden) {
  const sees = guardSeesThief(guard, thief, coverRects, sneaking, smokeHidden);
  if (sees) {
    guard.lastSeenX = thief.x;
    guard.lastSeenY = thief.y;
    guard.unseenSeconds = 0;
    const rise = sneaking ? guard.suspicionRiseSneak : guard.suspicionRise;
    guard.suspicion = Math.min(GUARD.chaseAtSuspicion, guard.suspicion + rise * dt);
  } else {
    guard.unseenSeconds += dt;
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
    if (guard.chasing && guard.unseenSeconds >= GUARD.loseChaseSeconds) {
      guard.chasing = false;
    }
  }
  if (guard.suspicion >= GUARD.chaseAtSuspicion) guard.chasing = true;
  const multiplier = guard.alerted ? 1.25 : 1;
  if (guard.chasing) {
    const arrived = moveToward(
      guard, guard.lastSeenX, guard.lastSeenY,
      guard.chaseSpeed * multiplier, dt,
    );
    if (arrived && guard.unseenSeconds >= GUARD.loseChaseSeconds) guard.chasing = false;
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    guard.angle = guard.lookBase + 0.55 * Math.sin(guard.pauseTimer * 1.6);
    if (guard.pauseTimer <= 0) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    }
    return;
  }
  const arrived = moveToward(guard, target.x, target.y, guard.patrolSpeed * multiplier, dt);
  if (arrived) {
    guard.pauseTimer = guard.pauseSeconds;
    guard.lookBase = guard.angle;
  }
}
