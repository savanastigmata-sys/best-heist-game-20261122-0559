// The toolbelt: smoke bombs and the camera jammer, each with two charges
// and a $2,000 fence fee per use, paid through a callback the world supplies.
import { TOOLS } from './config.js';
import { jamCameras } from './cameras.js';

/** A fresh toolbelt: two smoke bombs, two jammer charges, nothing spent. */
export function createToolbelt() {
  return {
    smokeCharges: TOOLS.smokeCharges,
    jammerCharges: TOOLS.jammerCharges,
    smokeSeconds: 0,
    smokeX: 0,
    smokeY: 0,
  };
}

/**
 * Throw a smoke bomb at the thief's feet: a 5 s cloud that blinds every
 * guard and camera. Returns false when the belt is empty.
 */
export function useSmokeBomb(toolbelt, thief, onFee) {
  if (toolbelt.smokeCharges <= 0) return false;
  toolbelt.smokeCharges -= 1;
  toolbelt.smokeSeconds = TOOLS.smokeSeconds;
  toolbelt.smokeX = thief.x;
  toolbelt.smokeY = thief.y;
  if (onFee) onFee(TOOLS.feeDollars);
  return true;
}

/**
 * Fire the jammer: every camera goes dark for 8 s. Returns false when the
 * belt is empty.
 */
export function useCameraJammer(toolbelt, cameras, onFee) {
  if (toolbelt.jammerCharges <= 0) return false;
  toolbelt.jammerCharges -= 1;
  jamCameras(cameras, TOOLS.jammerSeconds);
  if (onFee) onFee(TOOLS.feeDollars);
  return true;
}

/** Tick the smoke cloud down; the jammer's own timer lives on the cameras. */
export function updateToolbelt(toolbelt, dt) {
  if (toolbelt.smokeSeconds > 0) {
    toolbelt.smokeSeconds = Math.max(0, toolbelt.smokeSeconds - dt);
  }
}

/** True while the thief stands inside the live smoke cloud. */
export function thiefHiddenBySmoke(toolbelt, thief) {
  if (toolbelt.smokeSeconds <= 0) return false;
  return Math.hypot(thief.x - toolbelt.smokeX, thief.y - toolbelt.smokeY) < TOOLS.smokeRadius;
}
