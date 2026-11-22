// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, floor-clear, caught and getaway.
//
// ?seed=N fixes the loot jitter. ?shot=start|play|caught|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, DIFFICULTY, DIFFICULTY_ORDER, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createHeistWorld,
  EVENT_CAUGHT,
  EVENT_DIAMOND,
  EVENT_FLOOR,
  EVENT_LOOT,
  EVENT_SPOTTED,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_JAMMER,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_SMOKE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_FLOOR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { SHOT_NAMES, stageShot } from './shots.js';

const GAME_TITLE = 'GILDED HOUR';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createHeistWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__heist = { world, get screen() { return scene.screen; } };
  status.textContent = `${GAME_TITLE}. ${scene.screen}.`;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.documentElement.dataset.shotReady = 'true';
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let walkTarget = null;
  let accumulator = 0;
  let last = performance.now();
  let difficultyIndex = 1;
  let prevDirX = 0;

  window.__heist = { world, get screen() { return screen; } };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each haul.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    walkTarget = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Steal the Aurora Diamond.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.playCaught();
    audio.stopAlarmHum();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Caught. Loot ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.playWin();
    audio.stopAlarmHum();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Getaway. Final loot ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_SMOKE) {
        if (world.useSmoke()) audio.playSmoke();
      }
      if (actions & ACTION_JAMMER) {
        if (world.useJammer()) audio.playJammer();
      }
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_FLOOR) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Arrow keys pick the difficulty (edge-triggered: holding the key does not cycle).
      const dir = input.direction();
      let next = difficultyIndex;
      if (dir.x > 0 && prevDirX <= 0) next = Math.min(DIFFICULTY_ORDER.length - 1, difficultyIndex + 1);
      else if (dir.x < 0 && prevDirX >= 0) next = Math.max(0, difficultyIndex - 1);
      prevDirX = dir.x;
      if (next !== difficultyIndex) {
        difficultyIndex = next;
        world.setDifficulty(DIFFICULTY[DIFFICULTY_ORDER[difficultyIndex]]);
      }
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const clicked = input.clickTarget();
    if (clicked) walkTarget = clicked;
    let move = input.direction();
    if (input.moving()) {
      walkTarget = null;
    } else if (walkTarget) {
      const dx = walkTarget.x - world.state.thief.x;
      const dy = walkTarget.y - world.state.thief.y;
      const len = Math.hypot(dx, dy);
      if (len < 12) {
        walkTarget = null;
        move = { x: 0, y: 0 };
      } else {
        move = { x: dx / len, y: dy / len };
      }
    }
    const events = world.step(STEP, move, input.sneaking(), false);
    if (events & EVENT_DIAMOND) audio.playDiamond();
    else if (events & EVENT_LOOT) audio.playLoot();
    if (events & EVENT_SPOTTED) audio.playSpotted();
    if (events & EVENT_CAUGHT) endGame();
    else if (events & EVENT_WIN) winGame();
    else if (events & EVENT_FLOOR) {
      screen = SCREEN_FLOOR;
      audio.playClick();
      announce(`Floor clear. Bonus banked. Loot ${world.state.score}.`);
    }
    if (screen === SCREEN_PLAY && world.state.alarm >= 25) audio.startAlarmHum();
    else audio.stopAlarmHum();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.state.time);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  world.reset();
  announce(`${GAME_TITLE}. Press Space or click to start.`);
  requestAnimationFrame(frame);
}

if (shot) runShot(SHOT_NAMES.includes(shot) ? shot : 'start');
else runGame();
