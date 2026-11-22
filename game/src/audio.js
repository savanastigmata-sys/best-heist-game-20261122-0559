// Sound, synthesised with WebAudio only — no audio files, no network.
// The context is created lazily on the first gesture, and every call is
// guarded, so sound can never break the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let hum = null;

  function ensure() {
    try {
      if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ensure()) return;
    try {
      const start = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    } catch {
      // Sound is decoration: never let it throw.
    }
  }

  return {
    /** Create the context on a user gesture. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    playLoot() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1318, 0.16, 'sine', 0.2, 0.07);
    },
    playDiamond() {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.22, 'triangle', 0.25, i * 0.09);
    },
    playSpotted() {
      tone(220, 0.5, 'sawtooth', 0.18, 0, 440);
    },
    playSmoke() {
      tone(300, 0.4, 'sine', 0.15, 0, 90);
    },
    playJammer() {
      tone(1200, 0.08, 'square', 0.12);
      tone(900, 0.08, 'square', 0.12, 0.09);
    },
    playCaught() {
      tone(392, 0.7, 'sawtooth', 0.2, 0, 98);
    },
    playWin() {
      const notes = [523, 659, 784, 1047, 1319];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.25, 'triangle', 0.22, i * 0.11);
    },
    playClick() {
      tone(660, 0.06, 'sine', 0.18);
    },
    /** A low hum while the alarm is hot; idempotent. */
    startAlarmHum() {
      if (hum || !ensure()) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 55;
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        hum = { osc, gain };
      } catch {
        hum = null;
      }
    },
    stopAlarmHum() {
      if (!hum) return;
      try {
        hum.osc.stop();
      } catch {
        // Already stopped.
      }
      hum = null;
    },
  };
}
