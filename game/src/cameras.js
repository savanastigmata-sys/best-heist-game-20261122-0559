// Security cameras: wall-mounted, sweeping their cones on a fixed period.
// The sweep phase comes from the camera's position, never from Math.random,
// so the same seed replays the same sweeps.
import { CAMERA, DIFFICULTY } from './config.js';
import { angleDifference, lineOfSightBlocked } from './guards.js';

/**
 * A camera on the wall. Its sweep phase is derived from where it hangs, so
 * two cameras never sweep in lockstep and the pattern repeats every run.
 * The difficulty stretches or shrinks the sweep period; NORMAL is unchanged.
 */
export function createSecurityCamera(config, floor, difficulty = DIFFICULTY.NORMAL) {
  const phase = (((config.x * 31 + config.y * 17) % 360) * Math.PI) / 180;
  const period = Math.max(
    CAMERA.minPeriod,
    (CAMERA.sweepPeriod - CAMERA.sweepPerFloor * (floor - 1)) * difficulty.cameraSweep,
  );
  return {
    x: config.x,
    y: config.y,
    baseAngle: config.baseAngle,
    sweep: config.sweep,
    angle: config.baseAngle,
    period,
    phase,
    time: 0,
    jammedSeconds: 0,
  };
}

/** Advance one camera's sweep by dt; a jammed camera holds still and dark. */
export function sweepCameraCone(camera, dt) {
  camera.time += dt;
  if (camera.jammedSeconds > 0) {
    camera.jammedSeconds = Math.max(0, camera.jammedSeconds - dt);
    return;
  }
  camera.angle = camera.baseAngle
    + camera.sweep * Math.sin((Math.PI * 2 * camera.time) / camera.period + camera.phase);
}

/** True when a live camera can see the thief — never through smoke or a jam. */
export function cameraSeesThief(camera, thief, coverRects, smokeHidden) {
  if (camera.jammedSeconds > 0) return false;
  if (smokeHidden) return false;
  const dx = thief.x - camera.x;
  const dy = thief.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.range) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), camera.angle)) > CAMERA.halfAngle) return false;
  if (lineOfSightBlocked(camera.x, camera.y, thief.x, thief.y, coverRects)) return false;
  return true;
}

/** Switch every camera off for `seconds` — the jammer's whole job. */
export function jamCameras(cameras, seconds) {
  for (let i = 0; i < cameras.length; i += 1) {
    cameras[i].jammedSeconds = seconds;
  }
}
