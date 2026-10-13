// Default settings, shared by bridge.js and the options page.
// page.js runs in the page's world and keeps its own fallback copy: keep both in sync.
const YTM_FINE_VOLUME_DEFAULTS = Object.freeze({
  exponent: 2, // Option A: 1 = YTM's original curve, higher = more room below YTM's 1 %
  step: 1, // Option B: player volume points per wheel notch / arrow press
  wheel: true,
  arrows: true,
  osd: true,
});
