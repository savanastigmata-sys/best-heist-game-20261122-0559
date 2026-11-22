// Keyboard and pointer input. Held keys give an 8-direction steering vector;
// one-shot presses (start, pause, smoke, jammer, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_JAMMER = 8;
export const ACTION_MUTE = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SMOKE = new Set(['Digit1', 'Numpad1']);
const JAMMER = new Set(['Digit2', 'Numpad2']);
const MUTE = new Set(['KeyM']);

/** Keyboard + click-to-walk input for the canvas. */
export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clickTarget = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (SMOKE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SMOKE;
    } else if (JAMMER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JAMMER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    clickTarget = {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
    actions |= ACTION_CONFIRM;
  });

  function has(codes) {
    for (const code of codes) {
      if (keys.has(code)) return true;
    }
    return false;
  }

  return {
    /** The steering vector: {x, y} each in -1..1, diagonal normalised. */
    direction() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      const len = Math.hypot(x, y);
      if (len > 1) return { x: x / len, y: y / len };
      return { x, y };
    },
    /** True while either Shift key is held. */
    sneaking() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** True while any movement key is held. */
    moving() {
      return has(LEFT) || has(RIGHT) || has(UP) || has(DOWN);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click-to-walk target, or null; reading it clears it. */
    clickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
  };
}
