// Runs in the page's own JS world (MAIN) at document_start, before YouTube Music's player touches
// the <video> element. No WebExtension APIs here: settings arrive from bridge.js via DOM events.
//
// What YTM does (measured on music.youtube.com, Oct 2026):
// - its volume slider (0–100) goes through a curve to an integer "player volume" (0–100 %):
//   positions 0–4 → 0 %, 5 → 1 %, 20 → 5 %, 50 → 20 %, 77 → 50 %, 100 → 100 %;
// - the player then sets video.volume = player volume / 100 × loudness-normalisation factor (≤ 1).
// So the quietest audible level is 1 % (−40 dB), and nothing sits between it and silence.
(() => {
  'use strict';

  const EVENT_CONFIG = 'ytm-fine-volume:config';
  const EVENT_HELLO = 'ytm-fine-volume:hello';
  const EVENT_COMMAND = 'ytm-fine-volume:command';
  const EVENT_STATUS = 'ytm-fine-volume:status';

  // Fallback until bridge.js delivers the stored settings (keep in sync with src/defaults.js).
  let config = { exponent: 2, step: 1, wheel: true, arrows: true, osd: true };

  const getPlayer = () => document.getElementById('movie_player');

  // ---- Option A: bend the volume curve ------------------------------------------------------

  const nativeVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const applied = new WeakMap(); // media element -> { requested, real }

  function playerLevel() {
    const volume = getPlayer()?.getVolume?.();
    return Number.isFinite(volume) ? volume / 100 : NaN;
  }

  // real = requested × u^(k−1), u = player volume: the user's level gets the exponent while the
  // loudness-normalisation factor stays linear (a plain requested^k would exaggerate it).
  function bend(requested) {
    const k = config.exponent;
    if (k === 1 || requested === 0) return requested;
    const u = playerLevel();
    if (u > 0 && requested <= u + 1e-6) return requested * u ** (k - 1);
    return requested ** k;
  }

  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    enumerable: nativeVolume.enumerable,
    get() {
      const raw = nativeVolume.get.call(this);
      const entry = applied.get(this);
      // Give YTM back the value it asked for, so its own bookkeeping never sees the curve.
      return entry && entry.real === raw ? entry.requested : raw;
    },
    set(requested) {
      if (typeof requested !== 'number' || !(requested >= 0 && requested <= 1)) {
        nativeVolume.set.call(this, requested); // keeps the native conversion / range errors
        return;
      }
      nativeVolume.set.call(this, bend(requested));
      applied.set(this, { requested, real: nativeVolume.get.call(this) });
    },
  });

  function reapplyCurve() {
    // The getter returns the un-bent value, so re-assigning it re-bends with the current exponent.
    for (const media of document.querySelectorAll('video, audio')) media.volume = media.volume;
  }

  // ---- Option B: 1 % steps with the wheel and arrow keys -----------------------------------

  // Approximation of YTM's slider curve, only used to move the slider knob next to the real value.
  const SLIDER_CURVE = 0.027;
  const sliderToVolume = (position) =>
    Math.floor((100 * Math.expm1(SLIDER_CURVE * position)) / Math.expm1(100 * SLIDER_CURVE) + 1e-9);

  function volumeToSlider(volume) {
    for (let position = 0; position <= 100; position++) {
      if (sliderToVolume(position) >= volume) return position;
    }
    return 100;
  }

  function setPlayerVolume(player, target) {
    if (target > 0 && player.isMuted?.()) player.unMute();
    const position = volumeToSlider(target);
    const sliders = document.querySelectorAll(
      'ytmusic-player-bar #volume-slider, ytmusic-player-bar #expand-volume-slider',
    );
    for (const slider of sliders) slider.value = position;
    // Going through the slider's change event keeps YTM's own state (icon, store) consistent…
    sliders[0]?.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    // …then the player volume is set to the exact percentage the slider may not reach.
    if (player.getVolume() !== target) player.setVolume(target);
  }

  function stepVolume(direction) {
    const player = getPlayer();
    if (!player?.getVolume || !player.setVolume) return;
    const current = player.isMuted?.() ? 0 : player.getVolume();
    const target = Math.min(100, Math.max(0, current + direction * config.step));
    setPlayerVolume(player, target);
    showOsd(target);
  }

  const isPlayerBar = (event) => event.composedPath().some((el) => el.localName === 'ytmusic-player-bar');

  const WHEEL_THRESHOLD = 40; // px: one mouse notch exceeds it, small trackpad deltas add up to it
  let wheelAccumulator = 0;
  let wheelResetTimer;

  window.addEventListener(
    'wheel',
    (event) => {
      if (!config.wheel || !isPlayerBar(event)) return;
      event.preventDefault();
      event.stopPropagation(); // YTM's own wheel handler would step the slider as well
      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 33 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 800 : 1;
      wheelAccumulator += event.deltaY * scale;
      clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => (wheelAccumulator = 0), 200);
      if (Math.abs(wheelAccumulator) >= WHEEL_THRESHOLD) {
        stepVolume(wheelAccumulator < 0 ? 1 : -1);
        wheelAccumulator = 0;
      }
    },
    { capture: true, passive: false },
  );

  function isTyping(event) {
    const target = event.composedPath()[0];
    return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (!config.arrows || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || isTyping(event)) return;
      event.preventDefault();
      event.stopPropagation();
      stepVolume(event.key === 'ArrowUp' ? 1 : -1);
    },
    { capture: true },
  );

  // ---- On-screen display ---------------------------------------------------------------------

  let osd;
  let osdTimer;

  function showOsd(volume) {
    if (!config.osd) return;
    if (!osd) {
      osd = document.createElement('div');
      osd.setAttribute('role', 'status');
      Object.assign(osd.style, {
        position: 'fixed',
        right: '24px',
        bottom: '96px',
        zIndex: '2147483647',
        padding: '8px 14px',
        borderRadius: '8px',
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        font: '500 14px/1.2 Roboto, Arial, sans-serif',
        pointerEvents: 'none',
        transition: 'opacity 0.2s',
      });
      document.documentElement.append(osd);
    }
    const gainDb = Math.round(20 * config.exponent * Math.log10(volume / 100));
    osd.textContent = volume === 0 ? 'Volume 0 % (muet)' : `Volume ${volume} % · ${gainDb} dB`;
    osd.style.opacity = '1';
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => (osd.style.opacity = '0'), 1200);
  }

  // ---- Settings ------------------------------------------------------------------------------

  const clamp = (value, min, max, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

  window.addEventListener(EVENT_CONFIG, (event) => {
    let stored;
    try {
      stored = JSON.parse(event.detail);
    } catch {
      return;
    }
    const previousExponent = config.exponent;
    config = {
      exponent: clamp(Number(stored.exponent), 1, 4, config.exponent),
      step: Math.round(clamp(Number(stored.step), 1, 10, config.step)),
      wheel: stored.wheel !== false,
      arrows: stored.arrows !== false,
      osd: stored.osd !== false,
    };
    if (config.exponent !== previousExponent) reapplyCurve();
  });

  // ---- Toolbar popup (via bridge.js) ---------------------------------------------------------

  function status() {
    const player = getPlayer();
    const volume = player?.getVolume?.();
    const media = document.querySelector('video');
    return {
      player: Number.isFinite(volume),
      volume: Number.isFinite(volume) ? volume : null,
      muted: Boolean(player?.isMuted?.()),
      // What actually reaches the audio output, curve and normalisation included.
      output: media && !media.muted ? nativeVolume.get.call(media) : 0,
    };
  }

  window.addEventListener(EVENT_COMMAND, (event) => {
    let command;
    try {
      command = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (command.type === 'step') stepVolume(command.direction === 1 ? 1 : -1);
    window.dispatchEvent(new CustomEvent(EVENT_STATUS, { detail: JSON.stringify(status()) }));
  });

  window.dispatchEvent(new CustomEvent(EVENT_HELLO));
})();
