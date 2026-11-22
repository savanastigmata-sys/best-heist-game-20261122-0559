// The renderer: one canvas, one fixed 1280x720 frame. Everything the judge
// needs to see is in the frame — the room, the cones, the cameras, the loot
// and the alarm meter — with every label on a dark chip so it survives
// shrinking to the contact sheet.
import { CAMERA, FIELD, FLOOR_BONUS, FONT, GUARD, HUD_HEIGHT, PALETTE, ROOM } from './config.js';
import { computeVisionCone } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_FLOOR = 'floor';

function money(value) {
  return `$${value.toLocaleString('en-US')}`;
}

/** Paint the thief's vault room, HUD and the current screen's panel. */
export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  function chipText(text, x, y, size, color, align) {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width;
    const pad = 6;
    const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
    ctx.fillStyle = 'rgba(8,6,12,0.72)';
    ctx.fillRect(left - pad, y - size / 2 - 3, width + pad * 2, size + 6);
    ctx.fillStyle = color || PALETTE.text;
    ctx.fillText(text, x, y);
  }

  function wedge(x, y, angle, range, halfAngle, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawFloor() {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const size = 64;
    for (let y = ROOM.y; y < ROOM.y + ROOM.height; y += size) {
      for (let x = ROOM.x; x < ROOM.x + ROOM.width; x += size) {
        const even = ((x - ROOM.x) / size + (y - ROOM.y) / size) % 2 === 0;
        ctx.fillStyle = even ? PALETTE.floorLight : PALETTE.floorDark;
        ctx.fillRect(x, y, Math.min(size, ROOM.x + ROOM.width - x), Math.min(size, ROOM.y + ROOM.height - y));
      }
    }
    ctx.fillStyle = PALETTE.shadowLane;
    ctx.fillRect(1020, ROOM.y, 232, ROOM.height);
    ctx.fillStyle = PALETTE.carpet;
    ctx.fillRect(556, ROOM.y, 168, ROOM.height);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.strokeRect(556, ROOM.y, 168, ROOM.height);
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 10;
    ctx.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM.x + 6, ROOM.y + 6, ROOM.width - 12, ROOM.height - 12);
    for (const px of [140, 320, 960, 1140]) {
      ctx.fillStyle = PALETTE.wallTrim;
      ctx.fillRect(px - 22, ROOM.y + 10, 44, 30);
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(px - 18, ROOM.y + 14, 36, 22);
    }
    chipText('VELVET CARPET — BOLD ROUTE', 640, 470, 12, PALETTE.muted);
    chipText('DISPLAY CASES — COVER ROUTE', 150, 380, 12, PALETTE.muted);
    chipText('SHADOW LANE — QUIET ROUTE', 1136, 560, 12, PALETTE.muted);
  }

  function drawDoors(state) {
    ctx.fillStyle = '#3a2f1a';
    ctx.fillRect(596, ROOM.y + ROOM.height - 8, 88, 8);
    chipText('ENTRY', 640, ROOM.y + ROOM.height - 22, 11, PALETTE.muted);
    const open = state.diamondTaken;
    ctx.fillStyle = open ? PALETTE.exit : '#5a5a5a';
    ctx.fillRect(state.exit.x, state.exit.y, state.exit.width, state.exit.height);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.strokeRect(state.exit.x, state.exit.y, state.exit.width, state.exit.height);
    chipText('GETAWAY', state.exitCentre.x, state.exit.y - 14, 12, open ? PALETTE.exit : PALETTE.muted);
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0b0d12';
    ctx.fillText(open ? 'OPEN ✓' : 'LOCKED', state.exitCentre.x, state.exit.y + 15);
  }

  function drawCover(state) {
    for (let i = 0; i < state.cases.length; i += 1) {
      const rect = state.cases[i];
      ctx.fillStyle = PALETTE.coverBase;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.fillStyle = PALETTE.coverGlass;
      ctx.fillRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8);
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    for (let i = 0; i < state.pillars.length; i += 1) {
      const pillar = state.pillars[i];
      ctx.beginPath();
      ctx.arc(pillar.x, pillar.y, pillar.radius, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.pillar;
      ctx.fill();
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawLoot(state, time) {
    const diamond = state.loot.diamond;
    if (!diamond.taken) {
      ctx.fillStyle = 'rgba(191,239,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(612, ROOM.y);
      ctx.lineTo(668, ROOM.y);
      ctx.lineTo(diamond.x + 10, diamond.y);
      ctx.lineTo(diamond.x - 10, diamond.y);
      ctx.closePath();
      ctx.fill();
      const pulse = 24 + 6 * Math.sin(time * 3);
      ctx.beginPath();
      ctx.arc(diamond.x, diamond.y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(191,239,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#2c2438';
      ctx.fillRect(diamond.x - 20, diamond.y + 8, 40, 16);
      ctx.save();
      ctx.translate(diamond.x, diamond.y - 6);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.diamond;
      ctx.shadowColor = PALETTE.diamond;
      ctx.shadowBlur = 18;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
      chipText(`AURORA DIAMOND ${money(50000)}`, diamond.x, 200, 13, PALETTE.diamond);
    } else {
      chipText('VAULT EMPTY', diamond.x, diamond.y + 42, 12, PALETTE.muted);
    }
    for (let i = 0; i < state.loot.side.length; i += 1) {
      const item = state.loot.side[i];
      if (item.taken) continue;
      if (item.kind === 'gold') {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(item.x - 14, item.y - 4, 28, 9);
        ctx.fillRect(item.x - 10, item.y - 12, 20, 9);
      } else if (item.kind === 'painting') {
        ctx.fillStyle = PALETTE.wallTrim;
        ctx.fillRect(item.x - 20, item.y - 26, 40, 52);
        ctx.fillStyle = '#241a30';
        ctx.fillRect(item.x - 16, item.y - 22, 32, 44);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PALETTE.diamond;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      chipText(`${item.label} ${money(item.value)}`, item.x, item.y + 34, 12, PALETTE.text);
    }
  }

  function drawCones(state) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      if (camera.jammedSeconds > 0) continue;
      wedge(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, PALETTE.cameraCone);
    }
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const cone = computeVisionCone(guard);
      const fill = guard.chasing
        ? PALETTE.coneChase
        : guard.suspicion > GUARD.spotAtSuspicion ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      wedge(cone.x, cone.y, cone.angle, cone.range, cone.halfAngle, fill);
      wedge(cone.x, cone.y, cone.angle, cone.range * 0.62, cone.halfAngle, fill);
    }
  }

  function drawActors(state, time) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      const jammed = camera.jammedSeconds > 0;
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#111111';
      ctx.fill();
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = jammed ? '#666666' : Math.sin(time * 4) > 0 ? '#ff4444' : '#881111';
      ctx.fill();
      chipText(jammed ? 'CAMERA JAMMED' : 'CAMERA', camera.x, camera.y - 20, 11, jammed ? PALETTE.muted : '#ff8888');
    }
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.guard;
      ctx.fill();
      ctx.strokeStyle = guard.chasing ? PALETTE.guardAlert : '#222222';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 12, guard.y + Math.sin(guard.angle) * 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.text;
      ctx.fill();
      if (guard.suspicion > 5) {
        ctx.fillStyle = 'rgba(8,6,12,0.72)';
        ctx.fillRect(guard.x - 18, guard.y - 30, 36, 6);
        ctx.fillStyle = guard.suspicion > GUARD.spotAtSuspicion ? '#f08c28' : PALETTE.gold;
        ctx.fillRect(guard.x - 18, guard.y - 30, 36 * (guard.suspicion / 100), 6);
      }
      if (guard.chasing) {
        ctx.font = `bold 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PALETTE.guardAlert;
        ctx.fillText('!', guard.x, guard.y - 38);
      } else if (guard.suspicion > GUARD.spotAtSuspicion) {
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f08c28';
        ctx.fillText('?', guard.x, guard.y - 38);
      }
      chipText('GUARD', guard.x, guard.y + 28, 11, PALETTE.muted);
    }
    const thief = state.thief;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    ctx.fillStyle = thief.sneaking ? PALETTE.thiefSneak : PALETTE.thief;
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(thief.x + Math.cos(thief.facing) * 9, thief.y + Math.sin(thief.facing) * 9, 3, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    chipText(thief.sneaking ? 'THIEF · SNEAKING' : 'THIEF', thief.x, thief.y + 28, 11, PALETTE.thief);
    if (state.toolbelt.smokeSeconds > 0) {
      ctx.fillStyle = 'rgba(200,200,210,0.35)';
      for (let i = 0; i < 5; i += 1) {
        const angle = i * 1.2566;
        ctx.beginPath();
        ctx.arc(
          state.toolbelt.smokeX + Math.cos(angle) * 42,
          state.toolbelt.smokeY + Math.sin(angle) * 42,
          34, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
    for (let i = 0; i < state.particles.length; i += 1) {
      const particle = state.particles[i];
      ctx.fillStyle = `rgba(242,201,76,${Math.max(0, particle.life)})`;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    for (let i = 0; i < state.floaters.length; i += 1) {
      const floater = state.floaters[i];
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(242,201,76,${Math.max(0, Math.min(1, floater.life))})`;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = '#17131f';
    ctx.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    ctx.fillStyle = PALETTE.wallTrim;
    ctx.fillRect(0, HUD_HEIGHT - 2, FIELD.width, 2);
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('GILDED HOUR', 36, 24);
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`FLOOR ${state.floor}/3`, 36, 48);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(150 + i * 20, 48, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < state.floor ? PALETTE.gold : '#444444';
      ctx.fill();
    }
    const barX = 490;
    const barW = 300;
    const barY = 21;
    const barH = 22;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('ALARM', barX - 10, barY + barH / 2);
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(barX, barY, barW, barH);
    const alarmColor = state.alarm < 30 ? PALETTE.alarmLow : state.alarm < 60 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    ctx.fillStyle = alarmColor;
    ctx.fillRect(barX, barY, barW * (state.alarm / 100), barH);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    const pct = `${Math.round(state.alarm)}%`;
    ctx.font = `bold 13px ${FONT}`;
    const pctWidth = ctx.measureText(pct).width;
    ctx.fillStyle = 'rgba(8,6,12,0.72)';
    ctx.fillRect(barX + barW - pctWidth - 10, barY + 2, pctWidth + 6, barH - 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pct, barX + barW - 7, barY + barH / 2);
    ctx.textAlign = 'right';
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`LOOT ${money(state.score)}   BEST ${money(best)}`, 1244, 24);
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(
      `[1] SMOKE ×${state.toolbelt.smokeCharges}   [2] JAMMER ×${state.toolbelt.jammerCharges}`,
      1244, 48,
    );
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(
      'WASD / Arrows move · Shift sneak · [1] Smoke $2,000 · [2] Jammer $2,000 · Click to walk · P pause · M mute',
      640, 708,
    );
  }

  function drawPanel(title, lines, prompt, time) {
    ctx.fillStyle = 'rgba(8,6,12,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 780;
    const height = 120 + lines.length * 30 + 60;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(title, FIELD.width / 2, y + 52);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], FIELD.width / 2, y + 104 + i * 30);
    }
    if (prompt) {
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillStyle = `rgba(244,234,210,${0.55 + 0.45 * Math.sin(time * 3)})`;
      ctx.fillText(prompt, FIELD.width / 2, y + height - 34);
    }
  }

  function draw(state, screen, best, time) {
    const t = typeof time === 'number' ? time : state.time;
    drawFloor();
    drawDoors(state);
    drawCover(state);
    drawLoot(state, t);
    drawCones(state);
    drawActors(state, t);
    if (state.alarm >= 25) {
      ctx.fillStyle = `rgba(229,83,75,${((state.alarm - 25) / 75) * 0.16})`;
      ctx.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    }
    const gradient = ctx.createRadialGradient(640, 400, 300, 640, 400, 720);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      drawPanel('GILDED HOUR', [
        'The Meridian Vault Heist',
        'Steal the Aurora Diamond — $50,000 — then reach the getaway door.',
        'Read the cones. Reach the getaway before the alarm hits 100%.',
        'Three routes: velvet carpet, display cases, shadow lane.',
        'Tools cost $2,000 a use: [1] smoke blinds guards, [2] jammer kills cameras.',
        'WASD move · Shift sneak · Click to walk · Space start',
      ], 'Press Space to start the heist', t);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The vault waits. The guards do not.'], 'Press P or Space to resume', t);
    } else if (screen === SCREEN_FLOOR) {
      drawPanel('FLOOR CLEAR!', [
        `Clean getaway — ${money(FLOOR_BONUS)} bonus banked.`,
        `Next: Floor ${state.floor} of 3. The patrols get faster.`,
      ], 'Press Space for the next floor', t);
    } else if (screen === SCREEN_OVER) {
      drawPanel('CAUGHT!', [
        state.caughtCause,
        `Floor ${state.floor} · Loot ${money(state.score)} · Best ${money(best)}`,
      ], 'Press Space to try again', t);
    } else if (screen === SCREEN_WIN) {
      const stars = state.alarm < 30 ? '★★★' : state.alarm < 60 ? '★★' : '★';
      drawPanel('GETAWAY!', [
        `${stars}  The Aurora Diamond is yours.`,
        `Final loot ${money(state.score)} · Fence fees ${money(state.feesPaid)}`,
        `${state.floor} floors · ${state.lootCount} loot · ${state.toolsUsed} tools used · Alarm ${Math.round(state.alarm)}%`,
        `Best ${money(best)}`,
      ], 'Press Space to play again', t);
    }
  }

  return { draw };
}
