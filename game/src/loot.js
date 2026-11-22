// Loot: the Aurora Diamond on its pedestal and the side loot on the walls.
// Stealing is a grab — walk within reach and it is banked, with a floater.
import { LOOT, THIEF } from './config.js';

/** The loot cache for a floor: the diamond plus its three side pieces. */
export function createLootCache(plan) {
  return {
    diamond: {
      x: plan.diamond.x,
      y: plan.diamond.y,
      value: LOOT.diamond,
      label: 'AURORA DIAMOND',
      taken: false,
    },
    side: plan.sideLoot.map((item) => ({
      kind: item.kind,
      x: item.x,
      y: item.y,
      value: item.value,
      label: item.label,
      taken: false,
    })),
  };
}

/**
 * Grab whatever the thief stands close enough to. Returns what was gained,
 * whether the diamond was among it, and the floating labels to show.
 */
export function stealLoot(loot, thief) {
  let gained = 0;
  let tookDiamond = false;
  const labels = [];
  const grab = (item) => {
    if (item.taken) return;
    if (Math.hypot(thief.x - item.x, thief.y - item.y) > THIEF.grabRadius) return;
    item.taken = true;
    gained += item.value;
    labels.push({ x: item.x, y: item.y - 24, text: `+$${item.value.toLocaleString('en-US')}`, life: 1.4 });
  };
  const diamondWasTaken = loot.diamond.taken;
  grab(loot.diamond);
  tookDiamond = !diamondWasTaken && loot.diamond.taken;
  for (let i = 0; i < loot.side.length; i += 1) grab(loot.side[i]);
  return { gained, tookDiamond, labels };
}

/** The value of everything this cache has banked so far. */
export function lootValue(loot) {
  let total = loot.diamond.taken ? loot.diamond.value : 0;
  for (let i = 0; i < loot.side.length; i += 1) {
    if (loot.side[i].taken) total += loot.side[i].value;
  }
  return total;
}

/** True when every side piece on this floor has been taken. */
export function allSideLootTaken(loot) {
  for (let i = 0; i < loot.side.length; i += 1) {
    if (!loot.side[i].taken) return false;
  }
  return true;
}
